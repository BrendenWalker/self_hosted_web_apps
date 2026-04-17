-- Replace recipe.planned_at with mealplanner.meals queue tracking.
-- Stores upcoming meal timestamps in mealplanner.meals.meal_date with recipe_id.

CREATE SCHEMA IF NOT EXISTS mealplanner;

CREATE TABLE IF NOT EXISTS mealplanner.meals (
    id SERIAL PRIMARY KEY,
    meal_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meal_slot_id INTEGER NOT NULL DEFAULT 4,
    recipe_id INTEGER NOT NULL REFERENCES recipe.recipe(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mealplanner_meals_meal_date ON mealplanner.meals(meal_date);
CREATE INDEX IF NOT EXISTS idx_mealplanner_meals_recipe_id ON mealplanner.meals(recipe_id);

-- Existing installations may still use the older meal planner table shape.
-- Ensure meal_slot_id exists and default queue entries to Dinner (slot 4).
ALTER TABLE IF EXISTS mealplanner.meals
    ADD COLUMN IF NOT EXISTS meal_slot_id INTEGER;

UPDATE mealplanner.meals
SET meal_slot_id = 4
WHERE meal_slot_id IS NULL;

ALTER TABLE IF EXISTS mealplanner.meals
    ALTER COLUMN meal_slot_id SET DEFAULT 4;

ALTER TABLE IF EXISTS mealplanner.meals
    ALTER COLUMN meal_slot_id SET NOT NULL;

ALTER TABLE IF EXISTS mealplanner.meals
    ALTER COLUMN servings DROP NOT NULL;

INSERT INTO mealplanner.meals (meal_date, meal_slot_id, recipe_id)
SELECT planned_at, 4, id
FROM recipe.recipe
WHERE planned_at IS NOT NULL;

DROP INDEX IF EXISTS idx_recipe_planned_at;
ALTER TABLE recipe.recipe DROP COLUMN IF EXISTS planned_at;
