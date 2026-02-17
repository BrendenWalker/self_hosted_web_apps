-- Migration: add category_type for P2 health-until-Medicare bridge expense
-- When category_type = 'p2_health_until_medicare', the category is only included in projection
-- expenses for years when P1 is on Medicare but P2 is not yet 65.

ALTER TABLE expense_category ADD COLUMN IF NOT EXISTS category_type VARCHAR(40) NOT NULL DEFAULT 'regular'
  CHECK (category_type IN ('regular', 'p2_health_until_medicare'));

-- Optionally seed a dedicated category. If name exists, set its type so it can be used as the bridge category.
INSERT INTO expense_category (name, category_group, sort_order, category_type)
VALUES ('P2 health until Medicare', 'insurance', 225, 'p2_health_until_medicare')
ON CONFLICT (name) DO UPDATE SET category_type = EXCLUDED.category_type;
