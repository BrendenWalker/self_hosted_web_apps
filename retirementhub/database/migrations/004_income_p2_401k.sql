-- Migration: per-party 401(k) (P2). P1 uses existing four_o_one_k_pct and four_o_one_k_match_pct.
-- Run after schema if you have an existing retirementhub database.

ALTER TABLE income ADD COLUMN IF NOT EXISTS four_o_one_k_pct_p2 DECIMAL(5, 2);
ALTER TABLE income ADD COLUMN IF NOT EXISTS four_o_one_k_match_pct_p2 DECIMAL(5, 2);
