import React, { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  getIngredients,
  getIngredientMeasurements,
  getDepartments,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from '../api/api';
import './IngredientsCatalogPage.css';

function IngredientsCatalogPage() {
  const [ingredients, setIngredients] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [error, setError] = useState(null);
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [form, setForm] = useState({
    name: '', details: '', kcal: '', qty: '', measurement_id: '', department_id: '',
    shopping_measure: '', shopping_measure_grams: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [ingRes, measRes, deptRes] = await Promise.all([
        getIngredients(),
        getIngredientMeasurements(),
        getDepartments(),
      ]);
      setIngredients(ingRes.data);
      setMeasurements(measRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error('Failed to load:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load');
    }
  };

  const resetForm = () => {
    setForm({
      name: '', details: '', kcal: '', qty: '', measurement_id: '', department_id: '',
      shopping_measure: '', shopping_measure_grams: '',
    });
    setEditingId(null);
  };

  const startEdit = (ing) => {
    setEditingId(ing.id);
    setForm({
      name: ing.name,
      details: ing.details || '',
      kcal: ing.kcal != null ? String(ing.kcal) : '',
      qty: ing.qty != null ? String(ing.qty) : '',
      measurement_id: ing.measurement_id != null ? String(ing.measurement_id) : '',
      department_id: ing.department_id != null ? String(ing.department_id) : '',
      shopping_measure: ing.shopping_measure || '',
      shopping_measure_grams: ing.shopping_measure_grams != null ? String(ing.shopping_measure_grams) : '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        details: form.details.trim() || null,
        kcal: form.kcal === '' ? null : parseInt(form.kcal, 10),
        qty: form.qty === '' ? 0 : parseFloat(form.qty),
        measurement_id: form.measurement_id === '' ? null : Number(form.measurement_id),
        department_id: Number(form.department_id),
        shopping_measure: form.shopping_measure.trim() || null,
        shopping_measure_grams: form.shopping_measure_grams === '' ? null : parseFloat(form.shopping_measure_grams),
      };
      if (!payload.department_id) {
        setError('Department is required');
        setSaving(false);
        return;
      }
      if (editingId) {
        await updateIngredient(editingId, payload);
      } else {
        await createIngredient(payload);
      }
      resetForm();
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save ingredient');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this ingredient? It may be used in recipes.')) return;
    setError(null);
    try {
      await deleteIngredient(id);
      if (editingId === id) resetForm();
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete ingredient');
    }
  };

  const searchText = ingredientFilter.trim().toLowerCase();
  const filteredIngredients = searchText
    ? ingredients.filter((ing) => {
        const name = (ing.name || '').toLowerCase();
        const details = (ing.details || '').toLowerCase();
        const dept = (ing.department_name || '').toLowerCase();
        const shopping = (ing.shopping_measure || '').toLowerCase();
        return name.includes(searchText) || details.includes(searchText) || dept.includes(searchText) || shopping.includes(searchText);
      })
    : ingredients;

  return (
    <div className="ingredients-catalog-page page-scroll">
      <div className="ingredients-catalog-breadcrumb">
        <Link to="/recipes">Recipes</Link>
        <span className="breadcrumb-sep">/</span>
        <span>Ingredients</span>
      </div>

      <nav className="recipes-subnav ingredients-subnav" aria-label="Recipes section">
        <NavLink to="/recipes" end className={({ isActive }) => isActive ? 'recipes-subnav-link active' : 'recipes-subnav-link'}>
          Recipes
        </NavLink>
        <NavLink to="/recipes/ingredients" className={({ isActive }) => isActive ? 'recipes-subnav-link active' : 'recipes-subnav-link'}>
          Ingredients
        </NavLink>
      </nav>

      {error && (
        <div className="ingredients-catalog-error" role="alert">
          {error}
        </div>
      )}

      <section className="ingredients-catalog-card">
        <h1 className="ingredients-catalog-title">Ingredients catalog</h1>
        <p className="ingredients-catalog-description">
          Add and edit ingredients. kcal and qty are per measurement (e.g. kcal for 5 oz). Shopping measure is how you buy the item (e.g. small jar, each).
        </p>

        <form onSubmit={handleSubmit} className="ingredients-catalog-form">
          <h2>{editingId ? 'Edit ingredient' : 'Add ingredient'}</h2>
          <div className="ingredients-catalog-form-grid">
            <div className="form-group">
              <label>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ingredient name"
                required
              />
            </div>
            <div className="form-group">
              <label>Details</label>
              <input
                value={form.details}
                onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                placeholder="Extra info"
              />
            </div>
            <div className="form-group">
              <label>Department *</label>
              <select
                value={form.department_id}
                onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                required
              >
                <option value="">Select…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Measurement</label>
              <select
                value={form.measurement_id}
                onChange={(e) => setForm((f) => ({ ...f, measurement_id: e.target.value }))}
              >
                <option value="">—</option>
                {measurements.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Qty</label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label>kcal</label>
              <input
                type="number"
                step="1"
                min="0"
                value={form.kcal}
                onChange={(e) => setForm((f) => ({ ...f, kcal: e.target.value }))}
                placeholder="Calories for qty + measurement"
              />
            </div>
            <div className="form-group">
              <label>Shopping measure</label>
              <input
                value={form.shopping_measure}
                onChange={(e) => setForm((f) => ({ ...f, shopping_measure: e.target.value }))}
                placeholder="e.g. small jar, each"
              />
            </div>
            <div className="form-group">
              <label>Shopping measure (grams)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.shopping_measure_grams}
                onChange={(e) => setForm((f) => ({ ...f, shopping_measure_grams: e.target.value }))}
                placeholder="Grams per purchase unit"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : (editingId ? 'Update' : 'Add')}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="ingredients-catalog-list-section">
          <h2>All ingredients</h2>
          <div className="filter-section">
            <input
              type="text"
              placeholder="Filter by name, details, department, or shopping measure..."
              value={ingredientFilter}
              onChange={(e) => setIngredientFilter(e.target.value)}
              className="filter-input"
            />
            <div className="filter-info">
              {filteredIngredients.length} ingredient{filteredIngredients.length !== 1 ? 's' : ''} found
            </div>
          </div>
          {ingredients.length === 0 ? (
            <p className="ingredients-catalog-empty">No ingredients in catalog yet. Add one above.</p>
          ) : filteredIngredients.length === 0 ? (
            <p className="ingredients-catalog-empty">{ingredientFilter ? 'No ingredients match your search' : 'No ingredients in catalog yet. Add one above.'}</p>
          ) : (
            <ul className="ingredients-catalog-list">
              {filteredIngredients.map((ing) => (
                <li key={ing.id} className="ingredients-catalog-list-item">
                  <span className="ingredients-catalog-item-name">
                    {ing.details ? `${ing.name} (${ing.details})` : ing.name}
                  </span>
                  <span className="ingredients-catalog-item-meta">
                    {ing.department_name}
                    {ing.measurement_name && ` · ${ing.qty != null ? ing.qty : ''} ${ing.measurement_name}`.trim()}
                    {ing.kcal != null && ` · ${ing.kcal} kcal`}
                    {ing.shopping_measure && ` · Buy: ${ing.shopping_measure}`}
                  </span>
                  <div className="ingredients-catalog-item-actions">
                    <button type="button" className="btn-edit-ingredient" onClick={() => startEdit(ing)}>Edit</button>
                    <button type="button" className="btn-remove-ingredient" onClick={() => handleDelete(ing.id)} title="Delete">×</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default IngredientsCatalogPage;
