import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRecipes } from '../api/api';
import './RecipesPage.css';
import './UpcomingMealsPage.css';

function formatPlannedAt(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function UpcomingMealsPage() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getRecipes(undefined, { planned: true });
        if (!cancelled) setRecipes(res.data || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || 'Failed to load upcoming meals');
          setRecipes([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="recipes-page upcoming-meals-page page-scroll">
      <header className="recipes-header">
        <h1>Upcoming meals</h1>
        <p className="recipes-subtitle">
          Recipes you queued by adding them to the shopping list. Open one for ingredients and instructions, then mark as prepared when done.
        </p>
      </header>

      {error && (
        <div className="recipes-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="recipes-loading">Loading…</p>
      ) : recipes.length === 0 ? (
        <div className="recipes-empty">
          <p>No upcoming meals. Add a recipe to the shopping list from the Recipes page or a recipe detail page.</p>
          <Link to="/recipes" className="btn btn-primary">
            Browse recipes
          </Link>
        </div>
      ) : (
        <ul className="recipes-list">
          {recipes.map((r) => (
            <li key={r.id} className="recipe-list-item">
              <div className="recipe-card-wrap">
                <Link to={`/recipes/${r.id}`} className="recipe-card">
                  <span className="recipe-card-name">{r.name}</span>
                  <span className="recipe-card-meta">
                    {r.category_names || 'Uncategorized'} · {r.servings} servings
                    {r.planned_at ? (
                      <span className="upcoming-meals-planned-at"> · Planned {formatPlannedAt(r.planned_at)}</span>
                    ) : null}
                  </span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default UpcomingMealsPage;
