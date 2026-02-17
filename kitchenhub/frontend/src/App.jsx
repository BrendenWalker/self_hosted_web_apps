import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ShoppingPage from './pages/ShoppingPage';
import ShoppingListPage from './pages/ShoppingListPage';
import StorePage from './pages/StorePage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="nav-logo">KitchenHub</Link>
            <div className="nav-links">
              <Link to="/" className="nav-link">Home</Link>
              <Link to="/shopping" className="nav-link">Shopping</Link>
              <Link to="/list" className="nav-link">Modify List</Link>
              <Link to="/stores" className="nav-link">Stores</Link>
            </div>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shopping" element={<ShoppingPage />} />
            <Route path="/list" element={<ShoppingListPage />} />
            <Route path="/stores" element={<StorePage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
