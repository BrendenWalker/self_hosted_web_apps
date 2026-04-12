import { describe, it, expect, beforeEach } from 'vitest';
import {
  OFFLINE_QUEUE_KEY,
  loadActivityQueue,
  queueOfflineActivity,
  saveActivityQueue,
  syncPendingActivities,
} from './offlineActivityQueue';

describe('offlineActivityQueue', () => {
  beforeEach(() => {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  });

  it('appends payloads with stable shape', () => {
    const n = queueOfflineActivity({ activity_type: 'water', pet_id: 2, rating: 5 });
    expect(n).toBe(1);
    const q = loadActivityQueue();
    expect(q).toHaveLength(1);
    expect(q[0].payload.activity_type).toBe('water');
    expect(q[0].id).toBeTruthy();
    expect(q[0].createdAt).toBeTruthy();
  });

  it('syncPendingActivities posts each item and clears on success', async () => {
    saveActivityQueue([
      { id: 'a', payload: { x: 1 }, createdAt: new Date().toISOString() },
      { id: 'b', payload: { x: 2 }, createdAt: new Date().toISOString() },
    ]);
    const seen = [];
    const result = await syncPendingActivities(async (payload, signal) => {
      expect(signal).toBeDefined();
      seen.push(payload.x);
      return { ok: true };
    });
    expect(seen).toEqual([1, 2]);
    expect(result.synced).toBe(2);
    expect(result.remaining).toBe(0);
    expect(loadActivityQueue()).toHaveLength(0);
  });

  it('keeps failed items in the queue', async () => {
    queueOfflineActivity({ n: 1 });
    const result = await syncPendingActivities(async () => ({ ok: false }));
    expect(result.synced).toBe(0);
    expect(result.remaining).toBe(1);
  });
});
