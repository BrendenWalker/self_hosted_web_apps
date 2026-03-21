/**
 * SQL expressions for items.department: COALESCE existing exemplar items, then common.department name patterns.
 * Safe when exemplars or department names are missing (returns NULL).
 */

const CHAIN = {
  produce: [
    "Fresh Ginger",
    "Garlic",
    "Yellow Onion",
    "Carrots",
    "Celery",
    "Russet potatoes",
  ],
  dairy: ["Milk", "Butter", "Cheddar cheese", "Eggs", "Heavy cream"],
  meat: ["Chicken breast", "Ground beef", "Pork shoulder", "Bacon"],
  seafood: ["Salmon", "Shrimp", "Tuna"],
  bakery: ["Bread", "All-purpose flour", "Tortillas"],
  pantry: [
    "All-purpose flour",
    "Sugar",
    "Rolled oats",
    "White rice",
    "Pasta",
    "Chicken broth",
  ],
  spices: ["Salt", "Black pepper", "Olive oil", "Paprika"],
  canned: ["Kidney beans", "Diced tomatoes", "Coconut milk"],
  frozen: ["Frozen peas", "Frozen vegetables"],
  beverages: ["Water", "Beer", "Coffee"],
  oils: ["Olive oil", "Vegetable oil", "Soy sauce"],
  misc: ["Salt", "All-purpose flour", "Water"],
};

const DEPT_NAME_FALLBACK = {
  produce: ["Produce", "Produce & Fruit", "Fruit & Vegetables"],
  dairy: ["Dairy", "Dairy & Eggs", "Cheese"],
  meat: ["Meat", "Meat & Seafood", "Deli"],
  seafood: ["Seafood", "Meat & Seafood"],
  bakery: ["Bakery", "Bread"],
  pantry: ["Pantry", "Dry Goods", "Baking"],
  spices: ["Spices", "Seasonings", "Pantry"],
  canned: ["Canned Goods", "Pantry", "Canned"],
  frozen: ["Frozen"],
  beverages: ["Beverages", "Drinks"],
  oils: ["Condiments", "Oils & Vinegars", "Pantry"],
  misc: ["Pantry", "Dry Goods", "General"],
};

function escSql(s) {
  return String(s).replace(/'/g, "''");
}

/**
 * @param {string} category - key from CHAIN
 * @returns {string} SQL fragment (no outer parens)
 */
export function departmentSqlExpr(category) {
  const items = CHAIN[category] || CHAIN.misc;
  const deptNames = DEPT_NAME_FALLBACK[category] || DEPT_NAME_FALLBACK.misc;

  const parts = [];
  for (const n of items) {
    parts.push(
      `(SELECT department FROM public.items WHERE name = '${escSql(n)}' LIMIT 1)`
    );
  }
  for (const d of deptNames) {
    parts.push(
      `(SELECT id FROM common.department WHERE name ILIKE '${escSql(d)}' LIMIT 1)`
    );
  }

  if (parts.length === 0) return 'NULL';
  return `COALESCE(\n    ${parts.join(',\n    ')}\n  )`;
}
