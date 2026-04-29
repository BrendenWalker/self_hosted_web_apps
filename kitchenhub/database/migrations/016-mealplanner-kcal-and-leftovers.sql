-- Add kcal targets to meal slots and leftover linking fields to planned meals.

ALTER TABLE IF EXISTS mealplanner.meal_slot
    ADD COLUMN IF NOT EXISTS kcal INTEGER;

-- Older installs may have mealplanner.meals without an id column.
-- Ensure id exists and is safe to reference before adding self-referencing leftovers FK.
DO $$
DECLARE
    has_id BOOLEAN;
    has_id_pk BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'mealplanner'
          AND table_name = 'meals'
          AND column_name = 'id'
    ) INTO has_id;

    IF NOT has_id THEN
        ALTER TABLE mealplanner.meals ADD COLUMN id INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'S'
          AND c.relname = 'meals_id_seq'
          AND n.nspname = 'mealplanner'
    ) THEN
        CREATE SEQUENCE mealplanner.meals_id_seq;
    END IF;

    ALTER SEQUENCE mealplanner.meals_id_seq OWNED BY mealplanner.meals.id;
    ALTER TABLE mealplanner.meals ALTER COLUMN id SET DEFAULT nextval('mealplanner.meals_id_seq');
    UPDATE mealplanner.meals
    SET id = nextval('mealplanner.meals_id_seq')
    WHERE id IS NULL;
    ALTER TABLE mealplanner.meals ALTER COLUMN id SET NOT NULL;

    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'mealplanner'
          AND t.relname = 'meals'
          AND c.contype = 'p'
          AND c.conkey = ARRAY[
              (SELECT attnum
               FROM pg_attribute
               WHERE attrelid = t.oid
                 AND attname = 'id'
                 AND NOT attisdropped)
          ]
    ) INTO has_id_pk;

    IF NOT has_id_pk THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'mealplanner'
              AND t.relname = 'meals'
              AND c.conname = 'mealplanner_meals_id_key'
        ) THEN
            ALTER TABLE mealplanner.meals
                ADD CONSTRAINT mealplanner_meals_id_key UNIQUE (id);
        END IF;
    END IF;
END $$;

ALTER TABLE IF EXISTS mealplanner.meals
    ADD COLUMN IF NOT EXISTS leftover_from_meal_id INTEGER REFERENCES mealplanner.meals(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS mealplanner.meals
    ADD COLUMN IF NOT EXISTS leftover_servings NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_mealplanner_meals_leftover_from
    ON mealplanner.meals(leftover_from_meal_id);
