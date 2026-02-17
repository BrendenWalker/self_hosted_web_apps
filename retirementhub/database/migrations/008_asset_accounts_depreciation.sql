-- Migration: asset account type and expected annual depreciation for projections
-- Asset balances shrink by expected_depreciation_pct per year; other accounts use portfolio growth.

ALTER TABLE account ADD COLUMN IF NOT EXISTS expected_depreciation_pct DECIMAL(5, 2);

ALTER TABLE account DROP CONSTRAINT IF EXISTS account_account_type_check;

ALTER TABLE account ADD CONSTRAINT account_account_type_check CHECK (account_type IN (
    'savings', 'checking', 'hsa', 'ira_traditional', 'ira_roth',
    '401k_traditional', '401k_roth', 'taxable', 'asset'
));
