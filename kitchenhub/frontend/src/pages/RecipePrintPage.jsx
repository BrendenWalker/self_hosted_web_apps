import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getRecipe } from '../api/api';
import { formatRecipeQuantity } from '../utils/recipeQuantity';
import { parseRecipeSteps } from '../utils/recipeSteps';
import { itemDisplayName } from '../utils/shoppingQuantity';
import './RecipePrintPage.css';

const RECIPE_SCALE_OPTIONS = [0.5, 1, 2, 3, 4, 5];

function normalizeScale(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return RECIPE_SCALE_OPTIONS.includes(n) ? n : 1;
}

function RecipePrintPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recipe, setRecipe] = useState(null);
  const [checkedIngredientIds, setCheckedIngredientIds] = useState(() => new Set());
  const [checkedStepIndexes, setCheckedStepIndexes] = useState(() => new Set());

  const scale = normalizeScale(searchParams.get('scale'));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getRecipe(id);
        if (cancelled) return;
        setRecipe(res.data);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.error || err.message || 'Failed to load recipe');
        setRecipe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const prevTitle = document.title;
    if (recipe?.name) {
      document.title = `${recipe.name} (${scale}x) - KitchenHub`;
    } else {
      document.title = 'Recipe Print - KitchenHub';
    }
    return () => {
      document.title = prevTitle;
    };
  }, [recipe?.name, scale]);

  const scaledIngredients = useMemo(() => {
    if (!recipe?.ingredients?.length) return [];
    return recipe.ingredients.map((row) => {
      const name = itemDisplayName({
        name: row.ingredient_name,
        details: row.ingredient_details,
      });
      const qty = row.qty != null ? formatRecipeQuantity(row.qty * scale) : '';
      const measure = row.measurement_name || '';
      const prefix = row.is_optional ? 'Optional: ' : '';
      const main = [qty, measure].filter(Boolean).join(' ');
      let line = `${prefix}${main ? `${main} ` : ''}${name}`;
      if (row.comment) line += ` - ${row.comment}`;
      return { id: row.ingredient_id, line };
    });
  }, [recipe, scale]);

  const steps = useMemo(
    () => (recipe?.instructions ? parseRecipeSteps(recipe.instructions) : []),
    [recipe?.instructions]
  );

  const toggleIngredient = (ingredientId) => {
    setCheckedIngredientIds((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  };

  const toggleStep = (stepIndex) => {
    setCheckedStepIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) next.delete(stepIndex);
      else next.add(stepIndex);
      return next;
    });
  };

  const handleScaleChange = (nextScale) => {
    const next = normalizeScale(nextScale);
    setSearchParams({ scale: String(next) }, { replace: true });
  };

  if (loading) {
    return <div className="recipe-print-loading">Loading recipe print view...</div>;
  }

  if (!recipe) {
    return (
      <div className="recipe-print-error">
        <p>{error || 'Recipe not found.'}</p>
        <Link to="/recipes" className="btn btn-secondary">Back to recipes</Link>
      </div>
    );
  }

  return (
    <div className="recipe-print-page page-scroll">
      <header className="recipe-print-toolbar no-print">
        <div className="recipe-print-toolbar-left">
          <Link to={`/recipes/${recipe.id}`} className="btn btn-secondary">Back</Link>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
        <label className="recipe-print-scale-control">
          <span>Scale</span>
          <select value={String(scale)} onChange={(e) => handleScaleChange(e.target.value)}>
            {RECIPE_SCALE_OPTIONS.map((option) => (
              <option key={option} value={String(option)}>
                {option}x
              </option>
            ))}
          </select>
        </label>
      </header>

      <article className="recipe-print-document">
        <h1>{recipe.name}</h1>
        <p className="recipe-print-meta">
          Servings: {formatRecipeQuantity((recipe.servings || 1) * scale)}
          {' | '}
          Categories: {recipe.category_names || 'Uncategorized'}
          {' | '}
          Scale: {scale}x
        </p>

        <section className="recipe-print-section">
          <h2>Ingredients</h2>
          {scaledIngredients.length === 0 ? (
            <p className="recipe-print-empty">No ingredients.</p>
          ) : (
            <ul className="recipe-print-list">
              {scaledIngredients.map((row) => {
                const done = checkedIngredientIds.has(row.id);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`recipe-print-row${done ? ' recipe-print-row-done' : ''}`}
                      onClick={() => toggleIngredient(row.id)}
                      aria-pressed={done}
                    >
                      <span className="recipe-print-checkbox" aria-hidden="true" />
                      <span>{row.line}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {steps.length > 0 && (
          <section className="recipe-print-section">
            <h2>Steps</h2>
            <ol className="recipe-print-list recipe-print-steps">
              {steps.map((text, index) => {
                const done = checkedStepIndexes.has(index);
                return (
                  <li key={index}>
                    <button
                      type="button"
                      className={`recipe-print-row${done ? ' recipe-print-row-done' : ''}`}
                      onClick={() => toggleStep(index)}
                      aria-pressed={done}
                    >
                      <span className="recipe-print-checkbox" aria-hidden="true" />
                      <span>{text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </article>
    </div>
  );
}

export default RecipePrintPage;
