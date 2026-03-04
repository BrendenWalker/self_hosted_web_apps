-- Migration: add retirement dates to household for import logic (current vs retirement/mo)
-- Run this if you have an existing retirementhub database created before these columns existed.

ALTER TABLE household ADD COLUMN IF NOT EXISTS p1_retirement_date DATE;
ALTER TABLE household ADD COLUMN IF NOT EXISTS p2_retirement_date DATE;
