-- Remove unused items.changed column (never referenced in app code).
-- Run: psql -U postgres -d <dbname> -f kitchenhub/database/migrations/010-drop-items-changed.sql

BEGIN;

DROP INDEX IF EXISTS idx_items_changed;

ALTER TABLE items DROP COLUMN IF EXISTS changed;

COMMIT;
