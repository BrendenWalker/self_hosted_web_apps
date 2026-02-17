-- RMD / retirement tax ownership: independent of owner_type for traditional IRA and 401(k) trad accounts.
-- NULL means fall back to owner_type in projections.

ALTER TABLE account ADD COLUMN IF NOT EXISTS rmd_owner_type VARCHAR(20)
  CHECK (rmd_owner_type IS NULL OR rmd_owner_type IN ('p1', 'p2', 'joint'));
