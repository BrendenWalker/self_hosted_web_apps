-- Roth conversion plan per scenario

CREATE TABLE IF NOT EXISTS roth_conversion_plan (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
    strategy_type VARCHAR(40) NOT NULL DEFAULT 'none'
        CHECK (strategy_type IN ('none', 'fixed', 'fill_bracket', 'fill_income', 'irmaa_aware')),
    annual_fixed_amount DECIMAL(14, 2),
    target_tax_bracket INTEGER CHECK (target_tax_bracket IS NULL OR target_tax_bracket IN (10, 12, 22, 24, 32, 35, 37)),
    max_taxable_income DECIMAL(14, 2),
    max_irmaa_income DECIMAL(14, 2),
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (scenario_id)
);

INSERT INTO roth_conversion_plan (scenario_id, strategy_type)
SELECT s.id, COALESCE(sa.roth_conversion_strategy, 'none')
FROM scenario s
LEFT JOIN scenario_assumption sa ON sa.scenario_id = s.id
WHERE NOT EXISTS (SELECT 1 FROM roth_conversion_plan r WHERE r.scenario_id = s.id);
