import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getRecipe,
  getRecipeCategories,
  getIngredients,
  getIngredientMeasurements,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  addRecipeIngredient,
  removeRecipeIngredient,
} from '../api/api';
import './RecipeDetailPage.css';

function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [recipe, setRecipe] = useState(null);
  const [categories, setCategories] = useState([]);
  const [ingredientsCatalog, setIngredientsCatalog] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', servings: 1, category_id: '', instructions: '' });
  const [addIngredientId, setAddIngredientId] = useState('');
  const [addIngredientQty, setAddIngredientQty] = useState('');
  const [addIngredientMeasureId, setAddIngredientMeasureId] = useState('');
  const [addIngredientComment, setAddIngredientComment] = useState('');
  const [addIngredientOptional, setAddIngredientOptional] = useState(false);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      loadOptions();
      setForm({ name: '', servings: 1, category_id: categories[0]?.id ?? '', instructions: '' });
      return;
    }
    loadRecipe();
    loadOptions();
  }, [id, isNew]);

  useEffect(() => {
    if (isNew && categories.length > 0 && !form.category_id) {
      setForm((f) => ({ ...f, category_id: categories[0].id }));
    }
  }, [isNew, categories, form.category_id]);

  const loadOptions = async () => {
    try {
      const [catRes, ingRes, measRes] = await Promise.all([
        getRecipeCategories(),
        getIngredients(),
        getIngredientMeasurements(),
      ]);
      setCategories(catRes.data);
      setIngredientsCatalog(ingRes.data);
      setMeasurements(measRes.data);
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  };

  const loadRecipe = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRecipe(id);
      setRecipe(res.data);
      setForm({
        name: res.data.name,
        servings: res.data.servings,
        category_id: res.data.category_id,
        instructions: res.data.instructions ?? '',
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load recipe');
      setRecipe(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isNew) {
        const res = await createRecipe({
          name: form.name,
          servings: Number(form.servings) || 1,
          category_id: form.category_id,
          instructions: form.instructions || null,
        });
        navigate(`/recipes/${res.data.id}`, { replace: true });
        return;
      }
      await updateRecipe(id, {
        name: form.name,
        servings: Number(form.servings) || 1,
        category_id: form.category_id,
        instructions: form.instructions || null,
      });
      setRecipe((prev) => prev && { ...prev, ...form });
      setEditing(false);
      loadRecipe();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save recipe');
    }
  };

  const handleDeleteRecipe = async () => {
    if (!window.confirm(`Delete recipe "${recipe?.name}"?`)) return;
    try {
      await deleteRecipe(id);
      navigate('/recipes');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete recipe');
    }
  };

  const handleAddIngredient = async (e) => {
    e.preventDefault();
    if (!addIngredientId) return;
    setError(null);
    try {
      await addRecipeIngredient(id, {
        ingredient_id: Number(addIngredientId),
        qty: addIngredientQty ? parseFloat(addIngredientQty) : null,
        measurement_id: addIngredientMeasureId ? Number(addIngredientMeasureId) : null,
        comment: addIngredientComment.trim() || null,
        is_optional: addIngredientOptional,
      });
      setAddIngredientId('');
      setAddIngredientQty('');
      setAddIngredientMeasureId('');
      setAddIngredientComment('');
      setAddIngredientOptional(false);
      loadRecipe();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add ingredient');
    }
  };

  const handleRemoveIngredient = async (ingredientId) => {
    try {
      await removeRecipeIngredient(id, ingredientId);
      loadRecipe();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to remove ingredient');
    }
  };

  const formatIngredientLine = (row) => {
    const name = row.ingredient_details ? `${row.ingredient_name} (${row.ingredient_details})` : row.ingredient_name;
    const qty = row.qty != null ? String(row.qty) : '';
    const measure = row.measurement_name || '';
    const part = [qty, measure].filter(Boolean).join(' ');
    return part ? `${part} ${name}` : name;
  };

  if (loading && !isNew) {
    return <p className="recipe-detail-loading">Loading recipe…</p>;
  }

  if (!isNew && !recipe) {
    return (
      <div className="recipe-detail-error">
        <p>{error || 'Recipe not found.'}</p>
        <Link to="/recipes" className="btn btn-primary">Back to recipes</Link>
      </div>
    );
  }

  return (
    <div className="recipe-detail-page">
      <div className="recipe-detail-breadcrumb">
        <Link to="/recipes">Recipes</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{isNew ? 'New recipe' : recipe?.name}</span>
      </div>

      {error && (
        <div className="recipe-detail-error-banner" role="alert">
          {error}
        </div>
      )}

      <section className="recipe-detail-card">
        {isNew ? (
          <form onSubmit={handleSaveRecipe} className="recipe-detail-form">
            <h1>New recipe</h1>
            <div className="form-row">
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Recipe name"
              />
            </div>
            <div className="form-row inline">
              <div className="form-group">
                <label>Servings</label>
                <input
                  type="number"
                  min={1}
                  value={form.servings}
                  onChange={(e) => setForm((f) => ({ ...f, servings: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <label>Instructions</label>
              <textarea
                value={form.instructions}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                placeholder="Steps…"
                rows={6}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Create recipe</button>
              <Link to="/recipes" className="btn btn-secondary">Cancel</Link>
            </div>
          </form>
        ) : (
          <>
            <div className="recipe-detail-header">
              <h1>{recipe.name}</h1>
              <p className="recipe-meta">{recipe.category_name} · {recipe.servings} servings</p>
              <div className="recipe-detail-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? 'Cancel' : 'Edit'}
                </button>
                <button type="button" className="btn btn-danger" onClick={handleDeleteRecipe}>
                  Delete
                </button>
              </div>
            </div>

            {editing ? (
              <form onSubmit={handleSaveRecipe} className="recipe-detail-form">
                <div className="form-row">
                  <label>Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-row inline">
                  <div className="form-group">
                    <label>Servings</label>
                    <input
                      type="number"
                      min={1}
                      value={form.servings}
                      onChange={(e) => setForm((f) => ({ ...f, servings: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={form.category_id}
                      onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <label>Instructions</label>
                  <textarea
                    value={form.instructions}
                    onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                    rows={6}
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Save</button>
                </div>
              </form>
            ) : (
              <>
                {recipe.instructions && (
                  <div className="recipe-instructions">
                    <h2>Instructions</h2>
                    <pre className="recipe-instructions-text">{recipe.instructions}</pre>
                  </div>
                )}

                <div className="recipe-ingredients-section">
                  <h2>Ingredients</h2>
                  {recipe.ingredients && recipe.ingredients.length > 0 ? (
                    <ul className="recipe-ingredients-list">
                      {recipe.ingredients.map((row) => (
                        <li key={row.ingredient_id} className="recipe-ingredient-row">
                          <span className="ingredient-line">
                            {row.is_optional && <span className="ingredient-optional">Optional: </span>}
                            {formatIngredientLine(row)}
                            {row.comment && <span className="ingredient-comment"> — {row.comment}</span>}
                          </span>
                          {row.shopping_measure && (
                            <span className="ingredient-shopping-measure" title="Shopping measure for list">
                              Buy: {row.shopping_measure}
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn-remove-ingredient"
                            onClick={() => handleRemoveIngredient(row.ingredient_id)}
                            title="Remove ingredient"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="recipe-no-ingredients">No ingredients yet.</p>
                  )}

                  <form onSubmit={handleAddIngredient} className="add-ingredient-form">
                    <h3>Add ingredient</h3>
                    <div className="add-ingredient-fields">
                      <select
                        value={addIngredientId}
                        onChange={(e) => setAddIngredientId(e.target.value)}
                        required
                      >
                        <option value="">Select ingredient…</option>
                        {ingredientsCatalog
                          .filter((i) => !recipe.ingredients?.some((ri) => ri.ingredient_id === i.id))
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.details ? `${i.name} (${i.details})` : i.name}
                            </option>
                          ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Qty"
                        value={addIngredientQty}
                        onChange={(e) => setAddIngredientQty(e.target.value)}
                        className="qty-input"
                      />
                      <select
                        value={addIngredientMeasureId}
                        onChange={(e) => setAddIngredientMeasureId(e.target.value)}
                      >
                        <option value="">Unit</option>
                        {measurements.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Comment"
                        value={addIngredientComment}
                        onChange={(e) => setAddIngredientComment(e.target.value)}
                        className="comment-input"
                      />
                      <label className="optional-checkbox">
                        <input
                          type="checkbox"
                          checked={addIngredientOptional}
                          onChange={(e) => setAddIngredientOptional(e.target.checked)}
                        />
                        Optional
                      </label>
                      <button type="submit" className="btn btn-primary">Add</button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default RecipeDetailPage;
