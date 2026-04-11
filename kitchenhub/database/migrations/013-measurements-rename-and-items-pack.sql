-- Idempotent: safe on DBs that already have common.measurements and new items columns.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'common' AND table_name = 'ingredient_measurements'
  ) THEN
    ALTER TABLE common.ingredient_measurements RENAME TO measurements;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'I' AND n.nspname = 'common' AND c.relname = 'idx_common_ingredient_measurements_name'
  ) THEN
    ALTER INDEX common.idx_common_ingredient_measurements_name RENAME TO idx_common_measurements_name;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'items' AND column_name = 'ingredient_unit_grams'
  ) THEN
    ALTER TABLE items RENAME COLUMN shopping_measure_grams TO _smg_legacy;
    ALTER TABLE items ADD COLUMN ingredient_unit_grams NUMERIC(10, 2);
    ALTER TABLE items ADD COLUMN count_per_pack INTEGER;
    ALTER TABLE items ADD COLUMN shopping_measure_grams NUMERIC(10, 2);
    UPDATE items SET shopping_measure_grams = _smg_legacy;
    ALTER TABLE items DROP COLUMN _smg_legacy;
  END IF;
END $$;

INSERT INTO common.measurements (name, to_grams) VALUES
  ('Each', NULL),
  ('Shopping Unit', NULL)
ON CONFLICT (name) DO UPDATE SET to_grams = EXCLUDED.to_grams;

COMMIT;
