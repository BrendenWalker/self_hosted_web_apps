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

const CEIL_EPS = 1e-9;

/**
 * In-store list: show whole shopping units, rounded up (e.g. 2.25 → 3).
 * Without a shopping measure, show grams rounded up.
 */
export function inStoreShoppingCountDisplay(grams, shoppingMeasureGrams) {
  const g = typeof grams === 'string' ? parseFloat(grams) : Number(grams);
  if (!Number.isFinite(g)) return '';
  const m = parseShoppingMeasureGrams(shoppingMeasureGrams);
  if (m == null) return String(Math.ceil(g - CEIL_EPS));
  const units = g / m;
  return String(Math.ceil(units - CEIL_EPS));
}

/**
 * Parse a leading numeric amount from shopping_measure (e.g. "10 ounces" → { amount: 10, rest: "ounces" }).
 */
function parseShoppingMeasureAmount(shoppingMeasure) {
  const s = shoppingMeasure != null ? String(shoppingMeasure).trim() : '';
  const match = s.match(/^([\d.]+)\s*(.*)$/);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  if (Number.isNaN(amount) || amount <= 0) return null;
  return { amount, rest: match[2].trim() };
}

function formatAmountForMeasureLabel(n) {
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  const t = Math.round(n * 1000) / 1000;
  return String(t);
}

/**
 * In-store list: total to buy using shopping measure, rounded up to whole increments.
 * Example: 2.25 units × 10 oz/unit → 30 ounces (ceil(2.25) × 10).
 * Returns '' if no measure or shopping_measure has no leading number.
 */
export function inStoreTotalMeasureLabel(grams, shoppingMeasureGrams, shoppingMeasure) {
  const m = parseShoppingMeasureGrams(shoppingMeasureGrams);
  if (m == null) return '';
  const parsed = parseShoppingMeasureAmount(shoppingMeasure);
  if (parsed == null) return '';
  const g = typeof grams === 'string' ? parseFloat(grams) : Number(grams);
  if (!Number.isFinite(g)) return '';
  const units = g / m;
  const ceilUnits = Math.ceil(units - CEIL_EPS);
  const totalAmount = ceilUnits * parsed.amount;
  const numStr = formatAmountForMeasureLabel(totalAmount);
  if (!numStr) return '';
  return parsed.rest ? `${numStr} ${parsed.rest}` : numStr;
}

/**
 * In-store list: text after the unit count in parentheses — total stored grams (exact string
 * from API when quantity is a string, so PostgreSQL numeric is not rounded).
 */
export function inStoreTotalGramsLabel(quantity) {
  if (quantity == null || quantity === '') return '';
  const s = typeof quantity === 'string' ? quantity.trim() : String(quantity);
  if (s === '') return '';
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${s} g`;
}

/** Display label: `Name (details) - shopping measure` (omit empty parts). */
export function itemDisplayName(item) {
  if (!item || !item.name) return '';
  const d = item.details != null && String(item.details).trim();
  const base = d ? `${item.name} (${d})` : item.name;
  const m = item.shopping_measure != null && String(item.shopping_measure).trim();
  if (m) {
    if (d && m === d) return base;
    return `${base} - ${m}`;
  }
  return base;
}
