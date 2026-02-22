import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllServiceLog, deleteServiceLogEntry, getServiceTypes } from '../api/api';
import './ServiceLogPage.css';

function ServiceLogPage() {
  const [serviceLog, setServiceLog] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [filterServiceTypeId, setFilterServiceTypeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logRes, typesRes] = await Promise.all([
        getAllServiceLog(),
        getServiceTypes()
      ]);
      setServiceLog(logRes.data || []);
      setServiceTypes(typesRes.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load service log');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLog = [...(filterServiceTypeId
    ? serviceLog.filter(entry => String(entry.serviceid) === String(filterServiceTypeId))
    : serviceLog)].sort((a, b) => new Date(b.servicedate) - new Date(a.servicedate));

  const handleDelete = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this service log entry?')) {
      return;
    }

    try {
      await deleteServiceLogEntry(entryId);
      setServiceLog(serviceLog.filter(entry => entry.id !== entryId));
      setError(null);
    } catch (err) {
      setError('Failed to delete service log entry');
      console.error(err);
    }
  };

  return (
    <div className="service-log-page">
      <div className="page-header">
        <h1>Service History</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading && <div className="loading">Loading service history...</div>}

      {!loading && serviceLog.length === 0 && (
        <div className="empty-message">
          No service history yet. Log services from the vehicle detail page.
        </div>
      )}

      {!loading && serviceLog.length > 0 && (
        <>
          <div className="service-log-filters">
            <label htmlFor="filter-service-type">Filter by service type</label>
            <select
              id="filter-service-type"
              value={filterServiceTypeId}
              onChange={(e) => setFilterServiceTypeId(e.target.value)}
            >
              <option value="">All service types</option>
              {serviceTypes.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          <div className="service-log-grid-wrapper">
            {filteredLog.length === 0 ? (
              <div className="empty-filter-message">No entries match the selected service type.</div>
            ) : (
              <table className="service-log-grid">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Miles</th>
                    <th>Date</th>
                    <th>Quantity</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLog.map(entry => (
                    <tr key={entry.id}>
                      <td>
                        <span className="service-name">{entry.service_name}</span>
                        <Link to={`/vehicles/${entry.vehicleid}`} className="vehicle-link">
                          {entry.vehicle_name}
                        </Link>
                      </td>
                      <td>{entry.servicemiles != null ? entry.servicemiles.toLocaleString() : '—'}</td>
                      <td>{new Date(entry.servicedate).toLocaleDateString()}</td>
                      <td>{entry.qty != null && entry.qty !== '' ? entry.qty : '—'}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(entry.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ServiceLogPage;
