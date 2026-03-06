import React, { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getRecipes, getRecipeCategories } from '../api/api';
import './RecipesPage.css';

function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryId, setCategoryId] = useState('');
  const [recipeFilter, setRecipeFilter] = useState('');

  useEffect(() => {
    loadRecipes();
  }, [categoryId]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await getRecipeCategories();
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadRecipes = async () => {
    setLoading(true);
    setError(null);
    try {
      const id = categoryId === '' ? undefined : categoryId;
      const res = await getRecipes(id);
      setRecipes(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to load recipes';
      setError(msg);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const searchText = recipeFilter.trim().toLowerCase();
  const filteredRecipes = searchText
    ? recipes.filter((r) => {
        const name = (r.name || '').toLowerCase();
        const cats = (r.category_names || '').toLowerCase();
        return name.includes(searchText) || cats.includes(searchText);
      })
    : recipes;

  return (
    <div className="recipes-page">
      <header className="recipes-header">
        <h1>Recipes</h1>
        <nav className="recipes-subnav" aria-label="Recipes section">
          <NavLink to="/recipes" end className={({ isActive }) => isActive ? 'recipes-subnav-link active' : 'recipes-subnav-link'}>
            Recipes
          </NavLink>
          <NavLink to="/recipes/ingredients" className={({ isActive }) => isActive ? 'recipes-subnav-link active' : 'recipes-subnav-link'}>
            Ingredients
          </NavLink>
        </nav>
        <p className="recipes-subtitle">Browse recipes by category. Open a recipe to see ingredients and instructions.</p>
        <div className="recipes-toolbar">
          <label htmlFor="recipe-category-filter" className="filter-label">Category</label>
          <select
            id="recipe-category-filter"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="filter-select"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filter by name or category..."
            value={recipeFilter}
            onChange={(e) => setRecipeFilter(e.target.value)}
            className="recipes-filter-input"
          />
          <Link to="/recipes/new" className="btn btn-primary">New recipe</Link>
        </div>
      </header>

      {error && (
        <div className="recipes-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="recipes-loading">Loading recipes…</p>
      ) : recipes.length === 0 ? (
        <div className="recipes-empty">
          <p>No recipes found.</p>
          <Link to="/recipes/new" className="btn btn-primary">Create your first recipe</Link>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="recipes-empty">
          <p>{recipeFilter ? 'No recipes match your search' : 'No recipes found.'}</p>
        </div>
      ) : (
        <ul className="recipes-list">
          {filteredRecipes.map((r) => (
            <li key={r.id}>
              <Link to={`/recipes/${r.id}`} className="recipe-card">
                <span className="recipe-card-name">{r.name}</span>
                <span className="recipe-card-meta">{r.category_names || 'Uncategorized'} · {r.servings} servings</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RecipesPage;
