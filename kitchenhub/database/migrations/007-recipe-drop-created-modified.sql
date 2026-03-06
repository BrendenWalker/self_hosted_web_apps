-- Drop recipe.recipe.created and recipe.recipe.modified.
-- Run once: psql -U <user> -d <db> -f kitchenhub/database/migrations/007-recipe-drop-created-modified.sql

ALTER TABLE recipe.recipe DROP COLUMN IF EXISTS created;
ALTER TABLE recipe.recipe DROP COLUMN IF EXISTS modified;
