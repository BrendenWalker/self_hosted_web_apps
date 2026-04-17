-- PostgreSQL Schema for Meal Planning Feature
-- Migrated from Firebird DDL
-- Uses mealplanner schema and references recipe.recipe

-- Create mealplanner schema
CREATE SCHEMA IF NOT EXISTS mealplanner;

-- Meal slot table (breakfast, lunch, dinner, etc.)
CREATE TABLE IF NOT EXISTS mealplanner.meal_slot (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    seq INTEGER NOT NULL,  -- Display order/sequence
    servings INTEGER NOT NULL  -- Default servings for this meal slot
);

CREATE INDEX IF NOT EXISTS idx_meal_slot_seq ON mealplanner.meal_slot(seq);
CREATE INDEX IF NOT EXISTS idx_meal_slot_name ON mealplanner.meal_slot(name);

-- Meals table (planned meals for specific dates)
CREATE TABLE IF NOT EXISTS mealplanner.meals (
    id SERIAL PRIMARY KEY,
    meal_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meal_slot_id INTEGER NOT NULL DEFAULT 4,
    recipe_id INTEGER NOT NULL REFERENCES recipe.recipe(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meals_date ON mealplanner.meals(meal_date);
CREATE INDEX IF NOT EXISTS idx_meals_recipe ON mealplanner.meals(recipe_id);
