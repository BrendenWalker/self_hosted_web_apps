import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRecipes, getRecipeCategories } from '../api/api';
import './RecipesPage.css';

function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryId, setCategoryId] = useState('');

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

  return (
    <div className="recipes-page">
      <header className="recipes-header">
        <h1>Recipes</h1>
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
      ) : (
        <ul className="recipes-list">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link to={`/recipes/${r.id}`} className="recipe-card">
                <span className="recipe-card-name">{r.name}</span>
                <span className="recipe-card-meta">{r.category_name} · {r.servings} servings</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RecipesPage;
