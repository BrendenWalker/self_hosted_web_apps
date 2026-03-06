-- Drop recipe.ingredients.modified (no longer used).
-- Run once: psql -U <user> -d <db> -f kitchenhub/database/migrations/006-ingredients-drop-modified.sql

ALTER TABLE recipe.ingredients DROP COLUMN IF EXISTS modified;
