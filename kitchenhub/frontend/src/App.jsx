import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ShoppingPage from './pages/ShoppingPage';
import ShoppingListPage from './pages/ShoppingListPage';
import StorePage from './pages/StorePage';
import RecipesPage from './pages/RecipesPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import IngredientsCatalogPage from './pages/IngredientsCatalogPage';
import VersionFooter from './components/VersionFooter';
import './App.css';

function App() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setNavOpen(false), [location.pathname]);

  const closeNav = () => setNavOpen(false);

  const navLinks = (
    <>
      <Link to="/" className="nav-link" onClick={closeNav}>Home</Link>
      <Link to="/shopping" className="nav-link" onClick={closeNav}>In-Store</Link>
      <Link to="/list" className="nav-link" onClick={closeNav}>Shopping List</Link>
      <Link to="/recipes" className="nav-link" onClick={closeNav}>Recipes</Link>
      <Link to="/stores" className="nav-link" onClick={closeNav}>Stores</Link>
    </>
  );

  return (
    <div className="app">
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="nav-logo" onClick={closeNav}>KitchenHub</Link>
            <button
              type="button"
              className="nav-toggle"
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((o) => !o)}
            >
              <span className="nav-toggle-bar" />
              <span className="nav-toggle-bar" />
              <span className="nav-toggle-bar" />
            </button>
            <div className={`nav-links ${navOpen ? 'nav-links-open' : ''}`}>
              {navLinks}
            </div>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shopping" element={<ShoppingPage />} />
            <Route path="/list" element={<ShoppingListPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/ingredients" element={<IngredientsCatalogPage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/stores" element={<StorePage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
        <VersionFooter />
      </div>
  );
}

export default App;
