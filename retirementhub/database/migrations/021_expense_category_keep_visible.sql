-- User-created expense categories stay on the Expenses page even when every amount is still zero.
-- Seeded categories stay hidden until they have a positive amount.

ALTER TABLE expense_category ADD COLUMN IF NOT EXISTS keep_visible BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_category_name_lower ON expense_category (LOWER(name));
