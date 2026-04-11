/**
 * When count per pack is 1, one pack item equals one shopping unit, so grams per ingredient
 * unit and grams per shopping measure must match (when either is set).
 */

export function validateCountPerPackOneGrams({
  ingredient_unit_grams,
  count_per_pack,
  shopping_measure_grams,
}) {
  const cppRaw = count_per_pack === '' || count_per_pack == null ? '' : String(count_per_pack).trim();
  if (cppRaw === '') return { ok: true };
  const cpp = parseInt(cppRaw, 10);
  if (Number.isNaN(cpp) || cpp !== 1) return { ok: true };

  const iugStr =
    ingredient_unit_grams === '' || ingredient_unit_grams == null
      ? ''
      : String(ingredient_unit_grams).trim();
  const smgStr =
    shopping_measure_grams === '' || shopping_measure_grams == null
      ? ''
      : String(shopping_measure_grams).trim();

  const iug = iugStr === '' ? null : parseFloat(iugStr);
  const smg = smgStr === '' ? null : parseFloat(smgStr);
  const hasI = iug != null && Number.isFinite(iug);
  const hasS = smg != null && Number.isFinite(smg);

  if (!hasI && !hasS) return { ok: true };
  if (!hasI || !hasS) {
    return {
      ok: false,
      message:
        'When count per pack is 1, set ingredient unit (grams) and grams in shopping measure to the same value.',
    };
  }
  if (Math.abs(iug - smg) > 1e-9) {
    return {
      ok: false,
      message:
        'When count per pack is 1, ingredient unit (grams) and grams in shopping measure must match.',
    };
  }
  return { ok: true };
}
