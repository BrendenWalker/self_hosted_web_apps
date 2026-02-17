-- Migration: add Social Security monthly estimates to household for projections
-- Run this if you have an existing retirementhub database created before these columns existed.

ALTER TABLE household ADD COLUMN IF NOT EXISTS p1_ss_monthly_estimate DECIMAL(10, 2);
ALTER TABLE household ADD COLUMN IF NOT EXISTS p2_ss_monthly_estimate DECIMAL(10, 2);
