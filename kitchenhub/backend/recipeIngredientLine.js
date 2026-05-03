/**
 * Grams represented by one unit of measure (aligned with server measurementUnitGrams).
 */
function unitGramsPerMeasure(measurementName, toGrams, ingredientUnitGrams, shoppingMeasureGrams) {
  const unitName = String(measurementName || '').trim().toLowerCase();
  if (unitName === 'each') {
    const g = ingredientUnitGrams != null ? Number(ingredientUnitGrams) : NaN;
    return Number.isFinite(g) && g > 0 ? g : null;
  }
  if (unitName === 'shopping unit') {
    const g = shoppingMeasureGrams != null ? Number(shoppingMeasureGrams) : NaN;
    return Number.isFinite(g) && g > 0 ? g : null;
  }
  const g = toGrams != null ? Number(toGrams) : NaN;
  return Number.isFinite(g) && g > 0 ? g : null;
}

/**
 * Resolve grams for a single recipe ingredient line (same rules as shopping-list POST).
 * Does not require measurement_id; uses joined measurement name / to_grams like meal planner.
 */
function recipeLineGrams(row) {
  const qty = row.qty != null ? Number(row.qty) : 0;
  if (qty <= 0) return null;
  const toGramsRaw = row.measurement_to_grams ?? row.to_grams;
  const perUnit = unitGramsPerMeasure(
    row.measurement_name,
    toGramsRaw,
    row.ingredient_unit_grams,
    row.shopping_measure_grams
  );
  if (perUnit == null) return null;
  return qty * perUnit;
}

/**
 * Grams that correspond to the catalog kcal reference (kcal_qty × kcal measurement).
 */
function kcalReferenceGrams(row) {
  if (row.kcal == null) return null;
  const q = row.kcal_qty != null ? Number(row.kcal_qty) : NaN;
  if (Number.isNaN(q) || q <= 0) return null;
  const perUnit = unitGramsPerMeasure(
    row.kcal_measurement_name,
    row.kcal_measurement_to_grams,
    row.ingredient_unit_grams,
    row.shopping_measure_grams
  );
  if (perUnit == null) return null;
  return q * perUnit;
}

/**
 * kcal for the recipe line's measured amount: same unit as catalog → linear scale by qty;
 * otherwise scale via grams (recipe amount vs nutrition reference amount).
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
