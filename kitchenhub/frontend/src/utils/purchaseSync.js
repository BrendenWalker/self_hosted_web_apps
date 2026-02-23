/**
 * Queues "mark purchased" updates and syncs them in the background.
 * Persists pending updates to localStorage when offline so they can be
 * sent when the connection returns. Used on the in-store shopping list
 * where network is often poor.
 */

import { markPurchased as apiMarkPurchased } from '../api/api';

const STORAGE_KEY = 'kitchenhub-purchase-queue';

/** @type {{ itemName: string, purchased: boolean }[]} */
let queue = [];

/** @type {(count: number) => void} */
let listeners = new Set();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) queue = parsed;
    }
  } catch (_) {
    queue = [];
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (_) {}
}

function notifyListeners() {
  const n = queue.length;
  listeners.forEach((cb) => cb(n));
}

/**
 * Add an update to the queue (latest per item wins). Persists to localStorage
 * and kicks off a background flush. Does not await the API.
 * @param {string} itemName
 * @param {boolean} purchased
 */
export function queuePurchaseUpdate(itemName, purchased) {
  queue = queue.filter((e) => e.itemName !== itemName);
  queue.push({ itemName, purchased });
  saveToStorage();
  notifyListeners();
  flushInBackground();
  startRetryInterval();
}

/**
 * How many updates are still pending sync.
 * @returns {number}
 */
export function getPendingCount() {
  return queue.length;
}

/**
 * Subscribe to pending count changes (e.g. for "Syncing…" / "Offline" UI).
 * @param {(count: number) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribePendingCount(callback) {
  listeners.add(callback);
  callback(queue.length);
  return () => listeners.delete(callback);
}

const RETRY_INTERVAL_MS = 5000;

/**
 * Try to send all queued updates to the API. Removes each on success;
 * leaves in queue on network/offline failure and keeps localStorage in sync.
 * Idempotent: safe to call repeatedly. Runs async.
 */
export async function flushPurchaseQueue() {
  if (queue.length === 0) return;
  const snapshot = [...queue];
  for (const { itemName, purchased } of snapshot) {
    try {
      await apiMarkPurchased(itemName, purchased);
      queue = queue.filter((e) => e.itemName !== itemName || e.purchased !== purchased);
      saveToStorage();
      notifyListeners();
    } catch (_) {
      // Network/offline or server error: leave in queue, will retry later
      break;
    }
  }
  if (queue.length === 0) stopRetryInterval();
}

let flushScheduled = false;

function flushInBackground() {
  if (flushScheduled) return;
  flushScheduled = true;
  Promise.resolve()
    .then(() => flushPurchaseQueue())
    .finally(() => {
      flushScheduled = false;
    });
}

let retryIntervalId = null;

function startRetryInterval() {
  if (retryIntervalId != null) return;
  retryIntervalId = setInterval(() => {
    if (queue.length === 0) {
      stopRetryInterval();
      return;
    }
    flushInBackground();
  }, RETRY_INTERVAL_MS);
}

function stopRetryInterval() {
  if (retryIntervalId != null) {
    clearInterval(retryIntervalId);
    retryIntervalId = null;
  }
}

/** Call when app comes online to sync pending updates. */
function onOnline() {
  flushInBackground();
}

/** Call when page becomes visible (e.g. user switched back to tab). */
function onVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible' && queue.length > 0) {
    flushInBackground();
  }
}

// Initialize from localStorage and listen for online + visibility
if (typeof window !== 'undefined') {
  loadFromStorage();
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibilityChange);
  // When we have pending items (e.g. server was down, now back), retry periodically
  if (queue.length > 0) {
    flushInBackground();
    startRetryInterval();
  }
}
