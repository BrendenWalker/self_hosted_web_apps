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
  const [editIntervalForm, setEditIntervalForm] = useState({ months: '', miles: '', notes: '' });
  const [newInterval, setNewInterval] = useState({ serviceid: '', months: '', miles: '', notes: '' });
  const defaultLogEntry = () => ({
    serviceid: '',
    servicedate: new Date().toISOString().slice(0, 10),
    servicemiles: '',
    notes: '',
    qty: ''
  });
  const [newLogEntry, setNewLogEntry] = useState(defaultLogEntry());
  const [filterServiceTypeId, setFilterServiceTypeId] = useState('');

  const filteredServiceLog = [...(filterServiceTypeId
    ? serviceLog.filter(entry => String(entry.serviceid) === String(filterServiceTypeId))
    : serviceLog)].sort((a, b) => new Date(b.servicedate) - new Date(a.servicedate));

  // Only show types configured for this vehicle's intervals, or id < 0 (used for Log form and filter)
  const serviceTypesForVehicle = serviceTypes.filter(
    st => st.id < 0 || intervals.some(iv => iv.serviceid === st.id)
  );

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
      const updated = { ...response.data, service_name: interval.service_name };
      setIntervals(intervals.map(i => 
        i.serviceid === interval.serviceid ? updated : i
      ));
      setEditingInterval(null);
      setError(null);
    } catch (err) {
      setError('Failed to update service interval');
      console.error(err);
    }
  };

  const startEditInterval = (interval) => {
    setEditingInterval(interval);
    setEditIntervalForm({
      months: interval.months ?? '',
      miles: interval.miles ?? '',
      notes: interval.notes ?? ''
    });
  };

  const handleSaveIntervalEdit = async (e) => {
    e.preventDefault();
    await handleUpdateInterval({
      ...editingInterval,
      months: editIntervalForm.months ? parseInt(editIntervalForm.months, 10) : null,
      miles: editIntervalForm.miles ? parseInt(editIntervalForm.miles, 10) : null,
      notes: editIntervalForm.notes || null
    });
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
      setNewLogEntry(defaultLogEntry());
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
            <h2>Service History</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowLogForm(!showLogForm);
                setNewLogEntry(defaultLogEntry());
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
                    {serviceTypesForVehicle.map(st => (
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
            <>
              <div className="log-filters">
                <label htmlFor="vehicle-log-filter">Filter by service type</label>
                <select
                  id="vehicle-log-filter"
                  value={filterServiceTypeId}
                  onChange={(e) => setFilterServiceTypeId(e.target.value)}
                >
                  <option value="">All service types</option>
                  {serviceTypesForVehicle.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </div>
              {filteredServiceLog.length === 0 ? (
                <div className="empty-message">No entries match the selected service type.</div>
              ) : (
                <div className="log-grid-wrapper">
                  <table className="log-grid">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Miles</th>
                        <th>Date</th>
                        <th>Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredServiceLog.map(entry => (
                        <tr key={entry.id}>
                          <td>{entry.service_name}</td>
                          <td>{entry.servicemiles != null ? entry.servicemiles.toLocaleString() : '—'}</td>
                          <td>{new Date(entry.servicedate).toLocaleDateString()}</td>
                          <td>{entry.qty != null && entry.qty !== '' ? entry.qty : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

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
                  {editingInterval?.serviceid === interval.serviceid ? (
                    <form className="interval-edit-form" onSubmit={handleSaveIntervalEdit}>
                      <div className="interval-header">
                        <h3>{interval.service_name}</h3>
                        <div className="interval-edit-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingInterval(null)}>
                            Cancel
                          </button>
                          <button type="submit" className="btn btn-primary btn-sm">Save</button>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Months</label>
                          <input
                            type="number"
                            value={editIntervalForm.months}
                            onChange={(e) => setEditIntervalForm({ ...editIntervalForm, months: e.target.value })}
                            placeholder="e.g., 6"
                          />
                        </div>
                        <div className="form-group">
                          <label>Miles</label>
                          <input
                            type="number"
                            value={editIntervalForm.miles}
                            onChange={(e) => setEditIntervalForm({ ...editIntervalForm, miles: e.target.value })}
                            placeholder="e.g., 5000"
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Notes</label>
                        <textarea
                          value={editIntervalForm.notes}
                          onChange={(e) => setEditIntervalForm({ ...editIntervalForm, notes: e.target.value })}
                          rows="3"
                        />
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="interval-header">
                        <h3>{interval.service_name}</h3>
                        <div className="interval-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEditInterval(interval)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteInterval(interval.serviceid)}
                          >
                            Delete
                          </button>
                        </div>
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
                    </>
                  )}
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
