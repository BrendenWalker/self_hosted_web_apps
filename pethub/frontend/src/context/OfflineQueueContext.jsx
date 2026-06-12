import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import {
  getOfflineQueueCount,
  OFFLINE_TRY_TIMEOUT_MS,
  queueOfflineActivity,
  syncPendingActivities,
} from '../utils/offlineActivityQueue';

const OfflineQueueContext = createContext(null);

async function postActivityPayload(payload, signal) {
  const { data } = await api.post('/activity', payload, { signal });
  return data;
}

export function OfflineQueueProvider({ children }) {
  const { me } = useAuth();
  const [pendingCount, setPendingCount] = useState(() => getOfflineQueueCount());
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine
  );

  const refreshCount = useCallback(() => {
    setPendingCount(getOfflineQueueCount());
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'pending_activities_v1' || e.key === null) {
        refreshCount();
      }
    };
    const onCustom = () => refreshCount();
    window.addEventListener('storage', onStorage);
    window.addEventListener('pethub-offline-queue-changed', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pethub-offline-queue-changed', onCustom);
    };
  }, [refreshCount]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const syncPending = useCallback(async () => {
    if (!me?.authenticated) {
      const msg = 'Sign in to sync pending activities.';
      setSyncMessage(msg);
      return { synced: 0, remaining: getOfflineQueueCount(), error: msg };
    }
    if (!online) {
      const msg = 'You are offline. Sync when you have a connection.';
      setSyncMessage(msg);
      return { synced: 0, remaining: getOfflineQueueCount(), error: msg };
    }

    setSyncing(true);
    setSyncMessage('');
    try {
      const result = await syncPendingActivities(postActivityPayload);
      refreshCount();
      if (result.synced > 0) {
        window.dispatchEvent(new CustomEvent('pethub-offline-queue-synced', { detail: result }));
        setSyncMessage(
          result.remaining > 0
            ? `Synced ${result.synced}; ${result.remaining} still waiting.`
            : `Synced ${result.synced} activit${result.synced === 1 ? 'y' : 'ies'}.`
        );
      } else if (result.remaining > 0) {
        setSyncMessage(`${result.remaining} activit${result.remaining === 1 ? 'y' : 'ies'} could not be saved. Try again.`);
      } else {
        setSyncMessage('');
      }
      return result;
    } catch (e) {
      const msg = e.message || 'Sync failed';
      setSyncMessage(msg);
      console.warn('Offline queue sync:', e);
      return { synced: 0, remaining: getOfflineQueueCount(), error: msg };
    } finally {
      setSyncing(false);
    }
  }, [me?.authenticated, online, refreshCount]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!navigator.onLine && getOfflineQueueCount() > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  /**
   * Try POST with short timeout; on offline/abort/error enqueue and return { queued: true }.
   */
  const postActivityResilient = useCallback(
    async (payload) => {
      if (!navigator.onLine) {
        const n = queueOfflineActivity(payload);
        refreshCount();
        return { ok: true, queued: true, queueLength: n };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OFFLINE_TRY_TIMEOUT_MS);
      try {
        const data = await postActivityPayload(payload, controller.signal);
        clearTimeout(timer);
        if (!data.ok) {
          throw new Error(data.error || 'Save failed');
        }
        return { ok: true, queued: false, ...data };
      } catch (e) {
        clearTimeout(timer);
        const n = queueOfflineActivity(payload);
        refreshCount();
        console.warn('Activity save failed or timed out; queued for later:', e);
        return { ok: true, queued: true, queueLength: n };
      }
    },
    [refreshCount]
  );

  const value = useMemo(
    () => ({
      pendingCount,
      online,
      syncing,
      syncMessage,
      refreshCount,
      syncPending,
      postActivityResilient,
    }),
    [pendingCount, online, syncing, syncMessage, refreshCount, syncPending, postActivityResilient]
  );

  return (
    <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) {
    throw new Error('useOfflineQueue must be used within OfflineQueueProvider');
  }
  return ctx;
}
