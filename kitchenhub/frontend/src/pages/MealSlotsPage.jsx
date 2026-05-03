import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getMealPlannerSlots,
  createMealPlannerSlot,
  updateMealPlannerSlot,
  reorderMealPlannerSlots,
  deleteMealPlannerSlot,
} from '../api/api';
import RecipesSectionNav from '../components/RecipesSectionNav';
import './RecipesPage.css';
import './MealSlotsPage.css';

function MealSlotsPage() {
  const [slots, setSlots] = useState([]);
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [newSlot, setNewSlot] = useState({ name: '', servings: '4', kcal: '' });
  const [creating, setCreating] = useState(false);
  const [forms, setForms] = useState({});

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMealPlannerSlots();
      const data = res.data || {};
      const list = data.slots || [];
      setSupported(data.supported !== false);
      setSlots(list);
      const f = {};
      list.forEach((s) => {
        f[s.id] = {
          name: s.name || '',
          servings: String(s.servings ?? 4),
          kcal: s.kcal != null ? String(s.kcal) : '',
        };
      });
      setForms(f);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load meal slots');
      setSlots([]);
      setForms({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const orderedSlots = useMemo(
    () => [...slots].sort((a, b) => (a.seq ?? a.id) - (b.seq ?? b.id)),
    [slots]
  );

  const updateForm = (id, field, value) => {
    setForms((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSaveRow = async (id) => {
    const row = forms[id];
    if (!row) return;
    const name = row.name.trim();
    if (!name) {
      setError('Each slot needs a name.');
      return;
    }
    const servings = parseInt(row.servings, 10);
    if (Number.isNaN(servings) || servings < 1) {
      setError('Servings must be a positive integer.');
      return;
    }
    const kcalTrim = row.kcal.trim();
    const kcal = kcalTrim === '' ? null : parseInt(kcalTrim, 10);
    if (kcal != null && (Number.isNaN(kcal) || kcal < 1)) {
      setError('Target kcal must be blank or a positive integer.');
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      await updateMealPlannerSlot(id, { name, servings, kcal });
      await loadSlots();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save');
    } finally {
      setSavingId(null);
    }
  };

  const handleMove = async (index, direction) => {
    const ids = orderedSlots.map((s) => s.id);
    const j = index + direction;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[index], next[j]] = [next[j], next[index]];
    setReordering(true);
    setError(null);
    try {
      await reorderMealPlannerSlots(next);
      await loadSlots();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to reorder');
    } finally {
      setReordering(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newSlot.name.trim();
    if (!name) {
      setError('Enter a name for the new slot.');
      return;
    }
    const servings = parseInt(newSlot.servings, 10);
    if (Number.isNaN(servings) || servings < 1) {
      setError('Default servings must be a positive integer.');
      return;
    }
    const kcalTrim = newSlot.kcal.trim();
    const kcal = kcalTrim === '' ? null : parseInt(kcalTrim, 10);
    if (kcal != null && (Number.isNaN(kcal) || kcal < 1)) {
      setError('Target kcal must be blank or a positive integer.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createMealPlannerSlot({ name, servings, kcal });
      setNewSlot({ name: '', servings: '4', kcal: '' });
      await loadSlots();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create slot');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    const slot = slots.find((s) => s.id === id);
    const label = slot?.name || id;
    if (!window.confirm(`Delete meal slot “${label}”? This cannot be undone if the slot has no planned meals.`)) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      await deleteMealPlannerSlot(id);
      await loadSlots();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="recipes-page meal-slots-page page-scroll">
      <header className="recipes-header">
        <h1>Meal slots</h1>
        <RecipesSectionNav />
        <p className="recipes-subtitle">
          Define the meals that appear on each day in the meal planner (for example breakfast, lunch, dinner).
          Default servings apply when you assign a recipe; target kcal is optional for planner hints.
        </p>
      </header>

      {error && (
        <div className="recipes-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="recipes-loading">Loading meal slots…</p>
      ) : !supported ? (
        <div className="recipes-empty">
          <p>Meal planner tables are not installed in this database.</p>
        </div>
      ) : (
        <>
          <div className="meal-slots-table-wrap">
            <table className="meal-slots-table">
              <thead>
                <tr>
                  <th className="meal-slots-col-order">Order</th>
                  <th>Name</th>
                  <th>Default servings</th>
                  <th>Target kcal / serving</th>
                  <th className="meal-slots-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orderedSlots.map((slot, index) => {
                  const f = forms[slot.id] || { name: '', servings: '4', kcal: '' };
                  return (
                    <tr key={slot.id}>
                      <td>
                        <div className="meal-slots-order-btns">
                          <button
                            type="button"
                            className="btn btn-secondary meal-slots-icon-btn"
                            disabled={reordering || index === 0}
                            onClick={() => handleMove(index, -1)}
                            aria-label={`Move ${slot.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary meal-slots-icon-btn"
                            disabled={reordering || index === orderedSlots.length - 1}
                            onClick={() => handleMove(index, 1)}
                            aria-label={`Move ${slot.name} down`}
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="meal-slots-input"
                          value={f.name}
                          onChange={(e) => updateForm(slot.id, 'name', e.target.value)}
                          maxLength={80}
                          aria-label={`${slot.name} name`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          className="meal-slots-input meal-slots-input-narrow"
                          value={f.servings}
                          onChange={(e) => updateForm(slot.id, 'servings', e.target.value)}
                          aria-label={`${slot.name} default servings`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          className="meal-slots-input meal-slots-input-narrow"
                          placeholder="—"
                          value={f.kcal}
                          onChange={(e) => updateForm(slot.id, 'kcal', e.target.value)}
                          aria-label={`${slot.name} target kcal`}
                        />
                      </td>
                      <td>
                        <div className="meal-slots-row-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={savingId === slot.id}
                            onClick={() => handleSaveRow(slot.id)}
                          >
                            {savingId === slot.id ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={deletingId === slot.id || orderedSlots.length <= 1}
                            onClick={() => handleDelete(slot.id)}
                          >
                            {deletingId === slot.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="meal-slots-add" aria-labelledby="meal-slots-add-heading">
            <h2 id="meal-slots-add-heading" className="meal-slots-add-title">
              Add a slot
            </h2>
            <form className="meal-slots-add-form" onSubmit={handleCreate}>
              <label className="meal-slots-add-label">
                Name
                <input
                  type="text"
                  className="meal-slots-input"
                  value={newSlot.name}
                  onChange={(e) => setNewSlot((p) => ({ ...p, name: e.target.value }))}
                  maxLength={80}
                  required
                />
              </label>
              <label className="meal-slots-add-label">
                Default servings
                <input
                  type="number"
                  min={1}
                  className="meal-slots-input meal-slots-input-narrow"
                  value={newSlot.servings}
                  onChange={(e) => setNewSlot((p) => ({ ...p, servings: e.target.value }))}
                />
              </label>
              <label className="meal-slots-add-label">
                Target kcal (optional)
                <input
                  type="number"
                  min={1}
                  className="meal-slots-input meal-slots-input-narrow"
                  placeholder="—"
                  value={newSlot.kcal}
                  onChange={(e) => setNewSlot((p) => ({ ...p, kcal: e.target.value }))}
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Adding…' : 'Add slot'}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

export default MealSlotsPage;
