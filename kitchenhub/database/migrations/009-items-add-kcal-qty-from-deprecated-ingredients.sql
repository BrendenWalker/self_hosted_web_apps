-- Add items.kcal_qty and backfill from deprecated.ingredients.qty.
-- Run after migration 008 has moved recipe.ingredients to deprecated.ingredients.
-- Run: psql -U postgres -d <dbname> -f kitchenhub/database/migrations/009-items-add-kcal-qty-from-deprecated-ingredients.sql

BEGIN;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS kcal_qty NUMERIC(10, 2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'deprecated'
      AND table_name = 'ingredients'
  ) THEN
    UPDATE items i
    SET kcal_qty = di.qty
    FROM deprecated.ingredients di
    WHERE i.name = di.name
      AND i.kcal IS NOT NULL;
  END IF;
END $$;

COMMIT;
