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
 * Sum of line_kcal across ingredients (scaled), or null if nothing to sum.
 * @param {Array<{ line_kcal?: number | null }> | undefined} ingredients
 * @param {number} [scale=1]
 * @returns {string|null} e.g. "842 kcal"
 */
export function formatRecipeTotalKcalDisplay(ingredients, scale = 1) {
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
  if (!any) return null;
  return `${Math.round(sum)} kcal`;
}
