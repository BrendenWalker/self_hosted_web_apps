import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
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
