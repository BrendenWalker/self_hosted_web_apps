-- Firebird SQL Queries to Export Data
-- Run these queries in your Firebird database (using isql, flamerobin, or your Delphi app)
-- Then use the results to populate the PostgreSQL seed-data.sql file

-- ============================================
-- 1. EXPORT DEPARTMENTS
-- ============================================
SELECT ID, NAME FROM department ORDER BY ID;

-- Expected output format for seed-data.sql:
-- INSERT INTO department (id, name) VALUES
--   (1, 'Produce'),
--   (2, 'Dairy'),
--   ...
-- ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================
-- 2. EXPORT STORES
-- ============================================
SELECT ID, NAME FROM store ORDER BY ID;

-- Expected output format for seed-data.sql:
-- INSERT INTO store (id, name) VALUES
--   (1, 'Store Name 1'),
--   (2, 'Store Name 2'),
--   ...
-- ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================
-- 3. EXPORT STORE ZONES
-- ============================================
SELECT STOREID, ZONESEQUENCE, ZONENAME, DEPARTMENTID 
FROM storezones 
ORDER BY STOREID, ZONESEQUENCE;

-- Expected output format for seed-data.sql:
-- INSERT INTO storezones (storeid, zonesequence, zonename, departmentid) VALUES
--   (1, 1, 'Produce Section', 1),
--   (1, 2, 'Dairy Section', 2),
--   ...
-- ON CONFLICT (storeid, zonesequence, departmentid) 
-- DO UPDATE SET zonename = EXCLUDED.zonename;

-- ============================================
-- 4. EXPORT ITEMS
-- ============================================
SELECT ID, NAME, SIZE, DEPARTMENT, QTY, CHANGED 
FROM items 
ORDER BY ID;

-- Expected output format for seed-data.sql:
-- INSERT INTO items (id, name, size, department, qty, changed) VALUES
--   (1, 'Milk', NULL, 2, 0, 0),
--   (2, 'Bread', NULL, 4, 0, 0),
--   ...
-- ON CONFLICT (id) DO UPDATE SET 
--   name = EXCLUDED.name, 
--   size = EXCLUDED.size, 
--   department = EXCLUDED.department, 
--   qty = EXCLUDED.qty, 
--   changed = EXCLUDED.changed;

-- ============================================
-- 5. EXPORT SHOPPING LIST
-- ============================================
SELECT NAME, DEPARTMENT_ID, DESCRIPTION, QUANTITY, PURCHASED, ITEM_ID 
FROM shopping_list 
ORDER BY NAME;

-- Expected output format for seed-data.sql:
-- INSERT INTO shopping_list (name, department_id, description, quantity, purchased, item_id) VALUES
--   ('Milk', 2, 'Whole Milk', '1', 0, 1),
--   ('Bread', 4, 'White Bread', '1', 0, 2),
--   ...
-- ON CONFLICT (name) DO UPDATE SET 
--   department_id = EXCLUDED.department_id, 
--   description = EXCLUDED.description, 
--   quantity = EXCLUDED.quantity, 
--   purchased = EXCLUDED.purchased, 
--   item_id = EXCLUDED.item_id;

-- ============================================
-- 6. EXPORT UNIT TYPES (if exists)
-- ============================================
SELECT ID, NAME FROM unit_type ORDER BY ID;

-- Expected output format for seed-data.sql:
-- INSERT INTO unit_type (id, name) VALUES
--   (1, 'Each'),
--   (2, 'Pound'),
--   ...
-- ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
