-- Migration script to remove unit_type and unit_quantity from items table
-- and drop the unit_type table
-- Run this if you already have the schema with unit fields

-- Remove unit_type and unit_quantity columns from items table
ALTER TABLE items 
DROP COLUMN IF EXISTS unit_type,
DROP COLUMN IF EXISTS unit_quantity;

-- Drop unit_type table if it exists
DROP TABLE IF EXISTS unit_type;
