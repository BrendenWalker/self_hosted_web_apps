import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HouseholdPage from './pages/HouseholdPage';
import IncomePage from './pages/IncomePage';
import AccountsPage from './pages/AccountsPage';
import ExpensesPage from './pages/ExpensesPage';
import ImportPage from './pages/ImportPage';
import VersionFooter from './components/VersionFooter';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="nav-logo">RetirementHub</Link>
            <div className="nav-links">
              <Link to="/" className="nav-link">Home</Link>
              <Link to="/household" className="nav-link">Household</Link>
              <Link to="/income" className="nav-link">Income</Link>
              <Link to="/accounts" className="nav-link">Accounts</Link>
              <Link to="/expenses" className="nav-link">Expenses</Link>
              <Link to="/import" className="nav-link">Import</Link>
            </div>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/household" element={<HouseholdPage />} />
            <Route path="/income" element={<IncomePage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
        <VersionFooter />
      </div>
    </Router>
  );
}

export default App;
