-- Add common.department.ingredient; require items.department; backfill flags.
-- Run: psql -U postgres -d <dbname> -f kitchenhub/database/migrations/011-department-ingredient-items-dept-not-null.sql
rollback;
BEGIN;

ALTER TABLE common.department
  ADD COLUMN IF NOT EXISTS ingredient BOOLEAN NOT NULL DEFAULT false;

-- Departments that already have catalog items are treated as recipe-ingredient aisles.
UPDATE common.department d
SET ingredient = true
WHERE EXISTS (SELECT 1 FROM items i WHERE i.department = d.id);

-- Safety: assign any stray NULL departments before NOT NULL (expect none).
UPDATE items
SET department = (SELECT id FROM common.department ORDER BY id LIMIT 1)
WHERE department IS NULL;

-- Ensure explicit FK from public.items.department to common.department(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = ANY (c.conkey)
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace refn ON refn.oid = ref.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'items'
      AND c.contype = 'f'
      AND a.attname = 'department'
      AND refn.nspname = 'common'
      AND ref.relname = 'department'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_department_fkey
      FOREIGN KEY (department) REFERENCES common.department(id);
  END IF;
END $$;

ALTER TABLE items
  ALTER COLUMN department SET NOT NULL;

COMMIT;
