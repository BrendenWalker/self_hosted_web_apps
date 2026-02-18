import React, { useState, useEffect } from 'react';
import { getServiceTypes, createServiceType, updateServiceType, deleteServiceType } from '../api/api';
import './ServiceTypesPage.css';

function ServiceTypesPage() {
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [newType, setNewType] = useState({ name: '' });

  useEffect(() => {
    loadServiceTypes();
  }, []);

  const loadServiceTypes = async () => {
    setLoading(true);
    try {
      const response = await getServiceTypes();
      setServiceTypes(response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load service types');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newType.name.trim()) {
      setError('Service type name is required');
      return;
    }

    try {
      const response = await createServiceType(newType);
      setServiceTypes([...serviceTypes, response.data]);
      setNewType({ name: '' });
      setShowForm(false);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create service type');
      console.error(err);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingType.name.trim()) {
      setError('Service type name is required');
      return;
    }

    try {
      const response = await updateServiceType(editingType.id, { name: editingType.name });
      setServiceTypes(serviceTypes.map(st => st.id === editingType.id ? response.data : st));
      setEditingType(null);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update service type');
      console.error(err);
    }
  };

  const handleDelete = async (typeId) => {
    if (!window.confirm('Are you sure you want to delete this service type? This will also delete all service intervals and service log entries using this type.')) {
      return;
    }

    try {
      await deleteServiceType(typeId);
      setServiceTypes(serviceTypes.filter(st => st.id !== typeId));
      setError(null);
    } catch (err) {
      setError('Failed to delete service type');
      console.error(err);
    }
  };

  return (
    <div className="service-types-page">
      <div className="page-header">
        <h1>Service Types</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setEditingType(null);
            setNewType({ name: '' });
          }}
        >
          {showForm ? 'Cancel' : '+ New Service Type'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="form-card">
          <h2>{editingType ? 'Edit Service Type' : 'Create New Service Type'}</h2>
          <form onSubmit={editingType ? handleUpdate : handleCreate}>
            <div className="form-group">
              <label>Service Type Name *</label>
              <input
                type="text"
                value={editingType ? editingType.name : newType.name}
                onChange={(e) => {
                  if (editingType) {
                    setEditingType({ ...editingType, name: e.target.value });
                  } else {
                    setNewType({ name: e.target.value });
                  }
                }}
                placeholder="e.g., Oil Change, Tire Rotation"
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingType ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="loading">Loading service types...</div>}

      {!loading && serviceTypes.length === 0 && !showForm && (
        <div className="empty-message">
          No service types yet. Create one to get started.
        </div>
      )}

      {!loading && serviceTypes.length > 0 && (
        <div className="service-types-list">
          {serviceTypes.map(type => (
            <div key={type.id} className="service-type-card">
              <h3>{type.name}</h3>
              <div className="service-type-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingType(type);
                    setShowForm(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(type.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ServiceTypesPage;
