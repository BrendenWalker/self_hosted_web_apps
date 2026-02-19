import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  getStores,
  createStore,
  updateStore,
  deleteStore,
  getStoreZones,
  createStoreZone,
  deleteStoreZone,
  getDepartments,
  swapStoreZones,
} from '../api/api';
import './StorePage.css';

const ALL_STORE_ID = -1;

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
    departmentIds: [],
  });
  const [selectedZoneSequence, setSelectedZoneSequence] = useState(null);
  const selectedStoreIdRef = useRef(null);

  useEffect(() => {
    loadStores();
    loadDepartments();
  }, []);

  useEffect(() => {
    selectedStoreIdRef.current = selectedStore?.id ?? null;
    if (selectedStore) {
      loadZones();
    } else {
      setZones([]);
      setSelectedZoneSequence(null);
    }
  }, [selectedStore]);

  // Store editor only shows editable stores (exclude synthetic All)
  const editableStores = useMemo(
    () => (stores || []).filter((s) => s.id !== ALL_STORE_ID),
    [stores]
  );

  const loadStores = async () => {
    setLoading(true);
    try {
      const response = await getStores();
      const nextStores = response.data || [];
      setStores(nextStores);
      const editable = nextStores.filter((s) => s.id !== ALL_STORE_ID);

      // Auto-select first editable store (no "Select a store" placeholder).
      setSelectedStore((prev) => {
        if (prev && editable.some((s) => s.id === prev.id)) return prev;
        return editable[0] || null;
      });
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
    const storeId = selectedStore.id;
    setLoading(true);
    setError(null);
    try {
      const response = await getStoreZones(storeId);
      if (selectedStoreIdRef.current !== storeId) return;
      const nextZones = response.data || [];
      setZones(nextZones);

      setSelectedZoneSequence((prev) => {
        if (nextZones.length === 0) return null;
        const seqs = Array.from(
          new Set(nextZones.map((z) => z.zonesequence))
        ).sort((a, b) => a - b);

        if (prev != null && seqs.includes(prev)) return prev;
        return seqs[0];
      });
    } catch (err) {
      if (selectedStoreIdRef.current !== storeId) return;
      setError('Failed to load store zones');
      console.error(err);
    } finally {
      if (selectedStoreIdRef.current === storeId) setLoading(false);
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
      setSelectedStore(response.data);
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
    if (storeId === ALL_STORE_ID) return;
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
    if (!selectedStore || isAllStore) {
      if (!selectedStore) setError('Please select a store first');
      return;
    }
    if (!newZone.zonename.trim()) {
      setError('Zone name is required');
      return;
    }
    if (!newZone.departmentIds || newZone.departmentIds.length === 0) {
      setError('Select at least one department for the new zone');
      return;
    }

    try {
      // Create a storezones row for each selected department
      await Promise.all(
        newZone.departmentIds.map((deptId) =>
          createStoreZone(selectedStore.id, {
            zonesequence: newZone.zonesequence,
            zonename: newZone.zonename,
            departmentid: deptId,
          })
        )
      );

      const nextSequence = Math.max(...zones.map((z) => z.zonesequence), 0) + 1;
      setNewZone({
        zonesequence: nextSequence,
        zonename: '',
        departmentIds: [],
      });
      setShowZoneForm(false);
      await loadZones();
      setError(null);
    } catch (err) {
      setError('Failed to create zone');
      console.error(err);
    }
  };

  const handleDeleteZone = async (zoneSequence) => {
    if (!selectedStore || isAllStore) return;
    if (!window.confirm('Are you sure you want to delete this zone and all of its departments?')) {
      return;
    }

    try {
      const zoneRows = zones.filter((z) => z.zonesequence === zoneSequence);
      await Promise.all(
        zoneRows.map((z) => deleteStoreZone(selectedStore.id, z.zonesequence, z.departmentid))
      );
      await loadZones();
      setError(null);
    } catch (err) {
      setError('Failed to delete zone');
      console.error(err);
    }
  };

  const handleMoveZone = async (zoneSequence, direction) => {
    if (!selectedStore || isAllStore) return;

    const zoneGroups = groupedZones;
    const index = zoneGroups.findIndex((z) => z.zonesequence === zoneSequence);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= zoneGroups.length) return;

    const currentSeq = zoneGroups[index].zonesequence;
    const targetSeq = zoneGroups[targetIndex].zonesequence;

    try {
      await swapStoreZones(selectedStore.id, currentSeq, targetSeq);
      await loadZones();
      setSelectedZoneSequence(targetSeq);
      setError(null);
    } catch (err) {
      setError('Failed to reorder zones');
      console.error(err);
    }
  };

  const isAllStore = selectedStore?.id === ALL_STORE_ID;

  const handleAddDepartmentToZone = async (departmentId) => {
    if (!selectedStore || selectedZoneSequence == null) {
      setError('Please select a zone first');
      return;
    }
    if (isAllStore) return;

    const zone = groupedZones.find((z) => z.zonesequence === selectedZoneSequence);
    if (!zone) return;

    try {
      await createStoreZone(selectedStore.id, {
        zonesequence: zone.zonesequence,
        zonename: zone.zonename || 'General',
        departmentid: Number(departmentId),
      });
      await loadZones();
      setError(null);
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Failed to assign department to zone';
      const detail = err.response?.data?.detail;
      setError(detail ? `${msg}: ${detail}` : msg);
      console.error(err);
    }
  };

  const handleRemoveDepartmentFromZone = async (departmentId) => {
    if (!selectedStore || selectedZoneSequence == null || isAllStore) return;

    try {
      await deleteStoreZone(selectedStore.id, selectedZoneSequence, departmentId);
      await loadZones();
      setError(null);
    } catch (err) {
      setError('Failed to remove department from zone');
      console.error(err);
    }
  };

  const groupedZones = useMemo(() => {
    const map = new Map();
    zones.forEach((z) => {
      if (!map.has(z.zonesequence)) {
        map.set(z.zonesequence, {
          zonesequence: z.zonesequence,
          zonename: z.zonename,
          departments: [],
        });
      }
      const group = map.get(z.zonesequence);
      group.departments.push({
        id: z.departmentid,
        name: z.department_name,
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.zonesequence !== b.zonesequence) {
        return a.zonesequence - b.zonesequence;
      }
      return a.zonename.localeCompare(b.zonename);
    });
  }, [zones]);

  const assignedDepartmentIds = useMemo(
    () => new Set(zones.map((z) => z.departmentid)),
    [zones]
  );

  const availableDepartments = departments.filter(
    (dept) => !assignedDepartmentIds.has(dept.id)
  );

  const selectedZone = groupedZones.find(
    (z) => z.zonesequence === selectedZoneSequence
  );

  const sortedAvailableDepartments = [...availableDepartments].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const nextZoneSequenceDefault =
    Math.max(...zones.map((z) => z.zonesequence), 0) + 1;

  const TrashIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  );

  return (
    <div className="store-page">
      <div className="page-header store-page-header">
        <h1>Store Management</h1>
        <div className="store-toolbar">
          <select
            className="store-dropdown"
            value={selectedStore?.id ?? editableStores[0]?.id ?? ''}
            onChange={(e) => {
              const id = e.target.value ? parseInt(e.target.value, 10) : null;
              const store = editableStores.find((s) => s.id === id) || null;
              setSelectedStore(store);
            }}
            disabled={loading || editableStores.length === 0}
            aria-label="Select store"
          >
            {editableStores.length === 0 ? (
              <option value="">No stores</option>
            ) : (
              editableStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!selectedStore || isAllStore}
            onClick={() => {
              if (selectedStore && !isAllStore) {
                setEditingStore(selectedStore);
                setShowStoreForm(true);
              }
            }}
            title={isAllStore ? 'The All store cannot be renamed' : undefined}
          >
            Rename
          </button>
          <button
            type="button"
            className="icon-btn danger"
            aria-label="Delete store"
            title={isAllStore ? 'The All store cannot be deleted' : 'Delete store'}
            disabled={!selectedStore || isAllStore}
            onClick={() => selectedStore && handleDeleteStore(selectedStore.id)}
          >
            <TrashIcon />
          </button>
        </div>
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

      {!loading && stores.length === 0 && !showStoreForm && (
        <div className="empty-message">
          No stores yet. Create one to get started.
        </div>
      )}

      {selectedStore && (
          <div className="zones-section">
            {isAllStore && (
              <div className="empty-message small" style={{ marginBottom: '1rem' }}>
                The <strong>All</strong> store is read-only. All departments are shown in the General zone; no storezones entries are used.
              </div>
            )}
            <div className="zones-header">
              <h2>Store Layout: {selectedStore.name}</h2>
              {!isAllStore && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowZoneForm(!showZoneForm);
                    setNewZone({
                      zonesequence: nextZoneSequenceDefault,
                      zonename: '',
                      departmentIds: [],
                    });
                  }}
                >
                  {showZoneForm ? 'Cancel' : '+ Add Zone'}
                </button>
              )}
            </div>

            {showZoneForm && !isAllStore && (
              <div className="zone-form">
                <h3>Add Zone</h3>
                <form onSubmit={handleCreateZone}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Zone Sequence *</label>
                      <input
                        type="number"
                        value={newZone.zonesequence}
                        onChange={(e) =>
                          setNewZone({
                            ...newZone,
                            zonesequence: parseInt(e.target.value, 10) || 1,
                          })
                        }
                        min="1"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Zone Name *</label>
                      <input
                        type="text"
                        value={newZone.zonename}
                        onChange={(e) =>
                          setNewZone({ ...newZone, zonename: e.target.value })
                        }
                        placeholder="e.g., Produce, Dairy, etc."
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Departments in this Zone *</label>
                      <select
                        multiple
                        value={newZone.departmentIds.map(String)}
                        onChange={(e) => {
                          const options = Array.from(e.target.selectedOptions);
                          const ids = options.map((opt) => parseInt(opt.value, 10));
                          setNewZone({ ...newZone, departmentIds: ids });
                        }}
                      >
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                      <p className="form-help-text">
                        Hold Ctrl (Cmd on Mac) to select multiple departments.
                      </p>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">
                      Add Zone
                    </button>
                  </div>
                </form>
              </div>
            )}

            {loading && <div className="loading">Loading zones...</div>}
            {!loading && groupedZones.length === 0 && (
              <div className="empty-message">
                No zones configured. Add zones to organize your shopping list by
                store layout.
              </div>
            )}

            {!loading && groupedZones.length > 0 && (
              <div className="zones-layout">
                <div className="zones-list-panel">
                  <h3>Zones</h3>
                  <div className="zones-list">
                    {groupedZones.map((zone) => (
                      <div
                        key={zone.zonesequence}
                        className={`zone-item ${
                          selectedZoneSequence === zone.zonesequence
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() =>
                          setSelectedZoneSequence(zone.zonesequence)
                        }
                      >
                        <div className="zone-item-main">
                          <div className="zone-sequence">
                            {zone.zonesequence}
                          </div>
                          <div className="zone-info">
                            <div className="zone-name">{zone.zonename}</div>
                            <div className="zone-department">
                              {zone.departments.length} department
                              {zone.departments.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="zone-item-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Move zone up"
                            disabled={isAllStore || groupedZones[0]?.zonesequence === zone.zonesequence}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedZoneSequence(zone.zonesequence);
                              handleMoveZone(zone.zonesequence, 'up');
                            }}
                            title="Move up"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 4l-7 7h4v9h6v-9h4z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Move zone down"
                            disabled={isAllStore || groupedZones[groupedZones.length - 1]?.zonesequence === zone.zonesequence}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedZoneSequence(zone.zonesequence);
                              handleMoveZone(zone.zonesequence, 'down');
                            }}
                            title="Move down"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 20l7-7h-4V4H9v9H5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            aria-label="Delete zone"
                            disabled={isAllStore}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedZoneSequence(zone.zonesequence);
                              handleDeleteZone(zone.zonesequence);
                            }}
                            title="Delete zone"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="zone-departments-panel">
                  <div className="zone-departments-column">
                    <h3>Departments in Zone</h3>
                    <div className="zone-departments-list">
                      {!selectedZone || selectedZone.departments.length === 0 ? (
                        <div className="empty-message small">
                          {selectedZone
                            ? 'No departments assigned to this zone.'
                            : 'Select a zone to see its departments.'}
                        </div>
                      ) : (
                        selectedZone.departments
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((dept) => (
                            <div key={dept.id} className="dept-item">
                              <span>{dept.name}</span>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={isAllStore}
                                onClick={() =>
                                  handleRemoveDepartmentFromZone(dept.id)
                                }
                              >
                                Remove
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="zone-departments-column">
                    <h3>Available Departments</h3>
                    <div className="zone-departments-list">
                      {sortedAvailableDepartments.length === 0 ? (
                        <div className="empty-message small">
                          All departments are assigned to zones for this store.
                        </div>
                      ) : (
                        sortedAvailableDepartments.map((dept) => (
                          <div key={dept.id} className="dept-item">
                            <span>{dept.name}</span>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={!selectedZone || isAllStore}
                              onClick={() =>
                                handleAddDepartmentToZone(dept.id)
                              }
                            >
                              Add to Zone
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

export default StorePage;
