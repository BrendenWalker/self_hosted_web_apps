-- When true, that party's share of surplus income (after planned contributions) is added to taxable savings.
-- When false, that share is treated as discretionary spending not captured in expense categories.
ALTER TABLE income ADD COLUMN IF NOT EXISTS surplus_to_taxable_p1 BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE income ADD COLUMN IF NOT EXISTS surplus_to_taxable_p2 BOOLEAN NOT NULL DEFAULT TRUE;
