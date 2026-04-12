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
