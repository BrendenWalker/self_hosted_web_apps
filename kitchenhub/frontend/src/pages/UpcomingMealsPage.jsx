import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getMealPlanner,
  getRecipes,
  getRecipeCategories,
  assignMealPlannerMeal,
  clearMealPlannerMeal,
  updateMealPlannerServings,
  autoLinkMealPlannerLeftovers,
  addMealPlannerWeekToShoppingList,
} from '../api/api';
import './RecipesPage.css';
import './UpcomingMealsPage.css';

const MEAL_PLAN_SHOP_SCALE_OPTIONS = [0.5, 1, 2, 3, 4, 5];

function parseDateOnly(dateText) {
  const [y, m, d] = String(dateText || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(date = new Date()) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return utc;
}

function dayHeaderLabel(dateText) {
  const parsed = parseDateOnly(dateText);
  if (!parsed) return dateText;
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function getSlotKcalStatus(slot) {
  const recipeKcal = slot?.meal?.kcal_per_serving;
  const slotKcal = slot?.kcal;
  if (recipeKcal == null || slotKcal == null) return null;
  if (recipeKcal > slotKcal) return 'over';
  if (recipeKcal < slotKcal) return 'under';
  return 'equal';
}

function UpcomingMealsPage() {
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [plannerDays, setPlannerDays] = useState([]);
  const [weekStart, setWeekStart] = useState(() => formatDateOnly(getWeekStart()));
  const [recipeFilter, setRecipeFilter] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [shopScale, setShopScale] = useState(1);
  const [addingWeekShop, setAddingWeekShop] = useState(false);
  const [shopNotice, setShopNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const selectedCategoryId = categoryId === '' ? undefined : categoryId;
        const [recipesRes, plannerRes, categoriesRes] = await Promise.allSettled([
          getRecipes(selectedCategoryId, { schedulable: true }),
          getMealPlanner(weekStart),
          getRecipeCategories({ schedulable: true }),
        ]);
        if (!cancelled) {
          if (recipesRes.status === 'fulfilled') {
            setRecipes(recipesRes.value?.data || []);
          } else {
            setRecipes([]);
            setError(
              recipesRes.reason?.response?.data?.error ||
              recipesRes.reason?.message ||
              'Failed to load recipes'
            );
          }

          if (plannerRes.status === 'fulfilled') {
            const days = plannerRes.value?.data?.days || [];
            setPlannerDays(days);
          } else {
            setPlannerDays([]);
            setError((prev) => (
              prev ||
              plannerRes.reason?.response?.data?.error ||
              plannerRes.reason?.message ||
              'Failed to load meal planner'
            ));
          }

          if (categoriesRes.status === 'fulfilled') {
            setCategories(categoriesRes.value?.data || []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || 'Failed to load meal planner');
          setRecipes([]);
          setPlannerDays([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, categoryId]);

  const recipeMap = useMemo(
    () => new Map(recipes.map((recipe) => [String(recipe.id), recipe])),
    [recipes]
  );

  const filteredRecipes = useMemo(() => {
    const search = recipeFilter.trim().toLowerCase();
    if (!search) return recipes;
    return recipes.filter((recipe) => (recipe.name || '').toLowerCase().includes(search));
  }, [recipes, recipeFilter]);

  const dayKcalTotals = useMemo(() => {
    const totals = new Map();
    for (const day of plannerDays) {
      const total = (day.slots || []).reduce((sum, slot) => {
        if (slot?.meal?.kcal_per_serving == null) return sum;
        return sum + Number(slot.meal.kcal_per_serving || 0);
      }, 0);
      totals.set(day.date, total);
    }
    return totals;
  }, [plannerDays]);

  const moveWeek = (days) => {
    const start = parseDateOnly(weekStart) || getWeekStart();
    start.setUTCDate(start.getUTCDate() + days);
    setWeekStart(formatDateOnly(start));
  };

  const handleDrop = async (event, dayDate, slotId) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData('application/x-kitchenhub-meal');
    if (!payload) return;
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }
    if (!parsed?.recipeId) return;
    const source = parsed.sourceDate && parsed.sourceSlotId
      ? {
        meal_date: parsed.sourceDate,
        meal_slot_id: parsed.sourceSlotId,
        leftover_from_meal_id: parsed.leftoverFromMealId ?? null,
        leftover_servings: parsed.leftoverServings ?? null,
      }
      : undefined;
    setError(null);
    setSaving(true);
    try {
      await assignMealPlannerMeal(dayDate, slotId, parsed.recipeId, source);
      const plannerRes = await getMealPlanner(weekStart);
      setPlannerDays(plannerRes.data?.days || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to assign meal');
    } finally {
      setSaving(false);
    }
  };

  const handleClearSlot = async (dayDate, slotId) => {
    setError(null);
    setSaving(true);
    try {
      await clearMealPlannerMeal(dayDate, slotId);
      const plannerRes = await getMealPlanner(weekStart);
      setPlannerDays(plannerRes.data?.days || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to clear meal slot');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustServings = async (dayDate, slotId, nextServings) => {
    if (nextServings < 1) return;
    setError(null);
    setSaving(true);
    try {
      await updateMealPlannerServings(dayDate, slotId, nextServings);
      const plannerRes = await getMealPlanner(weekStart);
      setPlannerDays(plannerRes.data?.days || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update servings');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoLinkLeftovers = async (dayDate, slotId) => {
    setError(null);
    setSaving(true);
    try {
      await autoLinkMealPlannerLeftovers(dayDate, slotId);
      const plannerRes = await getMealPlanner(weekStart);
      setPlannerDays(plannerRes.data?.days || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to auto-link leftovers');
    } finally {
      setSaving(false);
    }
  };

  const handleAddWeekToShoppingList = async () => {
    setError(null);
    setShopNotice(null);
    setAddingWeekShop(true);
    try {
      const res = await addMealPlannerWeekToShoppingList(weekStart, shopScale);
      const data = res.data || {};
      const meals = data.meals || [];
      const withAdds = meals.filter((m) => m.added_count > 0).length;
      const skippedMeals = meals.length - withAdds;
      setShopNotice(
        `Shopping list: ${withAdds} meal${withAdds === 1 ? '' : 's'} updated` +
          (skippedMeals ? ` (${skippedMeals} already added or had nothing to add)` : '') +
          `.`
      );
      const plannerRes = await getMealPlanner(weekStart);
      setPlannerDays(plannerRes.data?.days || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add week to shopping list');
    } finally {
      setAddingWeekShop(false);
    }
  };

  return (
    <div className="recipes-page upcoming-meals-page page-scroll">
      <header className="recipes-header">
        <div className="meal-planner-header-row">
          <div className="meal-planner-header-copy">
            <h1>Meal Planner</h1>
            <p className="recipes-subtitle">
              Drag recipes into meal slots for each day of the week.
            </p>
          </div>
          <div className="meal-planner-header-right">
            <div className="meal-planner-week-controls">
              <button type="button" className="btn btn-secondary" onClick={() => moveWeek(-7)}>Previous week</button>
              <div className="meal-planner-week-label">{dayHeaderLabel(weekStart)} week</div>
              <button type="button" className="btn btn-secondary" onClick={() => moveWeek(7)}>Next week</button>
            </div>
            <div className="meal-planner-bulk-shop">
              <label className="meal-planner-bulk-shop-scale">
                <span>List scale</span>
                <select
                  value={String(shopScale)}
                  onChange={(e) => setShopScale(Number(e.target.value))}
                  disabled={addingWeekShop || saving}
                >
                  {MEAL_PLAN_SHOP_SCALE_OPTIONS.map((v) => (
                    <option key={v} value={String(v)}>
                      {v === 1 ? '1×' : `${v}×`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleAddWeekToShoppingList()}
                disabled={addingWeekShop || saving}
              >
                {addingWeekShop ? 'Adding…' : 'Add week to shopping list'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="recipes-error" role="alert">
          {error}
        </div>
      )}

      {shopNotice && (
        <div className="meal-planner-shop-notice" role="status">
          {shopNotice}
        </div>
      )}

      {loading ? (
        <p className="recipes-loading">Loading…</p>
      ) : recipes.length === 0 && plannerDays.length === 0 ? (
        <div className="recipes-empty">
          <p>No recipes available for planning yet.</p>
          <Link to="/recipes" className="btn btn-primary">
            Browse recipes
          </Link>
        </div>
      ) : (
        <div className="meal-planner-layout">
          <section className="meal-planner-grid" aria-label="Weekly meal planner">
            {plannerDays.map((day) => (
              <article key={day.date} className="meal-planner-day-column">
                <h3>{dayHeaderLabel(day.date)}</h3>
                <div className="meal-planner-day-kcal-total">
                  Total: {dayKcalTotals.get(day.date) || 0} kcal/serving
                </div>
                <ul className="meal-planner-slot-list">
                  {day.slots.map((slot) => (
                    <li key={`${day.date}-${slot.id}`} className="meal-planner-slot-item">
                      <div className="meal-planner-slot-title">
                        <span className="meal-planner-slot-name">{slot.name}</span>
                        <span className="meal-planner-slot-kcal-readonly">kcal: {slot.kcal ?? '—'}</span>
                      </div>
                      <div
                        className={`meal-planner-dropzone ${
                          getSlotKcalStatus(slot) ? `meal-planner-dropzone-${getSlotKcalStatus(slot)}` : ''
                        }`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, day.date, slot.id)}
                      >
                        {slot.meal ? (
                          <div
                            className="meal-planner-assigned"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData(
                                'application/x-kitchenhub-meal',
                                JSON.stringify({
                                  recipeId: slot.meal.id,
                                  sourceDate: day.date,
                                  sourceSlotId: slot.id,
                                  leftoverFromMealId: slot.meal.leftover_from_meal_id ?? null,
                                  leftoverServings: slot.meal.leftover_servings ?? null,
                                })
                              );
                            }}
                          >
                            <div className="meal-planner-assigned-title-row">
                              <Link to={`/recipes/${slot.meal.id}`} className="meal-planner-assigned-link">
                                {recipeMap.get(String(slot.meal.id))?.name || slot.meal.name}
                              </Link>
                              {slot.meal.ingredients_added_to_shopping_at != null && (
                                <span className="meal-planner-on-shopping-list" title="Ingredients added to shopping list">
                                  On list
                                </span>
                              )}
                            </div>
                            <div className="meal-planner-servings-row">
                              <span className="meal-planner-servings-label">Servings</span>
                              <button
                                type="button"
                                className="btn btn-secondary meal-planner-servings-btn"
                                onClick={() => handleAdjustServings(day.date, slot.id, (slot.meal.servings || 1) - 1)}
                                disabled={saving || (slot.meal.servings || 1) <= 1}
                                aria-label={`Decrease servings for ${slot.meal.name}`}
                              >
                                -
                              </button>
                              <span className="meal-planner-servings-value">{slot.meal.servings || 1}</span>
                              <button
                                type="button"
                                className="btn btn-secondary meal-planner-servings-btn"
                                onClick={() => handleAdjustServings(day.date, slot.id, (slot.meal.servings || 1) + 1)}
                                disabled={saving}
                                aria-label={`Increase servings for ${slot.meal.name}`}
                              >
                                +
                              </button>
                            </div>
                            <div className={`meal-planner-kcal-row ${
                              getSlotKcalStatus(slot) ? `meal-planner-kcal-${getSlotKcalStatus(slot)}` : ''
                            }`}
                            >
                              <span className="meal-planner-kcal-label">kcal/serving</span>
                              <span className="meal-planner-kcal-value">{slot.meal.kcal_per_serving ?? '—'}</span>
                            </div>
                            {slot.meal.leftover_source && (
                              <div className="meal-planner-leftover-badge">
                                Leftover from {dayHeaderLabel(slot.meal.leftover_source.meal_date)} {slot.meal.leftover_source.meal_slot_name || 'meal'}
                              </div>
                            )}
                            <div className="meal-planner-actions-row">
                              <button
                                type="button"
                                className="btn btn-secondary meal-planner-icon-btn"
                                onClick={() => handleClearSlot(day.date, slot.id)}
                                disabled={saving}
                                aria-label={`Clear ${slot.meal.name}`}
                                title="Clear meal"
                              >
                                <span aria-hidden="true">🗑</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary meal-planner-icon-btn"
                                onClick={() => handleAutoLinkLeftovers(day.date, slot.id)}
                                disabled={saving || !slot.meal}
                                aria-label={`Auto-link leftovers for ${slot.meal.name}`}
                                title="Auto-link leftovers"
                              >
                                <span aria-hidden="true">🔗</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="meal-planner-drop-hint">Drop recipe here</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <aside className="meal-planner-recipes">
            <h2>Recipes</h2>
            <div className="meal-planner-recipe-filters">
              <label htmlFor="meal-planner-category-filter" className="filter-label">Category</label>
              <select
                id="meal-planner-category-filter"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="filter-select"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              className="recipes-filter-input"
              placeholder="Filter recipes..."
              value={recipeFilter}
              onChange={(e) => setRecipeFilter(e.target.value)}
            />
            <ul className="meal-planner-recipe-list">
              {filteredRecipes.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    type="button"
                    className="meal-planner-recipe-chip"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData(
                        'application/x-kitchenhub-meal',
                        JSON.stringify({ recipeId: recipe.id })
                      );
                    }}
                  >
                    {recipe.name}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}

export default UpcomingMealsPage;
