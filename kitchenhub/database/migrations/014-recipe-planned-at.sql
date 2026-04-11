-- Planned / upcoming meals: timestamp when recipe was queued (e.g. via shopping list).
-- Run: psql -U postgres -d <dbname> -f kitchenhub/database/migrations/014-recipe-planned-at.sql

ALTER TABLE recipe.recipe ADD COLUMN IF NOT EXISTS planned_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_recipe_planned_at ON recipe.recipe (planned_at)
  WHERE planned_at IS NOT NULL;
