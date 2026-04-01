-- Required monthly income in retirement (projections: fund SS → RMD → wages/bonus → savings)
ALTER TABLE household ADD COLUMN IF NOT EXISTS required_monthly_income_retirement DECIMAL(12, 2);
