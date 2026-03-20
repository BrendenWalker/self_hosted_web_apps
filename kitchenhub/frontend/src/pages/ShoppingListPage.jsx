import React, { useState, useEffect } from 'react';
import {
  getAllShoppingList,
  getItems,
  getDepartments,
  getIngredientMeasurements,
  createItem,
  updateItem,
  deleteItem,
  addToShoppingList,
  removeFromShoppingList,
  updateShoppingListItem,
} from '../api/api';
import './ShoppingListPage.css';

function ShoppingListPage() {
  const [shoppingList, setShoppingList] = useState([]);
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [itemFilter, setItemFilter] = useState('');
  const [activeTab, setActiveTab] = useState('shopping-list'); // 'items' or 'shopping-list'
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [itemForm, setItemForm] = useState({
    name: '',
    department: null,
    details: '',
    kcal: '',
    kcal_qty: '',
    measurement_id: '',
    shopping_measure: '',
    shopping_measure_grams: '',
  });
  const [highlightItemId, setHighlightItemId] = useState(null);
  const itemRowRefs = React.useRef({});
  const addInProgressRef = React.useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!showItemForm) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getIngredientMeasurements();
        if (!cancelled) setMeasurements(res.data || []);
      } catch (err) {
        console.error('Failed to load measurements', err);
        if (!cancelled) setMeasurements([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showItemForm]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, itemsRes, deptRes] = await Promise.all([
        getAllShoppingList(),
        getItems(),
        getDepartments()
      ]);
      setShoppingList(listRes.data);
      setItems(itemsRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const msg = data?.message || data?.error || err.message || 'Unknown error';
      const detail = status ? ` (${status}: ${msg})` : ` (${msg})`;
      setError('Failed to load data' + detail);
      console.error('ShoppingListPage loadData failed:', { status, message: msg, err });
    } finally {
      setLoading(false);
    }
  };

  const isItemInShoppingList = (itemName) => {
    return shoppingList.some(slItem => slItem.name === itemName);
  };

  const getShoppingListItem = (itemName) => {
    return shoppingList.find(slItem => slItem.name === itemName);
  };

  const handleAddToShoppingList = async (item) => {
    const key = item.name;
    if (addInProgressRef.current === key) return;
    addInProgressRef.current = key;
    try {
      const existingItem = getShoppingListItem(item.name);
      if (existingItem) {
        const currentQty = parseInt(existingItem.quantity) || 1;
        const newQuantity = String(currentQty + 1);
        setShoppingList((prev) =>
          prev.map((i) => (i.name === item.name ? { ...i, quantity: newQuantity } : i))
        );
        try {
          await updateShoppingListItem(item.name, { quantity: newQuantity });
        } catch (err) {
          setError('Failed to add item to shopping list');
          console.error(err);
          await loadData();
        }
        return;
      }
      const newEntry = {
        name: item.name,
        description: item.name,
        quantity: '1',
        department_id: item.department || null,
        item_id: item.id,
        department_name: departments.find((d) => d.id === item.department)?.name || null,
        purchased: 0,
      };
      setShoppingList((prev) => [...prev, newEntry]);
      try {
        await addToShoppingList(newEntry);
      } catch (err) {
        setError('Failed to add item to shopping list');
        console.error(err);
        await loadData();
      }
    } finally {
      addInProgressRef.current = null;
    }
  };

  const handleRemoveFromShoppingList = async (itemName) => {
    setShoppingList((prev) => prev.filter((i) => i.name !== itemName));
    try {
      await removeFromShoppingList(itemName);
    } catch (err) {
      setError('Failed to remove item from shopping list');
      console.error(err);
      await loadData();
    }
  };

  const handleUpdateQuantity = async (itemName, newQuantity) => {
    const num = parseInt(String(newQuantity), 10);
    if (num === 0) {
      await handleRemoveFromShoppingList(itemName);
      return;
    }
    if (Number.isNaN(num) || num < 1) return;
    setShoppingList((prev) =>
      prev.map((i) => (i.name === itemName ? { ...i, quantity: String(num) } : i))
    );
    try {
      await updateShoppingListItem(itemName, { quantity: String(num) });
    } catch (err) {
      setError('Failed to update quantity');
      console.error(err);
      await loadData();
    }
  };

  const handleIncrementQuantity = (item) => {
    const current = parseInt(item.quantity, 10) || 1;
    const next = current + 1;
    setShoppingList((prev) =>
      prev.map((i) => (i.name === item.name ? { ...i, quantity: String(next) } : i))
    );
    handleUpdateQuantity(item.name, next);
  };

  const handleDecrementQuantity = (item, quantityFromButton) => {
    const parsed = parseInt(String(quantityFromButton ?? item.quantity ?? 1), 10);
    if (Number.isNaN(parsed) || parsed < 1) return;
    const next = parsed - 1;
    setShoppingList((prev) =>
      prev.map((i) => (i.name === item.name ? { ...i, quantity: String(next) } : i))
    );
    handleUpdateQuantity(item.name, next);
  };

  const handleItemDoubleClick = (item) => {
    // Double-click always adds/increments
    handleAddToShoppingList(item);
  };

  const itemToFormFields = (item) => ({
    name: item?.name || '',
    department: item?.department ?? null,
    details: item?.details ?? '',
    kcal: item?.kcal != null && item.kcal !== '' ? String(item.kcal) : '',
    kcal_qty: item?.kcal_qty != null && item.kcal_qty !== '' ? String(item.kcal_qty) : '',
    measurement_id:
      item?.measurement_id != null && item.measurement_id !== '' ? String(item.measurement_id) : '',
    shopping_measure: item?.shopping_measure ?? '',
    shopping_measure_grams:
      item?.shopping_measure_grams != null && item.shopping_measure_grams !== ''
        ? String(item.shopping_measure_grams)
        : '',
  });

  const handleEditItem = (item) => {
    setEditingItem(item);
    setItemForm(itemToFormFields(item));
    setShowItemForm(true);
  };

  const handleCreateItem = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      department: null,
      details: '',
      kcal: '',
      kcal_qty: '',
      measurement_id: '',
      shopping_measure: '',
      shopping_measure_grams: '',
    });
    setShowItemForm(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name.trim()) {
      setError('Item name is required');
      return;
    }

    try {
      const optional = {
        details: itemForm.details?.trim() || null,
        kcal: itemForm.kcal === '' ? null : itemForm.kcal,
        kcal_qty: itemForm.kcal_qty === '' ? null : itemForm.kcal_qty,
        measurement_id: itemForm.measurement_id === '' ? null : itemForm.measurement_id,
        shopping_measure: itemForm.shopping_measure?.trim() || null,
        shopping_measure_grams:
          itemForm.shopping_measure_grams === '' ? null : itemForm.shopping_measure_grams,
      };

      if (editingItem) {
        await updateItem(editingItem.id, {
          name: itemForm.name.trim(),
          department: itemForm.department || null,
          ...optional,
        });
      } else {
        await createItem({
          name: itemForm.name.trim(),
          department: itemForm.department || null,
          qty: 0,
          ...optional,
        });
      }
      
      setShowItemForm(false);
      setEditingItem(null);
      await loadData();
    } catch (err) {
      const data = err.response?.data;
      const detail = data?.detail || data?.error;
      setError(detail ? `${detail}` : `Failed to ${editingItem ? 'update' : 'create'} item`);
      // If server tells us which item conflicts, switch to Items tab and show it
      const existingItem = data?.existingItem;
      if (existingItem?.id != null && existingItem?.name) {
        setActiveTab('items');
        setItemFilter(existingItem.name);
        setHighlightItemId(existingItem.id);
        setTimeout(() => setHighlightItemId(null), 5000);
      }
      console.error(err);
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`Delete item "${itemName}"? This will also remove it from any shopping lists.`)) {
      return;
    }

    try {
      await deleteItem(itemId);
      await loadData();
    } catch (err) {
      setError('Failed to delete item');
      console.error(err);
    }
  };

  // Filter items based on search text
  const filteredItems = items.filter(item => {
    const searchText = itemFilter.toLowerCase();
    return (
      item.name.toLowerCase().includes(searchText) ||
      (item.department_name && item.department_name.toLowerCase().includes(searchText))
    );
  });

  // Group items by department for better organization
  const itemsByDepartment = filteredItems.reduce((acc, item) => {
    const deptName = item.department_name || 'Uncategorized';
    if (!acc[deptName]) {
      acc[deptName] = [];
    }
    acc[deptName].push(item);
    return acc;
  }, {});

  const sortedDepartments = Object.keys(itemsByDepartment).sort();

  // On your list: exclude purchased items
  const unpurchasedList = shoppingList.filter(item => !item.purchased || item.purchased === 0);

  // Scroll conflicting item into view when we highlight it
  useEffect(() => {
    if (highlightItemId == null) return;
    const el = itemRowRefs.current[highlightItemId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightItemId]);

  return (
    <div className="shopping-list-page page-scroll">
      <div className="page-header">
        <h1>Shopping List</h1>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={handleCreateItem}
          >
            + New Item
          </button>
          <div className="tabs">
            <button
              className={`tab-button ${activeTab === 'items' ? 'active' : ''}`}
              onClick={() => setActiveTab('items')}
            >
              All items
            </button>
            <button
              className={`tab-button ${activeTab === 'shopping-list' ? 'active' : ''}`}
              onClick={() => setActiveTab('shopping-list')}
            >
              On your list ({unpurchasedList.length})
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showItemForm && (
        <div className="item-form-modal">
          <div className="item-form-content">
            <div className="item-form-header">
              <h2>{editingItem ? 'Edit Item' : 'Create New Item'}</h2>
              <button
                className="btn-close"
                onClick={() => {
                  setShowItemForm(false);
                  setEditingItem(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div className="form-group">
                <label>Item Name *</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="Enter item name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <select
                  value={itemForm.department || ''}
                  onChange={(e) => setItemForm({ ...itemForm, department: e.target.value ? parseInt(e.target.value) : null })}
                >
                  <option value="">None</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Details (brand, package, variant)</label>
                <textarea
                  rows={3}
                  value={itemForm.details}
                  onChange={(e) => setItemForm({ ...itemForm, details: e.target.value })}
                  placeholder="e.g. Brand X, 12 oz can"
                />
              </div>
              <div className="form-group">
                <label className="kcal-row-label">Calories (optional)</label>
                <div className="kcal-row" role="group" aria-label="Calories per amount and unit">
                  <span className="kcal-row-text">Kcal</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="kcal-row-input kcal-row-input-kcal"
                    value={itemForm.kcal}
                    onChange={(e) => setItemForm({ ...itemForm, kcal: e.target.value })}
                    placeholder="—"
                    aria-label="Kilocalories"
                  />
                  <span className="kcal-row-text kcal-row-per">per</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="kcal-row-input kcal-row-input-qty"
                    value={itemForm.kcal_qty}
                    onChange={(e) => setItemForm({ ...itemForm, kcal_qty: e.target.value })}
                    placeholder="qty"
                    aria-label="Amount for kcal"
                  />
                  <select
                    className="kcal-row-select"
                    value={itemForm.measurement_id}
                    onChange={(e) => setItemForm({ ...itemForm, measurement_id: e.target.value })}
                    aria-label="Measurement unit"
                  >
                    <option value="">unit…</option>
                    {measurements.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="form-help-text subtle kcal-row-hint">
                  Example: 50 kcal per 2 tbsp → 50, 2, tablespoon.
                </p>
              </div>
              <div className="form-group">
                <label>Shopping measure (how you buy it)</label>
                <input
                  type="text"
                  value={itemForm.shopping_measure}
                  onChange={(e) => setItemForm({ ...itemForm, shopping_measure: e.target.value })}
                  placeholder="e.g. each, 12 oz can, bunch, loaf"
                />
              </div>
              <div className="form-group">
                <label>Grams in shopping measure</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={itemForm.shopping_measure_grams}
                  onChange={(e) => setItemForm({ ...itemForm, shopping_measure_grams: e.target.value })}
                  placeholder="Grams per unit above"
                />
              </div>
              <div className="form-group">
                <p className="form-help-text">
                  <strong>Shopping list:</strong> quantity is adjusted with +/− on the list, not in this form.
                </p>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowItemForm(false);
                  setEditingItem(null);
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingItem ? 'Update' : 'Create'} Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="shopping-list-page-content">
      {activeTab === 'items' && (
        <>
          <div className="filter-section">
            <input
              type="text"
              placeholder="Filter items by name or department..."
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              className="filter-input"
              autoFocus
            />
            <div className="filter-info">
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
            </div>
          </div>

          {loading && <div className="loading">Loading...</div>}

          {!loading && (
            <div className="items-list-container">
              {filteredItems.length === 0 ? (
                <div className="empty-message">
                  {itemFilter ? 'No items match your search' : 'No items found'}
                </div>
              ) : (
                sortedDepartments.map(deptName => (
                  <div key={deptName} className="department-group">
                    <h2 className="department-header">{deptName}</h2>
                    <div className="items-list">
                      {itemsByDepartment[deptName].map(item => {
                        const inList = isItemInShoppingList(item.name);
                        const shoppingListItem = getShoppingListItem(item.name);
                        return (
                          <div
                            key={item.id}
                            ref={r => { itemRowRefs.current[item.id] = r; }}
                            className={`item-row ${inList ? 'in-shopping-list' : ''} ${highlightItemId === item.id ? 'item-row-highlight' : ''}`}
                            onDoubleClick={() => handleItemDoubleClick(item)}
                            title="Double-click to add/remove from shopping list"
                          >
                            <div className="item-info">
                              <div className="item-name">{item.name}</div>
                            </div>
                            <div className="item-actions">
                              <div className="quantity-control">
                                <button
                                  type="button"
                                  className="btn btn-quantity"
                                  disabled={!inList}
                                  data-quantity={String(shoppingListItem?.quantity ?? 1)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!inList) return;
                                    const q = e.currentTarget.getAttribute('data-quantity');
                                    handleDecrementQuantity(
                                      { name: item.name, quantity: shoppingListItem?.quantity },
                                      q
                                    );
                                  }}
                                  aria-label="Decrease quantity"
                                  title={inList ? "Decrease quantity (remove when 1)" : "Add to list first"}
                                >
                                  −
                                </button>
                                <input
                                  type="text"
                                  className="quantity-input"
                                  value={inList ? (shoppingListItem?.quantity || '') : '0'}
                                  onChange={(e) => inList && handleUpdateQuantity(item.name, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => e.stopPropagation()}
                                  placeholder="Qty"
                                  readOnly={!inList}
                                  aria-label="Quantity"
                                />
                                <button
                                  type="button"
                                  className="btn btn-quantity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToShoppingList(item);
                                  }}
                                  aria-label="Increase quantity"
                                  title={inList ? "Add another (increment quantity)" : "Add to shopping list"}
                                >
                                  +
                                </button>
                              </div>
                              <div className="item-actions-meta">
                                <button
                                  type="button"
                                  className="btn btn-edit"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditItem(item);
                                  }}
                                  title="Edit item"
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItem(item.id, item.name);
                                  }}
                                  title="Delete item"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'shopping-list' && (
        <>
          <div className="shopping-list-section">
            <div className="shopping-list-toolbar">
              <button
                className="btn btn-primary"
                onClick={() => setActiveTab('items')}
              >
                Add items
              </button>
            </div>
            {loading && <div className="loading">Loading...</div>}

            {!loading && (
              <div className="shopping-list-items">
                {unpurchasedList.length === 0 ? (
                  <div className="empty-message">No items in shopping list</div>
                ) : (
                  unpurchasedList.map(item => (
                    <div key={item.name} className="list-item">
                      <div className="list-item-main">
                        <div className="list-item-name">{item.name}</div>
                        {item.description && item.description !== item.name && (
                          <div className="list-item-desc">{item.description}</div>
                        )}
                        {item.department_name && (
                          <div className="list-item-dept">{item.department_name}</div>
                        )}
                      </div>
                      <div className="list-item-actions">
                        <div className="quantity-control">
                          <button
                            type="button"
                            className="btn btn-quantity"
                            data-quantity={String(item.quantity ?? 1)}
                            onClick={(e) => {
                              e.stopPropagation();
                              const q = e.currentTarget.getAttribute('data-quantity');
                              handleDecrementQuantity(item, q);
                            }}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <input
                            type="text"
                            className="quantity-input"
                            value={item.quantity || ''}
                            onChange={(e) => handleUpdateQuantity(item.name, e.target.value)}
                            placeholder="Qty"
                          />
                          <button
                            type="button"
                            className="btn btn-quantity"
                            onClick={() => handleIncrementQuantity(item)}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveFromShoppingList(item.name)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

export default ShoppingListPage;
