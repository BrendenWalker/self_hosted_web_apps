/**
 * Shopping list stores items.qty as grams. When shopping_measure_grams is set,
 * UI shows qty / shopping_measure_grams (shopping units). API PUT/POST use shopping units when smg is set.
 */

export function parseShoppingMeasureGrams(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

/** Convert stored grams to display units (or return grams when no conversion). */
export function gramsToDisplayUnits(grams, shoppingMeasureGrams) {
  const g = typeof grams === 'string' ? parseFloat(grams) : Number(grams);
  if (Number.isNaN(g)) return 0;
  const m = parseShoppingMeasureGrams(shoppingMeasureGrams);
  if (m == null) return g;
  return g / m;
}

/** Format a shopping-unit count for display (allows values like 0.2). */
export function formatShoppingUnitsDisplay(units) {
  if (!Number.isFinite(units)) return '';
  const rounded = Math.round(units * 10000) / 10000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return String(rounded);
}

export function itemDisplayName(item) {
  if (!item || !item.name) return '';
  const m = item.shopping_measure != null && String(item.shopping_measure).trim();
  if (m) return `${item.name} — ${m}`;
  return item.name;
}
