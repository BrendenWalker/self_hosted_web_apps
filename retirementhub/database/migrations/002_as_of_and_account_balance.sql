-- Migration: add as_of to income and expense_line, add account_balance table
-- Run this if you have an existing retirementhub database created before as_of was added.

-- Income: add as_of
ALTER TABLE income ADD COLUMN IF NOT EXISTS as_of DATE DEFAULT CURRENT_DATE;
UPDATE income SET as_of = CURRENT_DATE WHERE as_of IS NULL;
ALTER TABLE income ALTER COLUMN as_of SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_income_as_of ON income(as_of DESC);

-- Expense_line: drop old unique, add as_of, add new unique
ALTER TABLE expense_line DROP CONSTRAINT IF EXISTS expense_line_expense_category_id_key;
ALTER TABLE expense_line ADD COLUMN IF NOT EXISTS as_of DATE DEFAULT CURRENT_DATE;
UPDATE expense_line SET as_of = CURRENT_DATE WHERE as_of IS NULL;
ALTER TABLE expense_line ALTER COLUMN as_of SET NOT NULL;
ALTER TABLE expense_line DROP CONSTRAINT IF EXISTS expense_line_category_as_of_unique;
ALTER TABLE expense_line ADD CONSTRAINT expense_line_category_as_of_unique UNIQUE (expense_category_id, as_of);
CREATE INDEX IF NOT EXISTS idx_expense_line_as_of ON expense_line(as_of DESC);

-- Remove in_retirement (replaced by "0 for Retirement/mo = not in retirement")
ALTER TABLE expense_line DROP COLUMN IF EXISTS in_retirement;

-- Account_balance table (idempotent)
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
