-- Track when a planned meal's recipe ingredients were merged into the shopping list (items.qty).
-- Run once: psql -U <user> -d <db> -f kitchenhub/database/migrations/019-mealplanner-shopping-list-sync.sql

ALTER TABLE mealplanner.meals
  ADD COLUMN IF NOT EXISTS ingredients_added_to_shopping_at TIMESTAMPTZ;

COMMENT ON COLUMN mealplanner.meals.ingredients_added_to_shopping_at IS
  'When set, add-all-meal-planner-shopping has already applied this meal row; clear on servings change to pick up new amounts.';
