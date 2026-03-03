-- RetirementHub Schema — Stage 1: Budget
-- Supports P1/P2 household, income, expenses, mortgage

-- ==================== HOUSEHOLD ====================
-- Single row: P1 and P2 display names, birth years, tax filing status
CREATE TABLE IF NOT EXISTS household (
    id SERIAL PRIMARY KEY,
    p1_display_name VARCHAR(80) NOT NULL DEFAULT 'P1',
    p2_display_name VARCHAR(80) NOT NULL DEFAULT 'P2',
    p1_birth_year INTEGER NOT NULL CHECK (p1_birth_year >= 1900 AND p1_birth_year <= 2100),
    p2_birth_year INTEGER NOT NULL CHECK (p2_birth_year >= 1900 AND p2_birth_year <= 2100),
    filing_status VARCHAR(40) NOT NULL DEFAULT 'married_filing_jointly'
        CHECK (filing_status IN ('single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household')),
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INCOME (for budget context) ====================
-- Multiple rows by as_of date; use latest for "current". History preserved.
CREATE TABLE IF NOT EXISTS income (
    id SERIAL PRIMARY KEY,
    as_of DATE NOT NULL DEFAULT CURRENT_DATE,
    gross_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
    gross_salary_p2 DECIMAL(14, 2),
    expected_raise_pct DECIMAL(5, 2),
    bonus_quarterly DECIMAL(14, 2),
    four_o_one_k_pct DECIMAL(5, 2),
    four_o_one_k_match_pct DECIMAL(5, 2),
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
-- Types: savings, checking, hsa, ira_traditional, ira_roth, 401k_traditional, 401k_roth, taxable
-- Owner: p1, p2, or joint
CREATE TABLE IF NOT EXISTS account (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    account_type VARCHAR(40) NOT NULL CHECK (account_type IN (
        'savings', 'checking', 'hsa', 'ira_traditional', 'ira_roth',
        '401k_traditional', '401k_roth', 'taxable'
    )),
    owner_type VARCHAR(20) NOT NULL DEFAULT 'joint' CHECK (owner_type IN ('p1', 'p2', 'joint')),
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
