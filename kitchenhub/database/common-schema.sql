-- Common Schema Setup
-- Creates the common schema and department table if they don't exist
-- This is referenced by recipe.ingredients

-- Create common schema
CREATE SCHEMA IF NOT EXISTS common;

-- Create department table in common schema
-- If department already exists in default schema, we'll need to migrate it
CREATE TABLE IF NOT EXISTS common.department (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_common_department_name ON common.department(name);

-- If department table exists in default schema but not in common, copy it
DO $$
BEGIN
    -- Check if department exists in default schema but not in common
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'department')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'common' AND table_name = 'department') THEN
        
        -- Copy data from public.department to common.department
        INSERT INTO common.department (name)
        SELECT name FROM public.department
        ON CONFLICT (name) DO NOTHING;
        
        RAISE NOTICE 'Copied department data from public schema to common schema';
    END IF;
END $$;
