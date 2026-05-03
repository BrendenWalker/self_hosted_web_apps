/**
 * Resolve grams for a single recipe ingredient line (same rules as shopping-list POST).
 * @param {object} row
 * @param {string|number|null} row.qty
 * @param {number|null} row.measurement_id
 * @param {string|null} row.measurement_name
 * @param {string|number|null} [row.measurement_to_grams] from recipe GET join
 * @param {string|number|null} [row.to_grams] from shopping-list query alias
 * @param {string|number|null} [row.ingredient_unit_grams]
 * @param {string|number|null} [row.shopping_measure_grams]
 * @returns {number|null}
 */
function recipeLineGrams(row) {
  const qty = row.qty != null ? Number(row.qty) : 0;
  if (qty <= 0 || row.measurement_id == null) return null;
  const unitName = (row.measurement_name || '').trim().toLowerCase();
  if (unitName === 'each') {
    const g = row.ingredient_unit_grams != null ? Number(row.ingredient_unit_grams) : NaN;
    if (Number.isNaN(g) || g <= 0) return null;
    return qty * g;
  }
  if (unitName === 'shopping unit') {
    const g = row.shopping_measure_grams != null ? Number(row.shopping_measure_grams) : NaN;
    if (Number.isNaN(g) || g <= 0) return null;
    return qty * g;
  }
  const toGramsRaw = row.measurement_to_grams ?? row.to_grams;
  const toGrams = toGramsRaw != null ? Number(toGramsRaw) : NaN;
  if (Number.isNaN(toGrams) || toGrams <= 0) return null;
  return qty * toGrams;
}

/**
 * Grams that correspond to the catalog kcal reference (kcal_qty × kcal measurement).
 * @param {object} row needs kcal, kcal_qty, kcal_measurement_name, kcal_measurement_to_grams, ingredient_unit_grams, shopping_measure_grams
 * @returns {number|null}
 */
function kcalReferenceGrams(row) {
  if (row.kcal == null) return null;
  const q = row.kcal_qty != null ? Number(row.kcal_qty) : NaN;
  if (Number.isNaN(q) || q <= 0) return null;
  const unitName = (row.kcal_measurement_name || '').trim().toLowerCase();
  if (unitName === 'each') {
    const g = row.ingredient_unit_grams != null ? Number(row.ingredient_unit_grams) : NaN;
    if (Number.isNaN(g) || g <= 0) return null;
    return q * g;
  }
  if (unitName === 'shopping unit') {
    const g = row.shopping_measure_grams != null ? Number(row.shopping_measure_grams) : NaN;
    if (Number.isNaN(g) || g <= 0) return null;
    return q * g;
  }
  const toGrams =
    row.kcal_measurement_to_grams != null ? Number(row.kcal_measurement_to_grams) : NaN;
  if (Number.isNaN(toGrams) || toGrams <= 0) return null;
  return q * toGrams;
}

/**
 * kcal for the recipe line's measured amount: same unit as catalog → linear scale by qty;
 * otherwise scale via grams (recipe amount vs nutrition reference amount).
 * @param {object} row same fields as GET /api/recipes/:id ingredient row (including joins)
 * @returns {number|null}
 */
function recipeLineKcal(row) {
  if (row.kcal == null) return null;
  const kcalQty = row.kcal_qty != null ? Number(row.kcal_qty) : NaN;
  if (Number.isNaN(kcalQty) || kcalQty <= 0) return null;

  const recipeQty = row.qty != null ? Number(row.qty) : NaN;
  if (Number.isNaN(recipeQty) || recipeQty <= 0) return null;

  const recipeMeasId = row.measurement_id != null ? Number(row.measurement_id) : NaN;
  const kcalMeasId =
    row.kcal_measurement_id != null ? Number(row.kcal_measurement_id) : NaN;
  if (
    !Number.isNaN(recipeMeasId) &&
    !Number.isNaN(kcalMeasId) &&
    recipeMeasId === kcalMeasId
  ) {
    return Math.round(Number(row.kcal) * (recipeQty / kcalQty));
  }

  const ref = kcalReferenceGrams(row);
  const line = recipeLineGrams(row);
  if (ref == null || line == null || ref <= 0) return null;
  return Math.round(Number(row.kcal) * (line / ref));
}

module.exports = { recipeLineGrams, kcalReferenceGrams, recipeLineKcal };
