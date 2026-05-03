import React, { useState, useEffect, useMemo } from 'react';
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
  updateRecipeIngredient,
  removeRecipeIngredient,
  addRecipeToShoppingList,
  patchRecipePlanned,
} from '../api/api';
import { formatRecipeQuantity } from '../utils/recipeQuantity';
import {
  sortMeasurementsForRecipeEditor,
  formatRecipeMeasurementOptionLabel,
} from '../utils/recipeMeasurements';
import { itemDisplayName } from '../utils/shoppingQuantity';
import {
  buildRecipeShoppingListNoticeText,
  recipeShoppingListNoticeClassName,
} from '../utils/recipeShoppingListNotice';
import { parseRecipeSteps } from '../utils/recipeSteps';
import {
  formatRecipeIngredientNutritionSuffix,
  formatRecipeKcalPerServingDisplay,
  sumRecipeLineKcal,
} from '../utils/recipeIngredientNutrition';
import { RecipeMakeItOverlay } from '../components/RecipeMakeItOverlay';
import './RecipeDetailPage.css';

const RECIPE_SCALE_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
  { value: 5, label: '5x' },
];

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
  const [form, setForm] = useState({ name: '', servings: 1, category_ids: [], instructions: '' });
  const [addIngredientId, setAddIngredientId] = useState('');
  const [addIngredientQty, setAddIngredientQty] = useState('');
  const [addIngredientMeasureId, setAddIngredientMeasureId] = useState('');
  const [addIngredientComment, setAddIngredientComment] = useState('');
  const [addIngredientOptional, setAddIngredientOptional] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState(null);
  const [editIngredientForm, setEditIngredientForm] = useState({ qty: '', measurement_id: '', comment: '', is_optional: false });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addingToShoppingList, setAddingToShoppingList] = useState(false);
  const [markingPrepared, setMarkingPrepared] = useState(false);
  const [shopNotice, setShopNotice] = useState(null); // { text, className }
  const [makeItOpen, setMakeItOpen] = useState(false);
  const [recipeScale, setRecipeScale] = useState('1');

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      loadOptions();
      setForm({ name: '', servings: 1, category_ids: [], instructions: '' });
      return;
    }
    loadRecipe();
    loadOptions();
  }, [id, isNew]);

  useEffect(() => {
    if (isNew && categories.length > 0 && form.category_ids.length === 0) {
      setForm((f) => ({ ...f, category_ids: [categories[0].id] }));
    }
  }, [isNew, categories, form.category_ids.length]);

  const recipeMeasurementsSorted = useMemo(
    () => sortMeasurementsForRecipeEditor(measurements),
    [measurements]
  );

  const recipeKcalPerServingDisplay = useMemo(() => {
    if (!recipe) return null;
    const rtk = recipe.recipe_total_kcal;
    const total =
      rtk != null && Number.isFinite(Number(rtk)) ? Number(rtk) : sumRecipeLineKcal(recipe.ingredients, 1);
    if (total == null) return null;
    const servingsShown = editing
      ? Number(form.servings) || recipe.servings
      : recipe.servings;
    return formatRecipeKcalPerServingDisplay(total, servingsShown);
  }, [
    recipe,
    recipe?.recipe_total_kcal,
    recipe?.ingredients,
    recipe?.servings,
    editing,
    form.servings,
  ]);

  const makeItIngredients = useMemo(() => {
    if (!recipe?.ingredients?.length) return [];
    return recipe.ingredients.map((row) => {
      let line = row.is_optional ? 'Optional: ' : '';
      const name = itemDisplayName({
        name: row.ingredient_name,
        details: row.ingredient_details,
      });
      const qty = row.qty != null ? formatRecipeQuantity(row.qty) : '';
      const measure = row.measurement_name || '';
      const part = [qty, measure].filter(Boolean).join(' ');
      line += part ? `${part} ${name}` : name;
      line += formatRecipeIngredientNutritionSuffix(row);
      if (row.comment) line += ` — ${row.comment}`;
      return { id: row.ingredient_id, line };
    });
  }, [recipe]);

  const makeItSteps = useMemo(
    () => (recipe?.instructions ? parseRecipeSteps(recipe.instructions) : []),
    [recipe?.instructions]
  );

  const loadOptions = async () => {
    try {
      const [catRes, ingRes, measRes] = await Promise.all([
        getRecipeCategories(),
        getIngredients({ for_recipe: 1 }),
        getIngredientMeasurements(),
      ]);
      setCategories(catRes.data);
      setIngredientsCatalog(ingRes.data);
      setMeasurements(measRes.data);
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  };

  const loadRecipe = async (options = {}) => {
    const { preserveForm = false } = options;
    setLoading(true);
    setError(null);
    setShopNotice(null);
    try {
      const res = await getRecipe(id);
      setRecipe(res.data);
      if (!preserveForm) {
        setForm({
          name: res.data.name,
          servings: res.data.servings,
          category_ids: res.data.category_ids || [],
          instructions: res.data.instructions ?? '',
        });
      }
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
          category_ids: form.category_ids,
          instructions: form.instructions || null,
        });
        navigate(`/recipes/${res.data.id}`, { replace: true });
        return;
      }
      await updateRecipe(id, {
        name: form.name,
        servings: Number(form.servings) || 1,
        category_ids: form.category_ids,
        instructions: form.instructions || null,
      });
      setRecipe((prev) => prev && { ...prev, ...form, category_names: categories.filter((c) => form.category_ids.includes(c.id)).map((c) => c.name).join(', ') });
      setEditing(false);
      await loadRecipe({ preserveForm: editing });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save recipe');
    }
  };

  const handleAddRecipeToShoppingList = async () => {
    if (isNew || !id) return;
    setError(null);
    setShopNotice(null);
    setAddingToShoppingList(true);
    try {
      const scale = Number(recipeScale) || 1;
      const res = await addRecipeToShoppingList(id, scale);
      const data = res.data || {};
      setShopNotice({
        text: buildRecipeShoppingListNoticeText(recipe?.name, data),
        className: recipeShoppingListNoticeClassName(data),
      });
      await loadRecipe();
    } catch (err) {
      setShopNotice(null);
      setError(err.response?.data?.error || err.message || 'Failed to add recipe to shopping list');
    } finally {
      setAddingToShoppingList(false);
    }
  };

  const handleMarkPrepared = async () => {
    if (isNew || !id) return;
    setError(null);
    setMarkingPrepared(true);
    try {
      await patchRecipePlanned(id, false);
      await loadRecipe();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to mark recipe as prepared');
    } finally {
      setMarkingPrepared(false);
    }
  };

  const openPrintPage = () => {
    if (isNew || !id) return;
    const scale = Number(recipeScale) || 1;
    const url = `/recipes/${id}/print?scale=${encodeURIComponent(String(scale))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const executeDeleteRecipe = async () => {
    setDeleteConfirmOpen(false);
    setError(null);
    try {
      await deleteRecipe(id);
      navigate('/recipes');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete recipe');
    }
  };

  const handleAddIngredient = async (e) => {
    e?.preventDefault?.();
    if (!addIngredientId) return;
    setError(null);
    const measureIdRaw = String(addIngredientMeasureId ?? '').trim();
    if (!measureIdRaw) {
      setError('Select a unit for the ingredient.');
      return;
    }
    const measurementId = Number(measureIdRaw);
    if (!Number.isFinite(measurementId) || !recipeMeasurementsSorted.some((m) => Number(m.id) === measurementId)) {
      setError('Select a valid unit for the ingredient.');
      return;
    }
    try {
      await addRecipeIngredient(id, {
        ingredient_id: Number(addIngredientId),
        qty: addIngredientQty ? parseFloat(addIngredientQty) : null,
        measurement_id: measurementId,
        comment: addIngredientComment.trim() || null,
        is_optional: addIngredientOptional,
      });
      setAddIngredientId('');
      setAddIngredientQty('');
      setAddIngredientMeasureId('');
      setAddIngredientComment('');
      setAddIngredientOptional(false);
      await loadRecipe({ preserveForm: editing });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add ingredient');
    }
  };

  const handleRemoveIngredient = async (ingredientId) => {
    try {
      await removeRecipeIngredient(id, ingredientId);
      await loadRecipe({ preserveForm: editing });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to remove ingredient');
    }
  };

  const startEditIngredient = (row) => {
    setEditingIngredientId(row.ingredient_id);
    setEditIngredientForm({
      qty: row.qty != null ? String(row.qty) : '',
      measurement_id: row.measurement_id != null ? String(row.measurement_id) : '',
      comment: row.comment || '',
      is_optional: Boolean(row.is_optional),
    });
  };

  const cancelEditIngredient = () => {
    setEditingIngredientId(null);
    setEditIngredientForm({ qty: '', measurement_id: '', comment: '', is_optional: false });
  };

  const handleSaveEditIngredient = async (ingredientId) => {
    setError(null);
    const measureIdRaw = String(editIngredientForm.measurement_id ?? '').trim();
    if (!measureIdRaw) {
      setError('Select a unit for the ingredient.');
      return;
    }
    const measurementId = Number(measureIdRaw);
    if (!Number.isFinite(measurementId) || !recipeMeasurementsSorted.some((m) => Number(m.id) === measurementId)) {
      setError('Select a valid unit for the ingredient.');
      return;
    }
    try {
      await updateRecipeIngredient(id, ingredientId, {
        qty: editIngredientForm.qty ? parseFloat(editIngredientForm.qty) : null,
        measurement_id: measurementId,
        comment: editIngredientForm.comment.trim() || null,
        is_optional: editIngredientForm.is_optional,
      });
      setEditingIngredientId(null);
      setEditIngredientForm({ qty: '', measurement_id: '', comment: '', is_optional: false });
      loadRecipe();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update ingredient');
    }
  };

  const toggleCategory = (categoryId) => {
    setForm((f) => ({
      ...f,
      category_ids: f.category_ids.includes(categoryId)
        ? f.category_ids.filter((cid) => cid !== categoryId)
        : [...f.category_ids, categoryId],
    }));
  };

  const formatIngredientLine = (row) => {
    const name = itemDisplayName({
      name: row.ingredient_name,
      details: row.ingredient_details,
    });
    const qty = row.qty != null ? formatRecipeQuantity(row.qty) : '';
    const measure = row.measurement_name || '';
    const part = [qty, measure].filter(Boolean).join(' ');
    return part ? `${part} ${name}` : name;
  };

  /** Prefix * when the catalog row has no kcal (nutrition not filled in). */
  const formatCatalogIngredientLabel = (i) => {
    const prefix = i.kcal == null ? '* ' : '';
    return `${prefix}${itemDisplayName(i)}`;
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
    <div className="recipe-detail-page page-scroll">
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

      {shopNotice && (
        <div className={shopNotice.className} role="status">
          {shopNotice.text}
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
                <label>Categories</label>
                <div className="category-checkboxes">
                  {categories.map((c) => (
                    <label key={c.id} className="category-checkbox">
                      <input
                        type="checkbox"
                        checked={form.category_ids.includes(c.id)}
                        onChange={() => toggleCategory(c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="form-row instructions-row">
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
            <p className="recipe-meta">{recipe.category_names || 'Uncategorized'}</p>
              <p className="recipe-servings-header-row">
                <span>
                  Servings:{' '}
                  {editing ? Number(form.servings) || recipe.servings : recipe.servings}
                </span>
                {recipeKcalPerServingDisplay != null ? (
                  <span className="recipe-kcal-per-serving">{recipeKcalPerServingDisplay}</span>
                ) : null}
              </p>
              <div className="recipe-detail-actions">
                <div className="recipe-detail-actions-primary">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditing(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={(e) => handleSaveRecipe(e)}
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setMakeItOpen(true)}
                      >
                        Make it
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={openPrintPage}
                      >
                        Print / PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          // Defer so this click cannot complete on Save/Cancel after they replace Edit (same slot).
                          setTimeout(() => setEditing(true), 0);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setDeleteConfirmOpen(true)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
                {!editing && (
                  <div className="recipe-detail-shop-actions">
                    {recipe.planned_at && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleMarkPrepared}
                        disabled={markingPrepared}
                      >
                        {markingPrepared ? 'Updating…' : 'Prepared'}
                      </button>
                    )}
                    <button
                      type="button"
                      className={
                        recipe.planned_at
                          ? 'btn btn-secondary recipe-detail-add-to-list'
                          : 'btn btn-primary recipe-detail-add-to-list'
                      }
                      onClick={handleAddRecipeToShoppingList}
                      disabled={addingToShoppingList}
                    >
                      {addingToShoppingList ? 'Adding…' : 'Add to shopping list'}
                    </button>
                    <label className="recipe-detail-scale-control">
                      <span>Scale</span>
                      <select
                        value={recipeScale}
                        onChange={(e) => setRecipeScale(e.target.value)}
                        disabled={addingToShoppingList}
                      >
                        {RECIPE_SCALE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {editing ? (
              <form id="recipe-edit-form" onSubmit={handleSaveRecipe} className="recipe-detail-form">
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
                    <label>Categories</label>
                    <div className="category-checkboxes">
                      {categories.map((c) => (
                        <label key={c.id} className="category-checkbox">
                          <input
                            type="checkbox"
                            checked={form.category_ids.includes(c.id)}
                            onChange={() => toggleCategory(c.id)}
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="recipe-ingredients-section">
                  <div className="form-row recipe-servings-row recipe-servings-with-total">
                    <div className="recipe-servings-input-wrap">
                      <label>Servings</label>
                      <input
                        type="number"
                        min={1}
                        value={form.servings}
                        onChange={(e) => setForm((f) => ({ ...f, servings: e.target.value }))}
                      />
                    </div>
                    {recipeKcalPerServingDisplay != null ? (
                      <span className="recipe-kcal-per-serving">{recipeKcalPerServingDisplay}</span>
                    ) : null}
                  </div>
                  <h2>Ingredients</h2>
                  {recipe.ingredients && recipe.ingredients.length > 0 ? (
                    <ul className="recipe-ingredients-list">
                      {recipe.ingredients.map((row) => {
                        const nutritionSuffix = formatRecipeIngredientNutritionSuffix(row);
                        return (
                        <li key={row.ingredient_id} className="recipe-ingredient-row">
                          {editingIngredientId === row.ingredient_id ? (
                            <div className="ingredient-edit-inline">
                              <input
                                type="text"
                                placeholder="Qty"
                                value={editIngredientForm.qty}
                                onChange={(e) => setEditIngredientForm((f) => ({ ...f, qty: e.target.value }))}
                                className="qty-input"
                              />
                              <select
                                value={editIngredientForm.measurement_id}
                                onChange={(e) => setEditIngredientForm((f) => ({ ...f, measurement_id: e.target.value }))}
                              >
                                <option value="">- Select Unit -</option>
                                {recipeMeasurementsSorted.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {formatRecipeMeasurementOptionLabel(m)}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Comment"
                                value={editIngredientForm.comment}
                                onChange={(e) => setEditIngredientForm((f) => ({ ...f, comment: e.target.value }))}
                                className="comment-input"
                              />
                              <label className="optional-checkbox">
                                <input
                                  type="checkbox"
                                  checked={editIngredientForm.is_optional}
                                  onChange={(e) => setEditIngredientForm((f) => ({ ...f, is_optional: e.target.checked }))}
                                />
                                Optional
                              </label>
                              <span className="ingredient-edit-name">{itemDisplayName({ name: row.ingredient_name, details: row.ingredient_details })}</span>
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSaveEditIngredient(row.ingredient_id)}>Save</button>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEditIngredient}>Cancel</button>
                            </div>
                          ) : (
                            <>
                              <span className="ingredient-line">
                                {row.is_optional && <span className="ingredient-optional">Optional: </span>}
                                {formatIngredientLine(row)}
                                {nutritionSuffix ? (
                                  <span className="ingredient-nutrition-meta">{nutritionSuffix}</span>
                                ) : null}
                                {row.comment && <span className="ingredient-comment"> — {row.comment}</span>}
                              </span>
                              <button type="button" className="btn-edit-ingredient" onClick={() => startEditIngredient(row)} title="Edit">Edit</button>
                              <button type="button" className="btn-remove-ingredient" onClick={() => handleRemoveIngredient(row.ingredient_id)} title="Remove">×</button>
                            </>
                          )}
                        </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="recipe-no-ingredients">No ingredients yet.</p>
                  )}

                  <div className="add-ingredient-form">
                    <h3>Add ingredient</h3>
                    <div
                      className="add-ingredient-fields"
                      onKeyDown={(ev) => {
                        if (ev.key !== 'Enter' || ev.target.tagName === 'TEXTAREA') return;
                        ev.preventDefault();
                        handleAddIngredient(ev);
                      }}
                    >
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
                              {formatCatalogIngredientLabel(i)}
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
                        <option value="">- Select Unit -</option>
                        {recipeMeasurementsSorted.map((m) => (
                          <option key={m.id} value={m.id}>
                            {formatRecipeMeasurementOptionLabel(m)}
                          </option>
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
                      <button type="button" className="btn btn-primary" onClick={handleAddIngredient}>
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-row instructions-row">
                  <label>Instructions</label>
                  <textarea
                    value={form.instructions}
                    onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                    rows={6}
                  />
                </div>
              </form>
            ) : (
              <>
                <div className="recipe-ingredients-section">
                  <p className="recipe-servings-display">
                    <span>Servings: {recipe.servings}</span>
                    {recipeKcalPerServingDisplay != null ? (
                      <span className="recipe-kcal-per-serving">{recipeKcalPerServingDisplay}</span>
                    ) : null}
                  </p>
                  <h2>Ingredients</h2>
                  {recipe.ingredients && recipe.ingredients.length > 0 ? (
                    <ul className="recipe-ingredients-list">
                      {recipe.ingredients.map((row) => {
                        const nutritionSuffix = formatRecipeIngredientNutritionSuffix(row);
                        return (
                        <li key={row.ingredient_id} className="recipe-ingredient-row">
                          <span className="ingredient-line">
                            {row.is_optional && <span className="ingredient-optional">Optional: </span>}
                            {formatIngredientLine(row)}
                            {nutritionSuffix ? (
                              <span className="ingredient-nutrition-meta">{nutritionSuffix}</span>
                            ) : null}
                            {row.comment && <span className="ingredient-comment"> — {row.comment}</span>}
                          </span>
                        </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="recipe-no-ingredients">No ingredients yet.</p>
                  )}
                </div>

                {recipe.instructions && (
                  <div className="recipe-instructions">
                    <h2>Instructions</h2>
                    <pre className="recipe-instructions-text">{recipe.instructions}</pre>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {makeItOpen && recipe && (
        <RecipeMakeItOverlay
          recipeName={recipe.name}
          ingredients={makeItIngredients}
          steps={makeItSteps}
          onClose={() => setMakeItOpen(false)}
        />
      )}

      {!isNew && deleteConfirmOpen && recipe && (
        <div
          className="recipe-delete-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recipe-delete-title"
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <div className="recipe-delete-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="recipe-delete-title" className="recipe-delete-title">
              Delete recipe?
            </h2>
            <p className="recipe-delete-body">
              Delete &quot;{recipe.name}&quot;? This cannot be undone.
            </p>
            <div className="recipe-delete-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={executeDeleteRecipe}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecipeDetailPage;
