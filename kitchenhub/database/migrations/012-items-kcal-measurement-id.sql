-- Rename items.measurement_id -> items.kcal_measurement_id (unit for kcal / kcal_qty only).
-- recipe.recipe_ingredients.measurement_id is unchanged (recipe quantity units).

BEGIN;

ALTER TABLE items RENAME COLUMN measurement_id TO kcal_measurement_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_items_measurement_id'
  ) THEN
    EXECUTE 'ALTER INDEX idx_items_measurement_id RENAME TO idx_items_kcal_measurement_id';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_measurement_id_fkey'
  ) THEN
    ALTER TABLE items RENAME CONSTRAINT items_measurement_id_fkey TO items_kcal_measurement_id_fkey;
  END IF;
END $$;

COMMIT;
