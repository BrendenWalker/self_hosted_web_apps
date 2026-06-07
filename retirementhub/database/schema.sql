-- RetirementHub Schema — Stage 1: Budget
-- Supports P1/P2 household, income, expenses, mortgage

-- ==================== HOUSEHOLD ====================
-- Single row: P1 and P2 display names, birth years, tax filing status, retirement dates, SS estimates
CREATE TABLE IF NOT EXISTS household (
    id SERIAL PRIMARY KEY,
    p1_display_name VARCHAR(80) NOT NULL DEFAULT 'P1',
    p2_display_name VARCHAR(80) NOT NULL DEFAULT 'P2',
    p1_birth_year INTEGER NOT NULL CHECK (p1_birth_year >= 1900 AND p1_birth_year <= 2100),
    p2_birth_year INTEGER NOT NULL CHECK (p2_birth_year >= 1900 AND p2_birth_year <= 2100),
    p1_retirement_date DATE,
    p2_retirement_date DATE,
    p1_ss_monthly_estimate DECIMAL(10, 2),
    p2_ss_monthly_estimate DECIMAL(10, 2),
    p1_ss_at_fra DECIMAL(10, 2),
    p2_ss_at_fra DECIMAL(10, 2),
    filing_status VARCHAR(40) NOT NULL DEFAULT 'married_filing_jointly'
        CHECK (filing_status IN ('single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household')),
    required_monthly_income_retirement DECIMAL(12, 2),
    projection_horizon_years INTEGER NOT NULL DEFAULT 30 CHECK (projection_horizon_years >= 5 AND projection_horizon_years <= 50),
    projection_growth_pct DECIMAL(5, 2) NOT NULL DEFAULT 5 CHECK (projection_growth_pct >= 0 AND projection_growth_pct <= 20),
    projection_expense_growth_pct DECIMAL(5, 2) NOT NULL DEFAULT 2.5 CHECK (projection_expense_growth_pct >= 0 AND projection_expense_growth_pct <= 10),
    projection_ssi_growth_pct DECIMAL(5, 2) NOT NULL DEFAULT 2.5 CHECK (projection_ssi_growth_pct >= 0 AND projection_ssi_growth_pct <= 10),
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INCOME (for budget context) ====================
-- Multiple rows by as_of date; use latest for "current". History preserved.
-- 401(k): P1 uses four_o_one_k_pct / four_o_one_k_match_pct; P2 uses _p2 columns.
CREATE TABLE IF NOT EXISTS income (
    id SERIAL PRIMARY KEY,
    as_of DATE NOT NULL DEFAULT CURRENT_DATE,
    gross_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
    gross_salary_p2 DECIMAL(14, 2),
    expected_raise_pct DECIMAL(5, 2),
    bonus_quarterly DECIMAL(14, 2),
    bonus_quarterly_p2 DECIMAL(14, 2),
    four_o_one_k_pct DECIMAL(5, 2),
    four_o_one_k_match_pct DECIMAL(5, 2),
    four_o_one_k_pct_p2 DECIMAL(5, 2),
    four_o_one_k_match_pct_p2 DECIMAL(5, 2),
    ira_traditional_annual_p1 DECIMAL(14, 2),
    ira_roth_annual_p1 DECIMAL(14, 2),
    hsa_annual_p1 DECIMAL(14, 2),
    taxable_savings_annual_p1 DECIMAL(14, 2),
    ira_traditional_annual_p2 DECIMAL(14, 2),
    ira_roth_annual_p2 DECIMAL(14, 2),
    hsa_annual_p2 DECIMAL(14, 2),
    taxable_savings_annual_p2 DECIMAL(14, 2),
    surplus_to_taxable_p1 BOOLEAN NOT NULL DEFAULT TRUE,
    surplus_to_taxable_p2 BOOLEAN NOT NULL DEFAULT TRUE,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_income_as_of ON income(as_of DESC);

-- ==================== EXPENSE CATEGORIES (seed / reference) ====================
CREATE TABLE IF NOT EXISTS expense_category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    category_group VARCHAR(40) NOT NULL
        CHECK (category_group IN ('discretionary', 'fixed', 'insurance', 'utilities', 'tax', 'personal')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    category_type VARCHAR(40) NOT NULL DEFAULT 'regular'
        CHECK (category_type IN ('regular', 'p2_health_until_medicare')),
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expense line: one row per (category, as_of). Latest as_of per category = "current". History preserved.
CREATE TABLE IF NOT EXISTS expense_line (
    id SERIAL PRIMARY KEY,
    expense_category_id INTEGER NOT NULL REFERENCES expense_category(id) ON DELETE CASCADE,
    as_of DATE NOT NULL DEFAULT CURRENT_DATE,
    current_monthly DECIMAL(14, 2) NOT NULL DEFAULT 0,
    retirement_monthly DECIMAL(14, 2),
    actual_annual DECIMAL(14, 2),
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(expense_category_id, as_of)
);

CREATE INDEX IF NOT EXISTS idx_expense_line_category ON expense_line(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_expense_line_as_of ON expense_line(as_of DESC);

-- ==================== ACCOUNTS (user-defined, any number) ====================
-- Types: savings, checking, hsa, ira_traditional, ira_roth, 401k_traditional, 401k_roth, taxable, asset
-- asset: physical/financial assets valued in balances; expected_depreciation_pct = expected annual change (+% depreciates, −% appreciates)
-- Owner: p1, p2, or joint (general). rmd_owner_type: for ira_traditional / 401k_traditional only; whose RMD rules apply (null = use owner_type).
CREATE TABLE IF NOT EXISTS account (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    account_type VARCHAR(40) NOT NULL CHECK (account_type IN (
        'savings', 'checking', 'hsa', 'ira_traditional', 'ira_roth',
        '401k_traditional', '401k_roth', 'taxable', 'asset'
    )),
    owner_type VARCHAR(20) NOT NULL DEFAULT 'joint' CHECK (owner_type IN ('p1', 'p2', 'joint')),
    rmd_owner_type VARCHAR(20)
        CHECK (rmd_owner_type IS NULL OR rmd_owner_type IN ('p1', 'p2', 'joint')),
    expected_depreciation_pct DECIMAL(5, 2),
    liquidate_in_retirement BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_type ON account(account_type);
CREATE INDEX IF NOT EXISTS idx_account_owner ON account(owner_type);

-- ==================== ACCOUNT BALANCE (snapshots by as_of) ====================
-- One row per (account, as_of). Latest as_of per account for projections; history preserved.
CREATE TABLE IF NOT EXISTS account_balance (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    as_of DATE NOT NULL,
    balance DECIMAL(14, 2) NOT NULL DEFAULT 0,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, as_of)
);

CREATE INDEX IF NOT EXISTS idx_account_balance_account ON account_balance(account_id);
CREATE INDEX IF NOT EXISTS idx_account_balance_as_of ON account_balance(account_id, as_of DESC);

-- ==================== SCENARIOS (advanced planning) ====================
CREATE TABLE IF NOT EXISTS scenario (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL DEFAULT 1 REFERENCES household(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    base_household_snapshot JSONB,
    last_computed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scenario_yearly_result (
    scenario_id INTEGER NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    result_row JSONB NOT NULL,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scenario_id, year)
);

CREATE INDEX IF NOT EXISTS idx_scenario_yearly_result_scenario
    ON scenario_yearly_result (scenario_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scenario_one_default_per_household
    ON scenario (household_id) WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS scenario_assumption (
    scenario_id INTEGER PRIMARY KEY REFERENCES scenario(id) ON DELETE CASCADE,
    retirement_age_p1 INTEGER,
    retirement_age_p2 INTEGER,
    social_security_claim_age_p1 INTEGER,
    social_security_claim_age_p2 INTEGER,
    annual_spending_target DECIMAL(14, 2),
    inflation_rate DECIMAL(5, 2),
    portfolio_return_rate DECIMAL(5, 2),
    withdrawal_strategy VARCHAR(40) NOT NULL DEFAULT 'conservative',
    withdrawal_order_custom JSONB,
    roth_conversion_strategy VARCHAR(40) NOT NULL DEFAULT 'none',
    notes TEXT
);

CREATE TABLE IF NOT EXISTS account_tax_profile (
    account_id INTEGER PRIMARY KEY REFERENCES account(id) ON DELETE CASCADE,
    cost_basis DECIMAL(14, 2),
    unrealized_gain_percent DECIMAL(5, 2),
    dividend_yield DECIMAL(5, 4),
    qualified_dividend_percent DECIMAL(5, 2) DEFAULT 100,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roth_conversion_plan (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
    strategy_type VARCHAR(40) NOT NULL DEFAULT 'none',
    annual_fixed_amount DECIMAL(14, 2),
    target_tax_bracket INTEGER,
    max_taxable_income DECIMAL(14, 2),
    max_irmaa_income DECIMAL(14, 2),
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (scenario_id)
);

-- ==================== MORTGAGE ====================
CREATE TABLE IF NOT EXISTS mortgage (
    id SERIAL PRIMARY KEY,
    monthly_payment DECIMAL(14, 2) NOT NULL DEFAULT 0,
    payoff_date DATE,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== SEED EXPENSE CATEGORIES ====================
INSERT INTO expense_category (name, category_group, sort_order) VALUES
    ('Education', 'discretionary', 10),
    ('Hobbies', 'discretionary', 20),
    ('Travel', 'discretionary', 30),
    ('Mad Money', 'discretionary', 40),
    ('Coffee', 'discretionary', 50),
    ('Entertainment', 'discretionary', 60),
    ('Memberships', 'discretionary', 70),
    ('Auto Registration', 'fixed', 100),
    ('Auto Fuel', 'fixed', 110),
    ('Auto Service', 'fixed', 120),
    ('Auto Supplies', 'fixed', 130),
    ('Groceries', 'fixed', 140),
    ('Home Repair', 'fixed', 150),
    ('Supplies', 'fixed', 160),
    ('Clothing', 'fixed', 170),
    ('Medicine/Docs', 'fixed', 180),
    ('Misc', 'fixed', 190),
    ('Auto', 'insurance', 200),
    ('Homeowners', 'insurance', 210),
    ('Medical', 'insurance', 220),
    ('Personal', 'insurance', 230),
    ('Cable', 'utilities', 300),
    ('Cell Phone', 'utilities', 310),
    ('Electricity', 'utilities', 320),
    ('Garbage', 'utilities', 330),
    ('Gas', 'utilities', 340),
    ('Sewer', 'utilities', 350),
    ('Water', 'utilities', 360),
    ('Property Tax', 'tax', 400),
    ('Federal', 'tax', 410),
    ('Medicare', 'tax', 420),
    ('Social Security', 'tax', 430)
ON CONFLICT (name) DO NOTHING;

-- ==================== SEED SINGLETON ROWS ====================
INSERT INTO household (p1_display_name, p2_display_name, p1_birth_year, p2_birth_year, filing_status)
SELECT 'P1', 'P2', 1970, 1975, 'married_filing_jointly'
WHERE NOT EXISTS (SELECT 1 FROM household LIMIT 1);

INSERT INTO income (as_of, gross_salary, expected_raise_pct, four_o_one_k_pct)
SELECT CURRENT_DATE, 0, 3, 0
WHERE NOT EXISTS (SELECT 1 FROM income LIMIT 1);

INSERT INTO mortgage (monthly_payment)
SELECT 0
WHERE NOT EXISTS (SELECT 1 FROM mortgage LIMIT 1);

-- Create one expense_line per category (most recent as_of) for any category that doesn't have a line yet
INSERT INTO expense_line (expense_category_id, as_of, current_monthly, retirement_monthly)
SELECT ec.id, CURRENT_DATE, 0, 0
FROM expense_category ec
WHERE NOT EXISTS (SELECT 1 FROM expense_line el WHERE el.expense_category_id = ec.id);
