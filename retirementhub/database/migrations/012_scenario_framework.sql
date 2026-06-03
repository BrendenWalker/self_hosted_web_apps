-- Scenario framework for advanced retirement planning

CREATE TABLE IF NOT EXISTS scenario (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL DEFAULT 1 REFERENCES household(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scenario_one_default_per_household
    ON scenario (household_id) WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS scenario_assumption (
    scenario_id INTEGER PRIMARY KEY REFERENCES scenario(id) ON DELETE CASCADE,
    retirement_age_p1 INTEGER CHECK (retirement_age_p1 IS NULL OR (retirement_age_p1 >= 50 AND retirement_age_p1 <= 90)),
    retirement_age_p2 INTEGER CHECK (retirement_age_p2 IS NULL OR (retirement_age_p2 >= 50 AND retirement_age_p2 <= 90)),
    social_security_claim_age_p1 INTEGER CHECK (social_security_claim_age_p1 IS NULL OR (social_security_claim_age_p1 >= 62 AND social_security_claim_age_p1 <= 70)),
    social_security_claim_age_p2 INTEGER CHECK (social_security_claim_age_p2 IS NULL OR (social_security_claim_age_p2 >= 62 AND social_security_claim_age_p2 <= 70)),
    annual_spending_target DECIMAL(14, 2),
    inflation_rate DECIMAL(5, 2),
    portfolio_return_rate DECIMAL(5, 2),
    withdrawal_strategy VARCHAR(40) NOT NULL DEFAULT 'conservative'
        CHECK (withdrawal_strategy IN ('conservative', 'tax_aware', 'custom')),
    withdrawal_order_custom JSONB,
    roth_conversion_strategy VARCHAR(40) NOT NULL DEFAULT 'none'
        CHECK (roth_conversion_strategy IN ('none', 'fixed', 'fill_bracket', 'fill_income', 'irmaa_aware')),
    notes TEXT
);

-- Seed Baseline scenario from household (idempotent)
INSERT INTO scenario (household_id, name, description, is_default)
SELECT h.id, 'Baseline', 'Default plan from household settings', TRUE
FROM household h
WHERE NOT EXISTS (SELECT 1 FROM scenario s WHERE s.household_id = h.id AND s.is_default = TRUE);

INSERT INTO scenario_assumption (
    scenario_id,
    retirement_age_p1,
    retirement_age_p2,
    social_security_claim_age_p1,
    social_security_claim_age_p2,
    annual_spending_target,
    inflation_rate,
    portfolio_return_rate,
    withdrawal_strategy,
    roth_conversion_strategy
)
SELECT
    s.id,
    CASE WHEN h.p1_retirement_date IS NOT NULL AND h.p1_birth_year IS NOT NULL
        THEN LEAST(90, GREATEST(50, EXTRACT(YEAR FROM h.p1_retirement_date)::INTEGER - h.p1_birth_year))
        ELSE NULL END,
    CASE WHEN h.p2_retirement_date IS NOT NULL AND h.p2_birth_year IS NOT NULL
        THEN LEAST(90, GREATEST(50, EXTRACT(YEAR FROM h.p2_retirement_date)::INTEGER - h.p2_birth_year))
        ELSE NULL END,
    CASE WHEN h.p1_retirement_date IS NOT NULL AND h.p1_birth_year IS NOT NULL
        THEN LEAST(70, GREATEST(62, EXTRACT(YEAR FROM h.p1_retirement_date)::INTEGER - h.p1_birth_year))
        ELSE NULL END,
    CASE WHEN h.p2_retirement_date IS NOT NULL AND h.p2_birth_year IS NOT NULL
        THEN LEAST(70, GREATEST(62, EXTRACT(YEAR FROM h.p2_retirement_date)::INTEGER - h.p2_birth_year))
        ELSE NULL END,
    CASE WHEN h.required_monthly_income_retirement IS NOT NULL AND h.required_monthly_income_retirement > 0
        THEN h.required_monthly_income_retirement * 12 ELSE NULL END,
    COALESCE(h.projection_expense_growth_pct, 2.5),
    COALESCE(h.projection_growth_pct, 5),
    'conservative',
    'none'
FROM scenario s
JOIN household h ON h.id = s.household_id
WHERE s.is_default = TRUE
  AND NOT EXISTS (SELECT 1 FROM scenario_assumption sa WHERE sa.scenario_id = s.id);
