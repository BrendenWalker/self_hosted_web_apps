/**
 * Persists activity POST payloads when offline or when the quick-save request times out.
 * Uses the same storage key as the legacy Jinja app for compatibility.
 */
export const OFFLINE_QUEUE_KEY = 'pending_activities_v1';
export const OFFLINE_TRY_TIMEOUT_MS = 1500;

function newEntryId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

export function loadActivityQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading offline queue', e);
    return [];
  }
}

export function saveActivityQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event('pethub-offline-queue-changed'));
  } catch (e) {
    console.error('Error saving offline queue', e);
  }
}

/** @returns {number} new queue length */
export function queueOfflineActivity(payload) {
  const queue = loadActivityQueue();
  queue.push({
    id: newEntryId(),
    payload,
    createdAt: new Date().toISOString(),
  });
  saveActivityQueue(queue);
  return queue.length;
}

export function getOfflineQueueCount() {
  return loadActivityQueue().length;
}

/** Pending POST payloads for one pet (queue order preserved). */
export function getPendingPayloadsForPet(petId) {
  const id = Number(petId);
  if (!id) return [];
  return loadActivityQueue()
    .map((item) => item.payload)
    .filter((p) => Number(p.pet_id) === id);
}

/**
 * Latest activity timestamps from the offline queue for one pet.
 * Shape mirrors `/api/latest_by_type` entries: `{ pee: { created_at, pending }, ... }`.
 */
export function pendingLatestByType(petId) {
  const latest = {};
  for (const p of getPendingPayloadsForPet(petId)) {
    const at = p.created_at || new Date().toISOString();
    if (p.activity_type === 'toilet' && (p.sub_type === 'pee' || p.sub_type === 'poop')) {
      const key = p.sub_type;
      if (!latest[key] || new Date(at) > new Date(latest[key].created_at)) {
        latest[key] = { created_at: at, pending: true };
      }
    } else if (p.activity_type === 'water' || p.activity_type === 'food') {
      const key = p.activity_type;
      if (!latest[key] || new Date(at) > new Date(latest[key].created_at)) {
        latest[key] = { created_at: at, pending: true };
      }
    }
  }
  return latest;
}

/** Merge server latest-by-type with newer queued items for the selected pet. */
export function mergeLatestWithPending(serverLatest, petId) {
  const pending = pendingLatestByType(petId);
  const merged = { ...(serverLatest || {}) };
  for (const [key, pend] of Object.entries(pending)) {
    const srv = merged[key];
    if (!srv?.created_at || new Date(pend.created_at) > new Date(srv.created_at)) {
      merged[key] = pend;
    }
  }
  return merged;
}

/** Adjust potty speedometer hours_since when a queued toilet event is newer than the server. */
export function mergeSpeedWithPending(speed, petId, serverLatest) {
  if (!speed) return speed;
  const pending = pendingLatestByType(petId);
  const merged = {
    pee: speed.pee ? { ...speed.pee } : undefined,
    poop: speed.poop ? { ...speed.poop } : undefined,
  };

  for (const type of ['pee', 'poop']) {
    const pend = pending[type];
    if (!pend) continue;
    const srv = serverLatest?.[type];
    const pendTime = new Date(pend.created_at);
    const srvTime = srv?.created_at ? new Date(srv.created_at) : null;
    if (!srvTime || pendTime > srvTime) {
      const hoursSince = (Date.now() - pendTime.getTime()) / (1000 * 60 * 60);
      merged[type] = {
        ...(merged[type] || {}),
        hours_since: Math.round(hoursSince * 10) / 10,
      };
    }
  }

  return merged;
}

/**
 * POST each queued payload. On failure, item stays in queue.
 * @param {(payload: object) => Promise<{ ok: boolean }>} postOne
 * @param {{ signal?: AbortSignal, perItemTimeoutMs?: number }} [opts]
 * @returns {{ synced: number, remaining: number }}
 */
export async function syncPendingActivities(postOne, opts = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, remaining: getOfflineQueueCount() };
  }

  const perItemTimeoutMs = opts.perItemTimeoutMs ?? 30_000;
  const queue = loadActivityQueue();
  if (!queue.length) {
    return { synced: 0, remaining: 0 };
  }

  const remaining = [];
  let synced = 0;

  for (const item of queue) {
    if (opts.signal?.aborted) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), perItemTimeoutMs);
    try {
      const data = await postOne(item.payload, controller.signal);
      clearTimeout(timer);
      if (data && data.ok) {
        synced += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      clearTimeout(timer);
      remaining.push(item);
    }
  }

  saveActivityQueue(remaining);
  return { synced, remaining: remaining.length };
}
