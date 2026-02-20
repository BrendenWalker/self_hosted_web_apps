-- One-time migration: replace recipe.recipe_ingredients.option (SMALLINT, 1=optional)
-- with native is_optional BOOLEAN for clearer schema and API.
-- Run once: psql -U <user> -d hausfrau -f kitchenhub/database/migrations/002-recipe-ingredient-is-optional.sql

-- Add new column (safe if already added by schema.sql on new installs)
ALTER TABLE recipe.recipe_ingredients
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false NOT NULL;

-- Backfill from option: 1 -> true, 0/NULL -> false (only if option column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'recipe' AND table_name = 'recipe_ingredients' AND column_name = 'option'
  ) THEN
    UPDATE recipe.recipe_ingredients SET is_optional = (COALESCE(option, 0) = 1);
    ALTER TABLE recipe.recipe_ingredients DROP COLUMN option;
  END IF;
END $$;
