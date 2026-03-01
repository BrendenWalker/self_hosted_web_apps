-- One-time migration: recipes support multiple categories via junction table.
-- Run once: psql -U <user> -d <db> -f kitchenhub/database/migrations/003-recipe-multiple-categories.sql

-- Junction table: recipe <-> category (many-to-many)
CREATE TABLE IF NOT EXISTS recipe.recipe_category_members (
    recipe_id INTEGER NOT NULL REFERENCES recipe.recipe(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES recipe.recipe_category(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_category_members_recipe ON recipe.recipe_category_members(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_category_members_category ON recipe.recipe_category_members(category_id);

-- Backfill from current category_id (only if column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'recipe' AND table_name = 'recipe' AND column_name = 'category_id'
  ) THEN
    INSERT INTO recipe.recipe_category_members (recipe_id, category_id)
    SELECT id, category_id FROM recipe.recipe WHERE category_id IS NOT NULL
    ON CONFLICT (recipe_id, category_id) DO NOTHING;
    ALTER TABLE recipe.recipe DROP COLUMN category_id;
  END IF;
END $$;
