-- Projection assumptions (Projections page): horizon, portfolio growth, expense vs SS indexing

ALTER TABLE household ADD COLUMN IF NOT EXISTS projection_horizon_years INTEGER DEFAULT 30;
ALTER TABLE household ADD COLUMN IF NOT EXISTS projection_growth_pct DECIMAL(5, 2) DEFAULT 5;
ALTER TABLE household ADD COLUMN IF NOT EXISTS projection_expense_growth_pct DECIMAL(5, 2) DEFAULT 2.5;
ALTER TABLE household ADD COLUMN IF NOT EXISTS projection_ssi_growth_pct DECIMAL(5, 2) DEFAULT 2.5;

UPDATE household SET projection_horizon_years = 30 WHERE projection_horizon_years IS NULL;
UPDATE household SET projection_growth_pct = 5 WHERE projection_growth_pct IS NULL;
UPDATE household SET projection_expense_growth_pct = 2.5 WHERE projection_expense_growth_pct IS NULL;
UPDATE household SET projection_ssi_growth_pct = 2.5 WHERE projection_ssi_growth_pct IS NULL;

ALTER TABLE household ALTER COLUMN projection_horizon_years SET DEFAULT 30;
ALTER TABLE household ALTER COLUMN projection_growth_pct SET DEFAULT 5;
ALTER TABLE household ALTER COLUMN projection_expense_growth_pct SET DEFAULT 2.5;
ALTER TABLE household ALTER COLUMN projection_ssi_growth_pct SET DEFAULT 2.5;
