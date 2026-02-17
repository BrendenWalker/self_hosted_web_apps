import React, { useState, useEffect } from 'react';
import { getStores, createStore, updateStore, deleteStore, getStoreZones, createStoreZone, deleteStoreZone, getDepartments } from '../api/api';
import './StorePage.css';

function StorePage() {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [zones, setZones] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [newStore, setNewStore] = useState({ name: '' });
  const [newZone, setNewZone] = useState({
    zonesequence: 1,
    zonename: '',
    departmentid: null
  });

  useEffect(() => {
    loadStores();
    loadDepartments();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      loadZones();
    }
  }, [selectedStore]);

  const loadStores = async () => {
    setLoading(true);
    try {
      const response = await getStores();
      setStores(response.data);
    } catch (err) {
      setError('Failed to load stores');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await getDepartments();
      setDepartments(response.data);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadZones = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const response = await getStoreZones(selectedStore.id);
      setZones(response.data);
    } catch (err) {
      setError('Failed to load store zones');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStore.name.trim()) {
      setError('Store name is required');
      return;
    }

    try {
      const response = await createStore(newStore);
      setStores([...stores, response.data]);
      setNewStore({ name: '' });
      setShowStoreForm(false);
      setError(null);
    } catch (err) {
      setError('Failed to create store');
      console.error(err);
    }
  };

  const handleUpdateStore = async (e) => {
    e.preventDefault();
    if (!editingStore.name.trim()) {
      setError('Store name is required');
      return;
    }

    try {
      const response = await updateStore(editingStore.id, { name: editingStore.name });
      setStores(stores.map(s => s.id === editingStore.id ? response.data : s));
      if (selectedStore && selectedStore.id === editingStore.id) {
        setSelectedStore(response.data);
      }
      setEditingStore(null);
      setError(null);
    } catch (err) {
      setError('Failed to update store');
      console.error(err);
    }
  };

  const handleDeleteStore = async (storeId) => {
    if (!window.confirm('Are you sure you want to delete this store? This will also delete all zones.')) {
      return;
    }

    try {
      await deleteStore(storeId);
      setStores(stores.filter(s => s.id !== storeId));
      if (selectedStore && selectedStore.id === storeId) {
        setSelectedStore(null);
        setZones([]);
      }
      setError(null);
    } catch (err) {
      setError('Failed to delete store');
      console.error(err);
    }
  };

  const handleCreateZone = async (e) => {
    e.preventDefault();
    if (!selectedStore) {
      setError('Please select a store first');
      return;
    }
    if (!newZone.zonename.trim() || !newZone.departmentid) {
      setError('Zone name and department are required');
      return;
    }

    try {
      await createStoreZone(selectedStore.id, newZone);
      setNewZone({
        zonesequence: Math.max(...zones.map(z => z.zonesequence), 0) + 1,
        zonename: '',
        departmentid: null
      });
      setShowZoneForm(false);
      await loadZones();
      setError(null);
    } catch (err) {
      setError('Failed to create zone');
      console.error(err);
    }
  };

  const handleDeleteZone = async (zoneSequence, departmentId) => {
    if (!window.confirm('Are you sure you want to delete this zone?')) {
      return;
    }

    try {
      await deleteStoreZone(selectedStore.id, zoneSequence, departmentId);
      await loadZones();
      setError(null);
    } catch (err) {
      setError('Failed to delete zone');
      console.error(err);
    }
  };

  const sortedZones = [...zones].sort((a, b) => {
    if (a.zonesequence !== b.zonesequence) {
      return a.zonesequence - b.zonesequence;
    }
    return a.department_name.localeCompare(b.department_name);
  });

  return (
    <div className="store-page">
      <div className="page-header">
        <h1>Store Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowStoreForm(!showStoreForm);
            setEditingStore(null);
            setNewStore({ name: '' });
          }}
        >
          {showStoreForm ? 'Cancel' : '+ New Store'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showStoreForm && (
        <div className="store-form">
          <h2>{editingStore ? 'Edit Store' : 'Create New Store'}</h2>
          <form onSubmit={editingStore ? handleUpdateStore : handleCreateStore}>
            <div className="form-group">
              <label>Store Name *</label>
              <input
                type="text"
                value={editingStore ? editingStore.name : newStore.name}
                onChange={(e) => {
                  if (editingStore) {
                    setEditingStore({ ...editingStore, name: e.target.value });
                  } else {
                    setNewStore({ name: e.target.value });
                  }
                }}
                placeholder="Enter store name"
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingStore ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="stores-list">
        <h2>Stores</h2>
        {loading && <div className="loading">Loading...</div>}
        {!loading && stores.length === 0 && (
          <div className="empty-message">No stores yet. Create one to get started.</div>
        )}
        {!loading && stores.map(store => (
          <div
            key={store.id}
            className={`store-card ${selectedStore?.id === store.id ? 'selected' : ''}`}
            onClick={() => setSelectedStore(store)}
          >
            <div className="store-card-main">
              <h3>{store.name}</h3>
            </div>
            <div className="store-card-actions">
              <button
                className="btn btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingStore(store);
                  setShowStoreForm(true);
                }}
              >
                Edit
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteStore(store.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedStore && (
        <div className="zones-section">
          <div className="zones-header">
            <h2>Store Layout: {selectedStore.name}</h2>
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowZoneForm(!showZoneForm);
                setNewZone({
                  zonesequence: Math.max(...zones.map(z => z.zonesequence), 0) + 1,
                  zonename: '',
                  departmentid: null
                });
              }}
            >
              {showZoneForm ? 'Cancel' : '+ Add Zone'}
            </button>
          </div>

          {showZoneForm && (
            <div className="zone-form">
              <h3>Add Zone</h3>
              <form onSubmit={handleCreateZone}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Zone Sequence *</label>
                    <input
                      type="number"
                      value={newZone.zonesequence}
                      onChange={(e) => setNewZone({ ...newZone, zonesequence: parseInt(e.target.value) || 1 })}
                      min="1"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Zone Name *</label>
                    <input
                      type="text"
                      value={newZone.zonename}
                      onChange={(e) => setNewZone({ ...newZone, zonename: e.target.value })}
                      placeholder="e.g., Produce, Dairy, etc."
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Department *</label>
                    <select
                      value={newZone.departmentid || ''}
                      onChange={(e) => setNewZone({ ...newZone, departmentid: e.target.value ? parseInt(e.target.value) : null })}
                      required
                    >
                      <option value="">Select department...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Add Zone</button>
                </div>
              </form>
            </div>
          )}

          {loading && <div className="loading">Loading zones...</div>}
          {!loading && sortedZones.length === 0 && (
            <div className="empty-message">No zones configured. Add zones to organize your shopping list by store layout.</div>
          )}
          {!loading && sortedZones.length > 0 && (
            <div className="zones-list">
              {sortedZones.map((zone, index) => (
                <div key={`${zone.zonesequence}-${zone.departmentid}`} className="zone-item">
                  <div className="zone-item-main">
                    <div className="zone-sequence">{zone.zonesequence}</div>
                    <div className="zone-info">
                      <div className="zone-name">{zone.zonename}</div>
                      <div className="zone-department">{zone.department_name}</div>
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteZone(zone.zonesequence, zone.departmentid)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StorePage;
