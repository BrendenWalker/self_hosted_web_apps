-- Add schedulable flags for meal-planner filtering.
-- Run once: psql -U <user> -d <db> -f kitchenhub/database/migrations/017-recipe-schedulable-flags.sql

ALTER TABLE recipe.recipe_category
  ADD COLUMN IF NOT EXISTS schedulable BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE recipe.recipe
  ADD COLUMN IF NOT EXISTS schedulable BOOLEAN NOT NULL DEFAULT true;
