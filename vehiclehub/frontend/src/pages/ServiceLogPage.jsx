import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllServiceLog, deleteServiceLogEntry } from '../api/api';
import './ServiceLogPage.css';

function ServiceLogPage() {
  const [serviceLog, setServiceLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadServiceLog();
  }, []);

  const loadServiceLog = async () => {
    setLoading(true);
    try {
      const response = await getAllServiceLog();
      setServiceLog(response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load service log');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
        <div className="service-log-list">
          {serviceLog.map(entry => (
            <div key={entry.id} className="log-entry-card">
              <div className="log-entry-header">
                <div>
                  <h3>{entry.service_name}</h3>
                  <Link to={`/vehicles/${entry.vehicleid}`} className="vehicle-link">
                    {entry.vehicle_name}
                  </Link>
                </div>
                <div className="log-entry-date">
                  {new Date(entry.servicedate).toLocaleDateString()}
                </div>
              </div>
              <div className="log-entry-details">
                {entry.servicemiles && (
                  <div className="log-entry-field">
                    <span className="log-entry-label">Miles:</span>
                    <span>{entry.servicemiles.toLocaleString()}</span>
                  </div>
                )}
                {entry.qty && (
                  <div className="log-entry-field">
                    <span className="log-entry-label">Quantity:</span>
                    <span>{entry.qty}</span>
                  </div>
                )}
                {entry.notes && (
                  <div className="log-entry-field">
                    <span className="log-entry-label">Notes:</span>
                    <span>{entry.notes}</span>
                  </div>
                )}
              </div>
              <div className="log-entry-actions">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(entry.id)}
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

export default ServiceLogPage;
