-- Migration script to remove size column from items table
-- Run this if you already have the schema with size field

-- Remove size column from items table
ALTER TABLE items 
DROP COLUMN IF EXISTS size;
