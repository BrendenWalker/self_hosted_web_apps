-- Reset all sequences to max(id) after import or manual ID usage.
-- Run once: psql -U postgres -d hausfrau -f kitchenhub/database/migrations/004-reset-sequences.sql
-- Safe to run multiple times.

-- items (main app)
SELECT setval(
  pg_get_serial_sequence('items', 'id'),
  COALESCE((SELECT MAX(id) FROM items), 0)
);

-- common.department
SELECT setval(
  pg_get_serial_sequence('common.department', 'id'),
  COALESCE((SELECT MAX(id) FROM common.department), 0)
);

-- store
SELECT setval(
  pg_get_serial_sequence('store', 'id'),
  COALESCE((SELECT MAX(id) FROM store), 0)
);

-- recipe.recipe_category
SELECT setval(
  pg_get_serial_sequence('recipe.recipe_category', 'id'),
  COALESCE((SELECT MAX(id) FROM recipe.recipe_category), 0)
);

-- recipe.recipe
SELECT setval(
  pg_get_serial_sequence('recipe.recipe', 'id'),
  COALESCE((SELECT MAX(id) FROM recipe.recipe), 0)
);

-- recipe.ingredient_measurement
SELECT setval(
  pg_get_serial_sequence('recipe.ingredient_measurement', 'id'),
  COALESCE((SELECT MAX(id) FROM recipe.ingredient_measurement), 0)
);

-- recipe.ingredients
SELECT setval(
  pg_get_serial_sequence('recipe.ingredients', 'id'),
  COALESCE((SELECT MAX(id) FROM recipe.ingredients), 0)
);

-- mealplanner.meal_slot (optional: skip if mealplanner schema is not used)
SELECT setval(
  pg_get_serial_sequence('mealplanner.meal_slot', 'id'),
  COALESCE((SELECT MAX(id) FROM mealplanner.meal_slot), 0)
);
