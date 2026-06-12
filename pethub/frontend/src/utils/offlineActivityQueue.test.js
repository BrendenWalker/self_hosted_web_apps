import { describe, it, expect, beforeEach } from 'vitest';
import {
  OFFLINE_QUEUE_KEY,
  loadActivityQueue,
  mergeLatestWithPending,
  mergeSpeedWithPending,
  pendingLatestByType,
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

  it('pendingLatestByType picks newest queued item per type for a pet', () => {
    saveActivityQueue([
      {
        id: 'a',
        payload: {
          activity_type: 'toilet',
          sub_type: 'pee',
          pet_id: 2,
          created_at: '2026-06-10T10:00:00.000Z',
        },
        createdAt: '2026-06-10T10:00:00.000Z',
      },
      {
        id: 'b',
        payload: {
          activity_type: 'toilet',
          sub_type: 'pee',
          pet_id: 2,
          created_at: '2026-06-12T08:00:00.000Z',
        },
        createdAt: '2026-06-12T08:00:00.000Z',
      },
      {
        id: 'c',
        payload: {
          activity_type: 'water',
          pet_id: 3,
          created_at: '2026-06-12T09:00:00.000Z',
        },
        createdAt: '2026-06-12T09:00:00.000Z',
      },
    ]);
    const latest = pendingLatestByType(2);
    expect(latest.pee.created_at).toBe('2026-06-12T08:00:00.000Z');
    expect(latest.pee.pending).toBe(true);
    expect(latest.water).toBeUndefined();
  });

  it('mergeLatestWithPending prefers newer queued timestamps', () => {
    const server = {
      pee: { created_at: '2026-06-10T10:00:00.000Z' },
      poop: { created_at: '2026-06-11T10:00:00.000Z' },
    };
    saveActivityQueue([
      {
        id: 'a',
        payload: {
          activity_type: 'toilet',
          sub_type: 'pee',
          pet_id: 1,
          created_at: '2026-06-12T08:00:00.000Z',
        },
        createdAt: '2026-06-12T08:00:00.000Z',
      },
    ]);
    const merged = mergeLatestWithPending(server, 1);
    expect(merged.pee.created_at).toBe('2026-06-12T08:00:00.000Z');
    expect(merged.pee.pending).toBe(true);
    expect(merged.poop.created_at).toBe('2026-06-11T10:00:00.000Z');
  });

  it('mergeSpeedWithPending updates hours_since for newer queued toilet events', () => {
    const now = Date.now();
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    saveActivityQueue([
      {
        id: 'a',
        payload: {
          activity_type: 'toilet',
          sub_type: 'pee',
          pet_id: 1,
          created_at: twoHoursAgo,
        },
        createdAt: twoHoursAgo,
      },
    ]);
    const speed = mergeSpeedWithPending(
      { pee: { hours_since: 10, avg_hours: 4 }, poop: { hours_since: 5, avg_hours: 6 } },
      1,
      { pee: { created_at: '2026-06-01T10:00:00.000Z' } }
    );
    expect(speed.pee.hours_since).toBeGreaterThan(1.9);
    expect(speed.pee.hours_since).toBeLessThan(2.1);
    expect(speed.poop.hours_since).toBe(5);
  });
});
