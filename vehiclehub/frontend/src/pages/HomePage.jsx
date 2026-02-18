import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUpcomingServices } from '../api/api';
import './HomePage.css';

function HomePage() {
  const [upcomingServices, setUpcomingServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUpcomingServices();
  }, []);

  const loadUpcomingServices = async () => {
    try {
      setLoading(true);
      const response = await getUpcomingServices(30);
      setUpcomingServices(response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load upcoming services');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const isOverdue = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  const getDaysUntilDue = (dateString) => {
    if (!dateString) return null;
    const dueDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="home-page">
      <section className="home-hero">
        <h1>Welcome to VehicleHub</h1>
        <p className="home-subtitle">
          Track and manage vehicle service intervals, maintenance history, and upcoming service reminders.
        </p>
        <div className="home-quick-links">
          <Link to="/vehicles" className="home-card">
            <h2>Vehicles</h2>
            <p>
              Manage your vehicles and configure service intervals for each one. Track when services are due by date or mileage.
            </p>
          </Link>
          <Link to="/service-types" className="home-card">
            <h2>Service Types</h2>
            <p>
              Define service types like oil changes, tire rotations, and inspections that can be applied to any vehicle.
            </p>
          </Link>
          <Link to="/service-log" className="home-card">
            <h2>Service History</h2>
            <p>
              View and manage your complete service history across all vehicles. Log services to automatically update next due dates.
            </p>
          </Link>
        </div>
      </section>

      <section className="home-upcoming-services">
        <h2>Upcoming Services (Next 30 Days)</h2>
        {loading && <p className="loading-message">Loading upcoming services...</p>}
        {error && <p className="error-message">{error}</p>}
        {!loading && !error && (
          <>
            {upcomingServices.length === 0 ? (
              <p className="no-services-message">
                No upcoming services in the next 30 days. All caught up!
              </p>
            ) : (
              <div className="upcoming-services-list">
                {upcomingServices.map((service) => {
                  const daysUntil = getDaysUntilDue(service.nextdate);
                  const overdue = isOverdue(service.nextdate);
                  return (
                    <Link
                      key={`${service.vehicleid}-${service.serviceid}`}
                      to={`/vehicles/${service.vehicleid}`}
                      className={`upcoming-service-card ${overdue ? 'overdue' : ''}`}
                    >
                      <div className="service-card-header">
                        <h3>{service.service_name}</h3>
                        <span className={`service-badge ${overdue ? 'badge-overdue' : 'badge-upcoming'}`}>
                          {overdue ? 'Overdue' : 'Due Soon'}
                        </span>
                      </div>
                      <div className="service-card-details">
                        <p className="service-vehicle">
                          <strong>Vehicle:</strong> {service.vehicle_name}
                        </p>
                        <p className="service-date">
                          <strong>Due Date:</strong>{' '}
                          <span className={overdue ? 'date-overdue' : ''}>
                            {formatDate(service.nextdate)}
                          </span>
                          {daysUntil !== null && (
                            <span className="days-until">
                              {' '}({overdue ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days`})
                            </span>
                          )}
                        </p>
                        {service.nextmiles && (
                          <p className="service-miles">
                            <strong>Due at:</strong> {service.nextmiles.toLocaleString()} miles
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      <section className="home-details">
        <div className="home-detail-card">
          <h3>How it works</h3>
          <p>
            Start by adding your <strong>vehicles</strong> and defining <strong>service types</strong>. Then configure 
            <strong> service intervals</strong> for each vehicle to specify when services are due (by months or miles). 
            When you log a service, the system automatically calculates the next due date based on your interval settings.
          </p>
        </div>
        <div className="home-detail-card">
          <h3>Next steps</h3>
          <ul>
            <li>Add your vehicles on the <strong>Vehicles</strong> page.</li>
            <li>Create service types like "Oil Change" or "Tire Rotation" on the <strong>Service Types</strong> page.</li>
            <li>Configure service intervals for each vehicle to set when services are due.</li>
            <li>Log services as you perform them to keep your records up to date.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
