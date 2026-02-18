import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getVehicle,
  getServiceIntervals,
  createServiceInterval,
  updateServiceInterval,
  deleteServiceInterval,
  getServiceLog,
  createServiceLogEntry,
  getServiceTypes
} from '../api/api';
import './VehicleDetailPage.css';

function VehicleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [intervals, setIntervals] = useState([]);
  const [serviceLog, setServiceLog] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showIntervalForm, setShowIntervalForm] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [editingInterval, setEditingInterval] = useState(null);
  const [newInterval, setNewInterval] = useState({ serviceid: '', months: '', miles: '', notes: '' });
  const [newLogEntry, setNewLogEntry] = useState({ serviceid: '', servicedate: '', servicemiles: '', notes: '', qty: '' });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vehicleRes, intervalsRes, logRes, typesRes] = await Promise.all([
        getVehicle(id),
        getServiceIntervals(id),
        getServiceLog(id),
        getServiceTypes()
      ]);
      setVehicle(vehicleRes.data);
      setIntervals(intervalsRes.data || []);
      setServiceLog(logRes.data || []);
      setServiceTypes(typesRes.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load vehicle data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInterval = async (e) => {
    e.preventDefault();
    try {
      const response = await createServiceInterval(id, {
        serviceid: parseInt(newInterval.serviceid),
        months: newInterval.months ? parseInt(newInterval.months) : null,
        miles: newInterval.miles ? parseInt(newInterval.miles) : null,
        notes: newInterval.notes || null
      });
      setIntervals([...intervals, response.data]);
      setNewInterval({ serviceid: '', months: '', miles: '', notes: '' });
      setShowIntervalForm(false);
      setError(null);
    } catch (err) {
      setError('Failed to create service interval');
      console.error(err);
    }
  };

  const handleUpdateInterval = async (interval) => {
    try {
      const response = await updateServiceInterval(id, interval.serviceid, {
        months: interval.months,
        miles: interval.miles,
        notes: interval.notes,
        nextdate: interval.nextdate,
        nextmiles: interval.nextmiles
      });
      setIntervals(intervals.map(i => 
        i.serviceid === interval.serviceid ? response.data : i
      ));
      setError(null);
    } catch (err) {
      setError('Failed to update service interval');
      console.error(err);
    }
  };

  const handleDeleteInterval = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service interval?')) {
      return;
    }
    try {
      await deleteServiceInterval(id, serviceId);
      setIntervals(intervals.filter(i => i.serviceid !== serviceId));
      setError(null);
    } catch (err) {
      setError('Failed to delete service interval');
      console.error(err);
    }
  };

  const handleCreateLogEntry = async (e) => {
    e.preventDefault();
    try {
      const response = await createServiceLogEntry({
        vehicleid: parseInt(id),
        serviceid: parseInt(newLogEntry.serviceid),
        servicedate: newLogEntry.servicedate,
        servicemiles: newLogEntry.servicemiles ? parseInt(newLogEntry.servicemiles) : null,
        notes: newLogEntry.notes || null,
        qty: newLogEntry.qty ? parseFloat(newLogEntry.qty) : null
      });
      await loadData(); // Reload to get updated intervals
      setNewLogEntry({ serviceid: '', servicedate: '', servicemiles: '', notes: '', qty: '' });
      setShowLogForm(false);
      setError(null);
    } catch (err) {
      setError('Failed to create service log entry');
      console.error(err);
    }
  };

  if (loading) {
    return <div className="loading">Loading vehicle details...</div>;
  }

  if (!vehicle) {
    return <div className="error-message">Vehicle not found</div>;
  }

  return (
    <div className="vehicle-detail-page">
      <div className="page-header">
        <div>
          <button className="btn btn-secondary" onClick={() => navigate('/vehicles')}>
            ← Back to Vehicles
          </button>
          <h1>{vehicle.name}</h1>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="detail-sections">
        <section className="detail-section">
          <div className="section-header">
            <h2>Service Intervals</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowIntervalForm(!showIntervalForm);
                setEditingInterval(null);
                setNewInterval({ serviceid: '', months: '', miles: '', notes: '' });
              }}
            >
              {showIntervalForm ? 'Cancel' : '+ Add Interval'}
            </button>
          </div>

          {showIntervalForm && (
            <div className="form-card">
              <form onSubmit={handleCreateInterval}>
                <div className="form-group">
                  <label>Service Type *</label>
                  <select
                    value={newInterval.serviceid}
                    onChange={(e) => setNewInterval({ ...newInterval, serviceid: e.target.value })}
                    required
                  >
                    <option value="">Select service type</option>
                    {serviceTypes.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Months</label>
                    <input
                      type="number"
                      value={newInterval.months}
                      onChange={(e) => setNewInterval({ ...newInterval, months: e.target.value })}
                      placeholder="e.g., 6"
                    />
                  </div>
                  <div className="form-group">
                    <label>Miles</label>
                    <input
                      type="number"
                      value={newInterval.miles}
                      onChange={(e) => setNewInterval({ ...newInterval, miles: e.target.value })}
                      placeholder="e.g., 5000"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={newInterval.notes}
                    onChange={(e) => setNewInterval({ ...newInterval, notes: e.target.value })}
                    rows="3"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Create</button>
                </div>
              </form>
            </div>
          )}

          {intervals.length === 0 ? (
            <div className="empty-message">No service intervals configured</div>
          ) : (
            <div className="intervals-list">
              {intervals.map(interval => (
                <div key={interval.serviceid} className="interval-card">
                  <div className="interval-header">
                    <h3>{interval.service_name}</h3>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteInterval(interval.serviceid)}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="interval-details">
                    <div className="interval-field">
                      <label>Interval:</label>
                      <span>
                        {interval.months && `${interval.months} months`}
                        {interval.months && interval.miles && ' or '}
                        {interval.miles && `${interval.miles.toLocaleString()} miles`}
                        {!interval.months && !interval.miles && 'Not set'}
                      </span>
                    </div>
                    <div className="interval-field">
                      <label>Next Due:</label>
                      <span>
                        {interval.nextdate && new Date(interval.nextdate).toLocaleDateString()}
                        {interval.nextdate && interval.nextmiles && ' or '}
                        {interval.nextmiles && `${interval.nextmiles.toLocaleString()} miles`}
                        {!interval.nextdate && !interval.nextmiles && 'Not calculated'}
                      </span>
                    </div>
                    {interval.notes && (
                      <div className="interval-field">
                        <label>Notes:</label>
                        <span>{interval.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="detail-section">
          <div className="section-header">
            <h2>Service History</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowLogForm(!showLogForm);
                setNewLogEntry({ serviceid: '', servicedate: '', servicemiles: '', notes: '', qty: '' });
              }}
            >
              {showLogForm ? 'Cancel' : '+ Log Service'}
            </button>
          </div>

          {showLogForm && (
            <div className="form-card">
              <form onSubmit={handleCreateLogEntry}>
                <div className="form-group">
                  <label>Service Type *</label>
                  <select
                    value={newLogEntry.serviceid}
                    onChange={(e) => setNewLogEntry({ ...newLogEntry, serviceid: e.target.value })}
                    required
                  >
                    <option value="">Select service type</option>
                    {serviceTypes.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Service Date *</label>
                    <input
                      type="date"
                      value={newLogEntry.servicedate}
                      onChange={(e) => setNewLogEntry({ ...newLogEntry, servicedate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Miles</label>
                    <input
                      type="number"
                      value={newLogEntry.servicemiles}
                      onChange={(e) => setNewLogEntry({ ...newLogEntry, servicemiles: e.target.value })}
                      placeholder="e.g., 50000"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Quantity (e.g., gallons)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newLogEntry.qty}
                    onChange={(e) => setNewLogEntry({ ...newLogEntry, qty: e.target.value })}
                    placeholder="e.g., 5.0"
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={newLogEntry.notes}
                    onChange={(e) => setNewLogEntry({ ...newLogEntry, notes: e.target.value })}
                    rows="3"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Log Service</button>
                </div>
              </form>
            </div>
          )}

          {serviceLog.length === 0 ? (
            <div className="empty-message">No service history</div>
          ) : (
            <div className="log-list">
              {serviceLog.map(entry => (
                <div key={entry.id} className="log-card">
                  <div className="log-header">
                    <h3>{entry.service_name}</h3>
                    <span className="log-date">{new Date(entry.servicedate).toLocaleDateString()}</span>
                  </div>
                  <div className="log-details">
                    {entry.servicemiles && (
                      <div className="log-field">
                        <span className="log-label">Miles:</span>
                        <span>{entry.servicemiles.toLocaleString()}</span>
                      </div>
                    )}
                    {entry.qty && (
                      <div className="log-field">
                        <span className="log-label">Quantity:</span>
                        <span>{entry.qty}</span>
                      </div>
                    )}
                    {entry.notes && (
                      <div className="log-field">
                        <span className="log-label">Notes:</span>
                        <span>{entry.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default VehicleDetailPage;
