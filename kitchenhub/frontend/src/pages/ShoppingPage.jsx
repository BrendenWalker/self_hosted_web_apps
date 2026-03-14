import React, { useState, useEffect, useRef } from 'react';
import { getStores, getShoppingList, markPurchased } from '../api/api';
import { queuePurchaseUpdate, subscribePendingCount, flushPurchaseQueue } from '../utils/purchaseSync';
import './ShoppingPage.css';

const STORE_STORAGE_KEY = 'kitchenhub-shopping-store';
const ALL_STORE_ID = -1;

function ShoppingPage() {
  const shoppingListRequestRef = useRef(null);
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORE_STORAGE_KEY);
      if (saved === 'all' || saved === String(ALL_STORE_ID)) return ALL_STORE_ID;
      const n = parseInt(saved, 10);
      if (!Number.isNaN(n) && (n === ALL_STORE_ID || n >= 1)) return n;
    } catch (_) {}
    return null;
  });
  const [shoppingList, setShoppingList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmPurchase, setConfirmPurchase] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    const unsub = subscribePendingCount(setPendingSyncCount);
    return unsub;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Valid: All store (-1) or a numeric store id >= 1
  const validStoreId =
    selectedStoreId != null &&
    (selectedStoreId === ALL_STORE_ID || (Number.isInteger(selectedStoreId) && selectedStoreId >= 1));

  useEffect(() => {
    if (!validStoreId) return;
    shoppingListRequestRef.current = { storeId: selectedStoreId };
    loadShoppingList();
  }, [selectedStoreId, validStoreId]);

  // After initial list load, flush any pending purchase updates from previous session (e.g. was offline)
  useEffect(() => {
    if (!validStoreId || loading) return;
    flushPurchaseQueue();
  }, [validStoreId, loading]);

  const persistStoreSelection = (value) => {
    try {
      if (value == null) localStorage.removeItem(STORE_STORAGE_KEY);
      else localStorage.setItem(STORE_STORAGE_KEY, String(value));
    } catch (_) {}
  };

  const loadStores = async () => {
    try {
      const response = await getStores();
      setStores(response.data || []);
      const current = selectedStoreId;
      const list = response.data || [];
      const currentIsValid =
        current === ALL_STORE_ID ||
        (typeof current === 'number' && list.some((s) => s.id === current));
      if (!currentIsValid) {
        setSelectedStoreId(ALL_STORE_ID);
        persistStoreSelection(ALL_STORE_ID);
      }
    } catch (err) {
      setError('Failed to load stores');
      console.error(err);
    }
  };

  const loadShoppingList = async () => {
    if (!validStoreId) return;
    const storeId = selectedStoreId;
    setLoading(true);
    setError(null);
    try {
      const response = await getShoppingList(storeId);
      const { storeId: currentStoreId } = shoppingListRequestRef.current;
      if (currentStoreId !== storeId) return;
      const items = response.data || [];
      setShoppingList(items);
    } catch (err) {
      const { storeId: currentStoreId } = shoppingListRequestRef.current;
      if (currentStoreId !== storeId) return;
      setError('Failed to load shopping list');
      console.error(err);
    } finally {
      const { storeId: currentStoreId } = shoppingListRequestRef.current;
      if (currentStoreId === storeId) setLoading(false);
    }
  };

  const handleTogglePurchased = async (itemName, currentPurchased) => {
    if (!currentPurchased) {
      const item = shoppingList.find(i => i.name === itemName);
      if (item) {
        setConfirmPurchase({ name: item.name, quantity: item.quantity || '1' });
        return;
      }
    }
    await doMarkPurchased(itemName, !currentPurchased);
  };

  const doMarkPurchased = async (itemName, purchased) => {
    setConfirmPurchase(null);
    if (purchased) {
      setShoppingList((s) => s.filter((i) => i.name !== itemName));
      queuePurchaseUpdate(itemName, purchased);
    } else {
      try {
        await markPurchased(itemName, false);
        loadShoppingList();
      } catch (_) {
        queuePurchaseUpdate(itemName, false);
      }
    }
  };

  const groupedByZone = shoppingList.reduce((acc, item) => {
    const zone = item.zone || 'Uncategorized';
    if (!acc[zone]) {
      acc[zone] = [];
    }
    acc[zone].push(item);
    return acc;
  }, {});

  const sortedZones = Object.keys(groupedByZone).sort((a, b) => {
    const aSeq = shoppingList.find(item => item.zone === a)?.zone_seq || 999;
    const bSeq = shoppingList.find(item => item.zone === b)?.zone_seq || 999;
    return aSeq - bSeq;
  });

  return (
    <div className="shopping-page page-scroll">
      <div className="shopping-header">
        <h1>Shopping List</h1>
        <div className="store-selector">
          <label htmlFor="store-select">Store:</label>
          <select
            id="store-select"
            value={selectedStoreId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              const id = parseInt(v, 10);
              if (!Number.isNaN(id)) {
                setSelectedStoreId(id);
                persistStoreSelection(id);
              }
            }}
            className="store-select"
          >
            {stores.map(store => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="shopping-page-body">
      {error && <div className="error-message">{error}</div>}

      {validStoreId && !loading && (
        <div className="shopping-sync-status" aria-live="polite">
          {!isOnline && (
            <span className="sync-status offline">Offline – changes saved locally</span>
          )}
          {isOnline && pendingSyncCount > 0 && (
            <span className="sync-status syncing">Syncing…</span>
          )}
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}

      {!loading && validStoreId && (
        <>
          <div className="shopping-list-container">
            {sortedZones.length === 0 && (
              <div className="empty-message">No items in shopping list</div>
            )}

            {sortedZones.map(zone => (
              <div key={zone} className="zone-section">
                <h2 className="zone-header">{zone}</h2>
                <div className="items-list">
                  {groupedByZone[zone].map(item => (
                    <div
                      key={item.name}
                      className="shopping-item"
                    >
                      <label className="item-checkbox">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => handleTogglePurchased(item.name, false)}
                        />
                        <span className="item-quantity">{item.quantity || '1'} ×</span>
                        <span className="item-name">{item.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!validStoreId && !loading && (
        <div className="empty-message">Please select a store to view your shopping list</div>
      )}
      </div>

      {confirmPurchase && (
        <div className="purchase-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="purchase-confirm-title">
          <div className="purchase-confirm-modal">
            <h2 id="purchase-confirm-title" className="purchase-confirm-title">
              Purchased {confirmPurchase.quantity} × {confirmPurchase.name}?
            </h2>
            <div className="purchase-confirm-actions">
              <button type="button" className="btn btn-primary" onClick={() => doMarkPurchased(confirmPurchase.name, true)}>
                Yes
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmPurchase(null)}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShoppingPage;
