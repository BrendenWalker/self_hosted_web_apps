import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import RecipesSectionNav from '../components/RecipesSectionNav';
import { getRecipes, getRecipeCategories, addRecipeToShoppingList } from '../api/api';
import {
  buildRecipeShoppingListNoticeText,
  recipeShoppingListNoticeClassName,
} from '../utils/recipeShoppingListNotice';
import { formatRecipeKcalPerServingDisplay } from '../utils/recipeIngredientNutrition';
import './RecipesPage.css';

const RECIPE_SCALE_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
  { value: 5, label: '5x' },
];

function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [recipeFilter, setRecipeFilter] = useState('');
  const [addingShopRecipeId, setAddingShopRecipeId] = useState(null);
  const [shopNotice, setShopNotice] = useState(null); // { text, className }
  const [recipeScale, setRecipeScale] = useState('1');

  useEffect(() => {
    loadRecipes();
  }, [selectedCategoryIds]);

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
      const res = await getRecipes(
        selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined
      );
      setRecipes(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to load recipes';
      setError(msg);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipeToShoppingList = async (recipeId, recipeName) => {
    setAddingShopRecipeId(recipeId);
    setShopNotice(null);
    setError(null);
    try {
      const scale = Number(recipeScale) || 1;
      const res = await addRecipeToShoppingList(recipeId, scale);
      setShopNotice({
        text: buildRecipeShoppingListNoticeText(recipeName, res.data || {}),
        className: recipeShoppingListNoticeClassName(res.data || {}),
      });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to add to shopping list';
      setError(msg);
    } finally {
      setAddingShopRecipeId(null);
    }
  };

  const toggleCategoryFilter = (categoryId) => {
    setSelectedCategoryIds((ids) =>
      ids.includes(categoryId)
        ? ids.filter((id) => id !== categoryId)
        : [...ids, categoryId]
    );
  };

  const searchText = recipeFilter.trim().toLowerCase();
  const filteredRecipes = searchText
    ? recipes.filter((r) => {
        const name = (r.name || '').toLowerCase();
        return name.includes(searchText);
      })
    : recipes;

  return (
    <div className="recipes-page page-scroll">
      <header className="recipes-header">
        <h1>Recipes</h1>
        <RecipesSectionNav />
        <p className="recipes-subtitle">Browse recipes by category. Select multiple to show only recipes in every chosen category.</p>
        <div className="recipes-toolbar">
          <fieldset className="recipes-category-filter">
            <legend className="filter-label">Categories</legend>
            <div className="recipes-category-checkboxes">
              {categories.map((c) => (
                <label key={c.id} className="recipes-category-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(c.id)}
                    onChange={() => toggleCategoryFilter(c.id)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <input
            type="text"
            placeholder="Filter by recipe name..."
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

      {shopNotice && (
        <div className={shopNotice.className} role="status">
          {shopNotice.text}
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
          {filteredRecipes.map((r) => {
            const kcalPerServing = formatRecipeKcalPerServingDisplay(r.recipe_total_kcal, r.servings);
            return (
            <li key={r.id} className="recipe-list-item">
              <div className="recipe-card-wrap">
                <Link to={`/recipes/${r.id}`} className="recipe-card">
                  <span className="recipe-card-name">
                    {r.name}
                    {r.planned_at ? <span className="recipe-planned-badge" title="On upcoming meals list">Upcoming</span> : null}
                  </span>
                  <span className="recipe-card-meta">
                    {r.category_names || 'Uncategorized'} · {r.servings} servings
                    {kcalPerServing != null ? <> · {kcalPerServing}</> : null}
                  </span>
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary recipe-add-shop-btn"
                  disabled={addingShopRecipeId === r.id}
                  onClick={() => handleAddRecipeToShoppingList(r.id, r.name)}
                  aria-label={`Add ${r.name} ingredients to shopping list`}
                >
                  {addingShopRecipeId === r.id ? 'Adding…' : 'Add to shopping list'}
                </button>
                <label className="recipe-scale-control">
                  <span>Scale</span>
                  <select
                    value={recipeScale}
                    onChange={(e) => setRecipeScale(e.target.value)}
                    disabled={addingShopRecipeId === r.id}
                  >
                    {RECIPE_SCALE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default RecipesPage;
