import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getVehicles, createVehicle, updateVehicle, deleteVehicle, getUpcomingServices } from '../api/api';
import './VehiclesPage.css';

function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [upcomingServices, setUpcomingServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [newVehicle, setNewVehicle] = useState({ name: '' });

  useEffect(() => {
    loadVehicles();
    loadUpcomingServices();
  }, []);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const response = await getVehicles();
      setVehicles(response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load vehicles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUpcomingServices = async () => {
    try {
      const response = await getUpcomingServices(30);
      setUpcomingServices(response.data || []);
    } catch (err) {
      console.error('Failed to load upcoming services:', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newVehicle.name.trim()) {
      setError('Vehicle name is required');
      return;
    }

    try {
      const response = await createVehicle(newVehicle);
      setVehicles([...vehicles, response.data]);
      setNewVehicle({ name: '' });
      setShowForm(false);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create vehicle');
      console.error(err);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingVehicle.name.trim()) {
      setError('Vehicle name is required');
      return;
    }

    try {
      const response = await updateVehicle(editingVehicle.id, { name: editingVehicle.name });
      setVehicles(vehicles.map(v => v.id === editingVehicle.id ? response.data : v));
      setEditingVehicle(null);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update vehicle');
      console.error(err);
    }
  };

  const handleDelete = async (vehicleId) => {
    if (!window.confirm('Are you sure you want to delete this vehicle? This will also delete all service intervals and service log entries.')) {
      return;
    }

    try {
      await deleteVehicle(vehicleId);
      setVehicles(vehicles.filter(v => v.id !== vehicleId));
      setError(null);
    } catch (err) {
      setError('Failed to delete vehicle');
      console.error(err);
    }
  };

  const getUpcomingCount = (vehicleId) => {
    return upcomingServices.filter(s => s.vehicle_id === vehicleId).length;
  };

  return (
    <div className="vehicles-page">
      <div className="page-header">
        <h1>Vehicles</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setEditingVehicle(null);
            setNewVehicle({ name: '' });
          }}
        >
          {showForm ? 'Cancel' : '+ New Vehicle'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="form-card">
          <h2>{editingVehicle ? 'Edit Vehicle' : 'Create New Vehicle'}</h2>
          <form onSubmit={editingVehicle ? handleUpdate : handleCreate}>
            <div className="form-group">
              <label>Vehicle Name *</label>
              <input
                type="text"
                value={editingVehicle ? editingVehicle.name : newVehicle.name}
                onChange={(e) => {
                  if (editingVehicle) {
                    setEditingVehicle({ ...editingVehicle, name: e.target.value });
                  } else {
                    setNewVehicle({ name: e.target.value });
                  }
                }}
                placeholder="e.g., 2015 Honda Civic"
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingVehicle ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="loading">Loading vehicles...</div>}

      {!loading && vehicles.length === 0 && !showForm && (
        <div className="empty-message">
          No vehicles yet. Create one to get started.
        </div>
      )}

      {!loading && vehicles.length > 0 && (
        <div className="vehicles-grid">
          {vehicles.map(vehicle => (
            <div key={vehicle.id} className="vehicle-card">
              <div className="vehicle-card-header">
                <Link to={`/vehicles/${vehicle.id}`} className="vehicle-link">
                  <h3>{vehicle.name}</h3>
                </Link>
                <div className="vehicle-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setEditingVehicle(vehicle);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(vehicle.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="vehicle-card-body">
                <div className="vehicle-stat">
                  <span className="stat-label">Upcoming Services:</span>
                  <span className="stat-value">{getUpcomingCount(vehicle.id)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VehiclesPage;
