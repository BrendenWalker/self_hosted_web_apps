/** Recipe editor: "Each" and "Shopping Unit" are special (shopping-list conversion). */

const SPECIAL_NAMES = new Set(['each', 'shopping unit']);

export function isSpecialRecipeMeasurement(m) {
  const n = (m?.name || '').trim().toLowerCase();
  return SPECIAL_NAMES.has(n);
}

/** Special units first, then alphabetical by name. */
export function sortMeasurementsForRecipeEditor(measurements) {
  if (!Array.isArray(measurements)) return [];
  return [...measurements].sort((a, b) => {
    const as = isSpecialRecipeMeasurement(a) ? 0 : 1;
    const bs = isSpecialRecipeMeasurement(b) ? 0 : 1;
    if (as !== bs) return as - bs;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
}

/** Option label: prefix special measurements with "* ". */
export function formatRecipeMeasurementOptionLabel(m) {
  if (!m) return '';
  const raw = m.name != null ? String(m.name) : '';
  return isSpecialRecipeMeasurement(m) ? `* ${raw}` : raw;
}
