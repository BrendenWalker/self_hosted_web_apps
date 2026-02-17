import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import VehiclesPage from './pages/VehiclesPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import ServiceTypesPage from './pages/ServiceTypesPage';
import ServiceLogPage from './pages/ServiceLogPage';
import VersionFooter from './components/VersionFooter';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="nav-logo">VehicleHub</Link>
            <div className="nav-links">
              <Link to="/" className="nav-link">Home</Link>
              <Link to="/vehicles" className="nav-link">Vehicles</Link>
              <Link to="/service-types" className="nav-link">Service Types</Link>
              <Link to="/service-log" className="nav-link">Service History</Link>
            </div>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
            <Route path="/service-types" element={<ServiceTypesPage />} />
            <Route path="/service-log" element={<ServiceLogPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
        <VersionFooter />
      </div>
    </Router>
  );
}

export default App;
