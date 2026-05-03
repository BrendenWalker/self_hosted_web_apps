/**
 * Human-readable suffix for recipe line nutrition, scaled for print/cooking.
 * Example: (95 kcal, 182g)
 * @param {{ line_grams?: number | null, line_kcal?: number | null }} row from GET /api/recipes/:id
 * @param {number} [scale=1]
 * @returns {string} empty when nothing to show
 */
export function formatRecipeIngredientNutritionSuffix(row, scale = 1) {
  const s = typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1;
  const g = row.line_grams != null ? Number(row.line_grams) * s : null;
  const k = row.line_kcal != null ? Number(row.line_kcal) * s : null;

  const kPart =
    k != null && Number.isFinite(k) && k > 0 ? `${Math.round(k)} kcal` : null;

  let gPart = null;
  if (g != null && Number.isFinite(g) && g > 0) {
    const rounded = Math.round(g * 10) / 10;
    const gStr = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
    gPart = `${gStr}g`;
  }

  if (kPart && gPart) return ` (${kPart}, ${gPart})`;
  if (kPart) return ` (${kPart})`;
  if (gPart) return ` (${gPart})`;
  return '';
}

/**
 * Sum of line_kcal across ingredients (optionally scaled for print).
 * @param {Array<{ line_kcal?: number | null }> | undefined} ingredients
 * @param {number} [scale=1]
 * @returns {number|null}
 */
export function sumRecipeLineKcal(ingredients, scale = 1) {
  if (!ingredients?.length) return null;
  const s = typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1;
  let sum = 0;
  let any = false;
  for (const row of ingredients) {
    if (row.line_kcal != null && Number.isFinite(Number(row.line_kcal))) {
      sum += Number(row.line_kcal) * s;
      any = true;
    }
  }
  return any ? sum : null;
}

/** Whole-recipe kcal label from ingredient lines (used where total is needed). */
export function formatRecipeTotalKcalDisplay(ingredients, scale = 1) {
  const sum = sumRecipeLineKcal(ingredients, scale);
  if (sum == null) return null;
  return `${Math.round(sum)} kcal`;
}

/**
 * @param {number|null|undefined} totalKcal whole recipe (unscaled) or scaled total if servings matches
 * @param {number|null|undefined} servingsCount must be ≥ 1 (e.g. recipe.servings or scaled servings)
 * @returns {string|null} e.g. "210 kcal/serving"
 */
export function formatRecipeKcalPerServingDisplay(totalKcal, servingsCount) {
  const t = totalKcal != null ? Number(totalKcal) : NaN;
  const srv =
    servingsCount != null && Number.isFinite(Number(servingsCount))
      ? Math.max(1, Number(servingsCount))
      : NaN;
  if (!Number.isFinite(t) || !Number.isFinite(srv) || srv < 1) return null;
  return `${Math.round(t / srv)} kcal/serving`;
}
