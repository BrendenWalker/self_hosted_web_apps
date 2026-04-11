/**
 * Text for POST /api/recipes/:id/shopping-list — matches Recipes list “add to shopping list” UX.
 */

function displayVal(v) {
  if (v === null || v === undefined || v === '') return 'none';
  return String(v);
}

function ingredientLabel(sk) {
  const n = sk.ingredient_name != null && String(sk.ingredient_name).trim();
  if (n) return n;
  if (sk.ingredient_id != null) return `Ingredient #${sk.ingredient_id}`;
  return 'Unknown ingredient';
}

/** One bullet line for a skipped recipe ingredient (reason + values that blocked adding). */
export function formatRecipeShoppingListSkippedLine(sk) {
  const name = ingredientLabel(sk);
  switch (sk.reason) {
    case 'optional':
      return `${name} — optional (not added)`;
    case 'no_qty':
      return `${name} — need a quantity greater than zero (qty: ${displayVal(sk.qty)})`;
    case 'no_measurement':
      return `${name} — no measurement unit on recipe line (measurement_id: ${displayVal(sk.measurement_id)})`;
    case 'no_ingredient_unit_grams':
      return `${name} — “Each” requires grams per item on the item (ingredient_unit_grams: ${displayVal(sk.ingredient_unit_grams)})`;
    case 'no_shopping_measure_grams':
      return `${name} — “Shopping Unit” requires grams per shopping unit on the item (shopping_measure_grams: ${displayVal(sk.shopping_measure_grams)})`;
    case 'no_to_grams':
      return `${name} — measurement “${displayVal(sk.measurement_name)}” has no gram conversion (to_grams: ${displayVal(sk.to_grams)})`;
    case 'item_not_found':
      return `${name} — item row could not be updated`;
    default:
      return `${name} — ${sk.reason || 'unknown reason'}`;
  }
}

/**
 * Full notice body for a recipe add-to-list response.
 * @param {string|null|undefined} recipeName
 * @param {{ added?: unknown[], skipped?: unknown[] }} data
 */
export function buildRecipeShoppingListNoticeText(recipeName, data) {
  const added = data?.added ?? [];
  const skipped = data?.skipped ?? [];
  const title =
    recipeName != null && String(recipeName).trim() ? `“${String(recipeName).trim()}”` : 'Recipe';
  const lines = [];
  if (added.length > 0) {
    lines.push(`${title}: added ${added.length} ingredient line(s) to the shopping list.`);
  } else if (skipped.length > 0) {
    lines.push(`${title}: nothing was added.`);
  } else {
    lines.push(`${title}: no ingredients on this recipe.`);
  }
  if (skipped.length > 0) {
    lines.push('');
    lines.push('Skipped:');
    for (const s of skipped) {
      lines.push(`• ${formatRecipeShoppingListSkippedLine(s)}`);
    }
  }
  return lines.join('\n');
}

/** className for the notice box (green when something was added, amber when nothing was). */
export function recipeShoppingListNoticeClassName(data) {
  const added = data?.added ?? [];
  return added.length === 0
    ? 'recipe-shopping-list-notice recipe-shopping-list-notice--warning'
    : 'recipe-shopping-list-notice';
}
