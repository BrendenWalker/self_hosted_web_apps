import React, { useState, useEffect } from 'react';
import { getStores, getShoppingList, markPurchased } from '../api/api';
import './ShoppingPage.css';

function ShoppingPage() {
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [shoppingList, setShoppingList] = useState([]);
  const [purchasedItems, setPurchasedItems] = useState([]);
  const [showPurchased, setShowPurchased] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStores();
  }, []);

  // Only fetch when we have a valid store id (positive integer); avoids /api/shopping-list/-1 or NaN
  const validStoreId = selectedStoreId != null && !Number.isNaN(Number(selectedStoreId)) && Number(selectedStoreId) >= 1;

  useEffect(() => {
    if (validStoreId) {
      loadShoppingList();
    }
  }, [selectedStoreId, showPurchased, validStoreId]);

  const loadStores = async () => {
    try {
      const response = await getStores();
      setStores(response.data);
      if (response.data.length > 0 && !selectedStoreId) {
        setSelectedStoreId(response.data[0].id);
      }
    } catch (err) {
      setError('Failed to load stores');
      console.error(err);
    }
  };

  const loadShoppingList = async () => {
    if (!validStoreId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getShoppingList(selectedStoreId, showPurchased);
      const items = response.data;
      const purchased = items.filter(item => item.purchased === 1);
      const unpurchased = items.filter(item => !item.purchased || item.purchased === 0);
      
      setPurchasedItems(purchased);
      setShoppingList(unpurchased);
    } catch (err) {
      setError('Failed to load shopping list');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePurchased = async (itemName, currentPurchased) => {
    try {
      const newPurchased = !currentPurchased;
      await markPurchased(itemName, newPurchased);
      await loadShoppingList();
    } catch (err) {
      setError('Failed to update item');
      console.error(err);
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
    <div className="shopping-page">
      <div className="shopping-header">
        <h1>Shopping List</h1>
        <div className="store-selector">
          <label htmlFor="store-select">Store:</label>
          <select
            id="store-select"
            value={selectedStoreId || ''}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedStoreId(v === '' ? null : parseInt(v, 10));
            }}
            className="store-select"
          >
            <option value="">Select a store...</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>
        <label className="toggle-purchased">
          <input
            type="checkbox"
            checked={showPurchased}
            onChange={(e) => setShowPurchased(e.target.checked)}
          />
          Show Purchased
        </label>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading && <div className="loading">Loading...</div>}

      {!loading && validStoreId && (
        <>
          <div className="shopping-list-container">
            {sortedZones.length === 0 && !showPurchased && (
              <div className="empty-message">No items in shopping list</div>
            )}

            {sortedZones.map(zone => (
              <div key={zone} className="zone-section">
                <h2 className="zone-header">{zone}</h2>
                <div className="items-list">
                  {groupedByZone[zone].map(item => (
                    <div
                      key={item.name}
                      className={`shopping-item ${item.purchased ? 'purchased' : ''}`}
                    >
                      <label className="item-checkbox">
                        <input
                          type="checkbox"
                          checked={item.purchased === 1}
                          onChange={() => handleTogglePurchased(item.name, item.purchased === 1)}
                        />
                        <span className="item-name">{item.name}</span>
                      </label>
                      {item.description && (
                        <span className="item-description">{item.description}</span>
                      )}
                      {item.quantity && (
                        <span className="item-quantity">{item.quantity}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {showPurchased && purchasedItems.length > 0 && (
            <div className="purchased-section">
              <h2>Purchased Items</h2>
              <div className="items-list">
                {purchasedItems.map(item => (
                  <div
                    key={item.name}
                    className="shopping-item purchased"
                  >
                    <label className="item-checkbox">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => handleTogglePurchased(item.name, true)}
                      />
                      <span className="item-name">{item.name}</span>
                    </label>
                    {item.description && (
                      <span className="item-description">{item.description}</span>
                    )}
                    {item.quantity && (
                      <span className="item-quantity">{item.quantity}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!validStoreId && !loading && (
        <div className="empty-message">Please select a store to view your shopping list</div>
      )}
    </div>
  );
}

export default ShoppingPage;
