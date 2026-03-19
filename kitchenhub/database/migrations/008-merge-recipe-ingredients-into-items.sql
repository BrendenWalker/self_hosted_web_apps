-- Merge recipe ingredients into public.items (first pass)
-- Run once after deploying backend changes that use common.ingredient_measurements and items for ingredient data.
-- Run: psql -U postgres -d <dbname> -f kitchenhub/database/migrations/008-merge-recipe-ingredients-into-items.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS common;
CREATE SCHEMA IF NOT EXISTS deprecated;

-- 1) Copy recipe.ingredient_measurement into common.ingredient_measurements
CREATE TABLE IF NOT EXISTS common.ingredient_measurements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    to_grams NUMERIC(10, 2)
);

INSERT INTO common.ingredient_measurements (name, to_grams)
SELECT rim.name, rim.to_grams
FROM recipe.ingredient_measurement rim
ON CONFLICT (name) DO UPDATE
SET to_grams = COALESCE(EXCLUDED.to_grams, common.ingredient_measurements.to_grams);

CREATE TEMP TABLE tmp_measurement_id_map (
    old_measurement_id INTEGER PRIMARY KEY,
    new_measurement_id INTEGER NOT NULL
);

INSERT INTO tmp_measurement_id_map (old_measurement_id, new_measurement_id)
SELECT rim.id, cim.id
FROM recipe.ingredient_measurement rim
JOIN common.ingredient_measurements cim
  ON cim.name = rim.name;

-- 2) Add missing ingredient fields to items and remap measurement references
ALTER TABLE items ADD COLUMN IF NOT EXISTS details VARCHAR(255);
ALTER TABLE items ADD COLUMN IF NOT EXISTS kcal INTEGER;
ALTER TABLE items ADD COLUMN IF NOT EXISTS measurement_id INTEGER;
ALTER TABLE items ADD COLUMN IF NOT EXISTS shopping_measure VARCHAR(255);
ALTER TABLE items ADD COLUMN IF NOT EXISTS shopping_measure_grams NUMERIC(10, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_measurement_id_fkey'
      AND conrelid = 'items'::regclass
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_measurement_id_fkey
      FOREIGN KEY (measurement_id)
      REFERENCES common.ingredient_measurements(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_items_measurement_id ON items(measurement_id);

-- 3) Migrate recipe.ingredients into items and track old->new ids
CREATE TEMP TABLE tmp_ingredient_id_map (
    old_ingredient_id INTEGER PRIMARY KEY,
    new_item_id INTEGER NOT NULL
);

-- Ingredients are the source of truth for colliding names.
-- Preserve any current shopping qty from conflicting items before deleting them.
CREATE TEMP TABLE tmp_conflicting_item_qty (
    name VARCHAR(80) PRIMARY KEY,
    carried_qty REAL NOT NULL
);

INSERT INTO tmp_conflicting_item_qty (name, carried_qty)
SELECT i.name, COALESCE(i.qty, 0)::REAL
FROM items i
JOIN recipe.ingredients ri
  ON ri.name = i.name;

DELETE FROM items i
USING recipe.ingredients ri
WHERE ri.name = i.name;

-- Existing items are matched by exact case-sensitive name.
INSERT INTO tmp_ingredient_id_map (old_ingredient_id, new_item_id)
SELECT ri.id, i.id
FROM recipe.ingredients ri
JOIN items i
  ON i.name = ri.name;

-- Create missing items from recipe.ingredients.
INSERT INTO items (name, department, qty, details, kcal, measurement_id, shopping_measure, shopping_measure_grams)
SELECT ri.name,
       ri.department_id,
       GREATEST(COALESCE(ri.qty, 0)::REAL, COALESCE(ciq.carried_qty, 0)::REAL),
       ri.details,
       ri.kcal,
       mm.new_measurement_id,
       ri.shopping_measure,
       ri.shopping_measure_grams
FROM recipe.ingredients ri
LEFT JOIN items i
  ON i.name = ri.name
LEFT JOIN tmp_measurement_id_map mm
  ON mm.old_measurement_id = ri.measurement_id
LEFT JOIN tmp_conflicting_item_qty ciq
  ON ciq.name = ri.name
WHERE i.id IS NULL
ON CONFLICT (name) DO NOTHING;

-- Complete map for all ingredients after insert.
INSERT INTO tmp_ingredient_id_map (old_ingredient_id, new_item_id)
SELECT ri.id, i.id
FROM recipe.ingredients ri
JOIN items i
  ON i.name = ri.name
ON CONFLICT (old_ingredient_id) DO NOTHING;

-- Fill newly added item fields without overwriting existing non-null values.
UPDATE items i
SET details = COALESCE(i.details, ri.details),
    kcal = COALESCE(i.kcal, ri.kcal),
    measurement_id = COALESCE(i.measurement_id, mm.new_measurement_id),
    shopping_measure = COALESCE(i.shopping_measure, ri.shopping_measure),
    shopping_measure_grams = COALESCE(i.shopping_measure_grams, ri.shopping_measure_grams),
    department = COALESCE(i.department, ri.department_id)
FROM recipe.ingredients ri
JOIN tmp_ingredient_id_map im
  ON im.old_ingredient_id = ri.id
LEFT JOIN tmp_measurement_id_map mm
  ON mm.old_measurement_id = ri.measurement_id
WHERE i.id = im.new_item_id;

CREATE TABLE IF NOT EXISTS deprecated.recipe_ingredient_item_id_map (
    old_ingredient_id INTEGER PRIMARY KEY,
    new_item_id INTEGER NOT NULL,
    migrated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO deprecated.recipe_ingredient_item_id_map (old_ingredient_id, new_item_id)
SELECT old_ingredient_id, new_item_id
FROM tmp_ingredient_id_map
ON CONFLICT (old_ingredient_id) DO UPDATE
SET new_item_id = EXCLUDED.new_item_id,
    migrated_at = CURRENT_TIMESTAMP;

-- 4) Update recipe.recipe_ingredients references from old ingredient ids to new item ids.
-- Rebuild rows to avoid PK collisions when multiple old ingredients map to one item.
CREATE TEMP TABLE tmp_recipe_ingredients_merged AS
SELECT
    rri.recipe_id,
    iim.new_item_id AS ingredient_id,
    CASE
      WHEN COUNT(rri.qty) = 0 THEN NULL
      ELSE SUM(rri.qty)
    END AS qty,
    MIN(mm.new_measurement_id) AS measurement_id,
    NULLIF(STRING_AGG(NULLIF(BTRIM(rri.comment), ''), '; ' ORDER BY rri.ingredient_id), '') AS comment,
    BOOL_OR(COALESCE(rri.is_optional, false)) AS is_optional
FROM recipe.recipe_ingredients rri
JOIN tmp_ingredient_id_map iim
  ON iim.old_ingredient_id = rri.ingredient_id
LEFT JOIN tmp_measurement_id_map mm
  ON mm.old_measurement_id = rri.measurement_id
GROUP BY rri.recipe_id, iim.new_item_id;

-- Drop old FKs before inserting remapped ids.
ALTER TABLE recipe.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_ingredient_id_fkey;
ALTER TABLE recipe.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_measurement_id_fkey;
ALTER TABLE recipe.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_recipe_ingredients_ingredient_id_fkey;
ALTER TABLE recipe.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_recipe_ingredients_measurement_id_fkey;

TRUNCATE TABLE recipe.recipe_ingredients;

INSERT INTO recipe.recipe_ingredients (recipe_id, ingredient_id, qty, measurement_id, comment, is_optional)
SELECT recipe_id, ingredient_id, qty, measurement_id, comment, is_optional
FROM tmp_recipe_ingredients_merged;

ALTER TABLE recipe.recipe_ingredients
  ADD CONSTRAINT recipe_ingredients_ingredient_id_fkey
  FOREIGN KEY (ingredient_id) REFERENCES items(id) ON DELETE CASCADE;

ALTER TABLE recipe.recipe_ingredients
  ADD CONSTRAINT recipe_ingredients_measurement_id_fkey
  FOREIGN KEY (measurement_id) REFERENCES common.ingredient_measurements(id) ON DELETE SET NULL;

-- 4b) Legacy compatibility: some older DBs have public.recipe_ingredients referencing public.ingredients.
-- If present, remap ingredient_id to items and update the FK.
DO $$
DECLARE
  has_legacy_table boolean;
  has_ingredient_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recipe_ingredients'
  ) INTO has_legacy_table;

  IF has_legacy_table THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'recipe_ingredients' AND column_name = 'ingredient_id'
    ) INTO has_ingredient_id;

    IF has_ingredient_id THEN
      -- Drop old FK first so legacy ingredient_id values can be remapped to item ids.
      EXECUTE 'ALTER TABLE public.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_ingredient_id_fkey';

      EXECUTE $SQL$
        UPDATE public.recipe_ingredients pri
        SET ingredient_id = m.new_item_id
        FROM deprecated.recipe_ingredient_item_id_map m
        WHERE pri.ingredient_id = m.old_ingredient_id
      $SQL$;

      -- Add FK to items.
      EXECUTE 'ALTER TABLE public.recipe_ingredients ADD CONSTRAINT recipe_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.items(id) ON DELETE CASCADE';
    END IF;
  END IF;
END $$;

-- 5) Move recipe.ingredient_measurement to deprecated schema.
ALTER TABLE recipe.ingredient_measurement SET SCHEMA deprecated;
ALTER TABLE deprecated.ingredient_measurement RENAME TO ingredient_measurements;

-- 6) Move recipe.ingredients to deprecated schema.
ALTER TABLE recipe.ingredients SET SCHEMA deprecated;

COMMIT;
