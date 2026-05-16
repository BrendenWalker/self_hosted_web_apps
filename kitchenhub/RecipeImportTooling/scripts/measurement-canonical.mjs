/**
 * Map recipe-text unit strings to canonical common.measurements.name values.
 * See RecipeConversion.md §2.
 */

const ALIASES = new Map([
  ['t', 'Teaspoon'],
  ['tsp', 'Teaspoon'],
  ['tsp.', 'Teaspoon'],
  ['teaspoon', 'Teaspoon'],
  ['teaspoons', 'Teaspoon'],
  ['tbsp', 'Tablespoon'],
  ['tbsp.', 'Tablespoon'],
  ['tablespoon', 'Tablespoon'],
  ['tablespoons', 'Tablespoon'],
  ['tbs', 'Tablespoon'],
  ['c', 'Cup'],
  ['cup', 'Cup'],
  ['cups', 'Cup'],
  ['fl oz', 'Fluid Ounce'],
  ['fl. oz.', 'Fluid Ounce'],
  ['fluid ounce', 'Fluid Ounce'],
  ['fluid ounces', 'Fluid Ounce'],
  ['oz', 'Ounce'],
  ['ounce', 'Ounce'],
  ['ounces', 'Ounce'],
  ['lb', 'Pound'],
  ['lb.', 'Pound'],
  ['lbs', 'Pound'],
  ['lbs.', 'Pound'],
  ['#', 'Pound'],
  ['pound', 'Pound'],
  ['pounds', 'Pound'],
  ['g', 'Gram'],
  ['gram', 'Gram'],
  ['grams', 'Gram'],
  ['kg', 'Kilogram'],
  ['kilogram', 'Kilogram'],
  ['kilograms', 'Kilogram'],
  ['ml', 'Milliliter'],
  ['milliliter', 'Milliliter'],
  ['milliliters', 'Milliliter'],
  ['l', 'Liter'],
  ['liter', 'Liter'],
  ['liters', 'Liter'],
  ['litre', 'Liter'],
  ['litres', 'Liter'],
  ['pinch', 'pinch'],
  ['pinches', 'pinch'],
  ['dash', 'dash'],
  ['dashes', 'dash'],
  ['each', 'each'],
  ['whole', 'each'],
  ['item', 'each'],
  ['clove', 'cloves'],
  ['cloves', 'cloves'],
  ['can', 'can'],
  ['cans', 'can'],
  ['jar', 'jar'],
  ['slice', 'slices'],
  ['slices', 'slices'],
  ['package', 'package'],
  ['pkg', 'package'],
  ['packet', 'package'],
  ['rib', 'ribs'],
  ['ribs', 'ribs'],
  ['quart', 'Quart'],
  ['qt', 'Quart'],
  ['sprig', 'sprig'],
  ['sprigs', 'sprig'],
]);

/** Title-case common canonical names when alias misses. */
const TITLE_CASE = new Set([
  'Teaspoon',
  'Tablespoon',
  'Cup',
  'Fluid Ounce',
  'Ounce',
  'Pound',
  'Gram',
  'Kilogram',
  'Milliliter',
  'Liter',
  'Quart',
]);

/**
 * @param {string} raw
 * @returns {string}
 */
export function canonicalizeMeasurement(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return trimmed;
  const key = trimmed.toLowerCase();
  if (ALIASES.has(key)) return ALIASES.get(key);
  if (TITLE_CASE.has(trimmed)) return trimmed;
  for (const canonical of TITLE_CASE) {
    if (canonical.toLowerCase() === key) return canonical;
  }
  return trimmed;
}
