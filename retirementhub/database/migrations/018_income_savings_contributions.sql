-- P2 quarterly bonus and planned annual savings contributions (IRA/HSA/taxable) per party.
ALTER TABLE income ADD COLUMN IF NOT EXISTS bonus_quarterly_p2 DECIMAL(14, 2);
ALTER TABLE income ADD COLUMN IF NOT EXISTS ira_traditional_annual_p1 DECIMAL(14, 2);
ALTER TABLE income ADD COLUMN IF NOT EXISTS ira_roth_annual_p1 DECIMAL(14, 2);
ALTER TABLE income ADD COLUMN IF NOT EXISTS hsa_annual_p1 DECIMAL(14, 2);
ALTER TABLE income ADD COLUMN IF NOT EXISTS taxable_savings_annual_p1 DECIMAL(14, 2);
ALTER TABLE income ADD COLUMN IF NOT EXISTS ira_traditional_annual_p2 DECIMAL(14, 2);
ALTER TABLE income ADD COLUMN IF NOT EXISTS ira_roth_annual_p2 DECIMAL(14, 2);
ALTER TABLE income ADD COLUMN IF NOT EXISTS hsa_annual_p2 DECIMAL(14, 2);
ALTER TABLE income ADD COLUMN IF NOT EXISTS taxable_savings_annual_p2 DECIMAL(14, 2);
