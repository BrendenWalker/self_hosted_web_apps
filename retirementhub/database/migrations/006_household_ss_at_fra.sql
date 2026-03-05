-- Migration: add SS benefit at full retirement age (67) for early/normal/late (62/67/70) estimation
-- Run this if you have an existing retirementhub database created before these columns existed.

ALTER TABLE household ADD COLUMN IF NOT EXISTS p1_ss_at_fra DECIMAL(10, 2);
ALTER TABLE household ADD COLUMN IF NOT EXISTS p2_ss_at_fra DECIMAL(10, 2);
