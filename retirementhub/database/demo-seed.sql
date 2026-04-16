BEGIN;

-- Household singleton
UPDATE household
SET p1_display_name = 'Alex',
    p2_display_name = 'Morgan',
    p1_birth_year = 1968,
    p2_birth_year = 1970,
    p1_retirement_date = '2030-06-01',
    p2_retirement_date = '2032-01-01',
    p1_ss_monthly_estimate = 2800.00,
    p2_ss_monthly_estimate = 2400.00,
    p1_ss_at_fra = 3200.00,
    p2_ss_at_fra = 2750.00,
    filing_status = 'married_filing_jointly',
    required_monthly_income_retirement = 8200.00,
    projection_horizon_years = 35,
    projection_growth_pct = 5.5,
    projection_expense_growth_pct = 2.8,
    projection_ssi_growth_pct = 2.5,
    modified = CURRENT_TIMESTAMP
WHERE id = (SELECT id FROM household ORDER BY id LIMIT 1);

INSERT INTO household (
  p1_display_name, p2_display_name, p1_birth_year, p2_birth_year,
  p1_retirement_date, p2_retirement_date, p1_ss_monthly_estimate, p2_ss_monthly_estimate,
  p1_ss_at_fra, p2_ss_at_fra, filing_status, required_monthly_income_retirement,
  projection_horizon_years, projection_growth_pct, projection_expense_growth_pct, projection_ssi_growth_pct
)
SELECT
  'Alex', 'Morgan', 1968, 1970,
  '2030-06-01', '2032-01-01', 2800.00, 2400.00,
  3200.00, 2750.00, 'married_filing_jointly', 8200.00,
  35, 5.5, 2.8, 2.5
WHERE NOT EXISTS (SELECT 1 FROM household);

-- Income snapshots
INSERT INTO income (
  as_of, gross_salary, gross_salary_p2, expected_raise_pct, bonus_quarterly,
  four_o_one_k_pct, four_o_one_k_match_pct, four_o_one_k_pct_p2, four_o_one_k_match_pct_p2
)
SELECT *
FROM (
  VALUES
    (CURRENT_DATE - INTERVAL '12 months', 98000.00, 72000.00, 3.2, 2500.00, 12.0, 4.0, 10.0, 3.5),
    (CURRENT_DATE - INTERVAL '6 months', 100500.00, 73500.00, 3.1, 2600.00, 12.0, 4.0, 10.0, 3.5),
    (CURRENT_DATE, 103000.00, 75500.00, 3.0, 2800.00, 12.0, 4.0, 10.0, 3.5)
) AS src(as_of, gross_salary, gross_salary_p2, expected_raise_pct, bonus_quarterly, four_o_one_k_pct, four_o_one_k_match_pct, four_o_one_k_pct_p2, four_o_one_k_match_pct_p2)
WHERE NOT EXISTS (
  SELECT 1 FROM income i WHERE i.as_of = src.as_of::date
);

-- Account definitions
INSERT INTO account (name, account_type, owner_type, rmd_owner_type, expected_depreciation_pct, sort_order)
VALUES
  ('Joint Checking', 'checking', 'joint', NULL, NULL, 10),
  ('Emergency Savings', 'savings', 'joint', NULL, NULL, 20),
  ('Alex 401k', '401k_traditional', 'p1', 'p1', NULL, 30),
  ('Morgan 401k', '401k_traditional', 'p2', 'p2', NULL, 40),
  ('Roth IRA', 'ira_roth', 'joint', NULL, NULL, 50),
  ('Taxable Brokerage', 'taxable', 'joint', NULL, NULL, 60),
  ('Home Equity', 'asset', 'joint', NULL, 1.0, 70)
ON CONFLICT DO NOTHING;

-- Account balances
INSERT INTO account_balance (account_id, as_of, balance)
SELECT a.id, b.as_of, b.balance
FROM account a
JOIN (
  VALUES
    ('Joint Checking', CURRENT_DATE - INTERVAL '6 months', 12500.00),
    ('Joint Checking', CURRENT_DATE, 14800.00),
    ('Emergency Savings', CURRENT_DATE - INTERVAL '6 months', 42000.00),
    ('Emergency Savings', CURRENT_DATE, 45500.00),
    ('Alex 401k', CURRENT_DATE - INTERVAL '6 months', 318000.00),
    ('Alex 401k', CURRENT_DATE, 344000.00),
    ('Morgan 401k', CURRENT_DATE - INTERVAL '6 months', 242000.00),
    ('Morgan 401k', CURRENT_DATE, 261500.00),
    ('Roth IRA', CURRENT_DATE - INTERVAL '6 months', 98000.00),
    ('Roth IRA', CURRENT_DATE, 106750.00),
    ('Taxable Brokerage', CURRENT_DATE - INTERVAL '6 months', 156000.00),
    ('Taxable Brokerage', CURRENT_DATE, 168400.00),
    ('Home Equity', CURRENT_DATE, 285000.00)
) AS b(account_name, as_of, balance) ON a.name = b.account_name
ON CONFLICT (account_id, as_of) DO UPDATE
SET balance = EXCLUDED.balance,
    modified = CURRENT_TIMESTAMP;

-- Mortgage singleton
UPDATE mortgage
SET monthly_payment = 1685.00,
    payoff_date = '2034-08-01',
    modified = CURRENT_TIMESTAMP
WHERE id = (SELECT id FROM mortgage ORDER BY id LIMIT 1);

INSERT INTO mortgage (monthly_payment, payoff_date)
SELECT 1685.00, '2034-08-01'
WHERE NOT EXISTS (SELECT 1 FROM mortgage);

-- Expense lines for current snapshot
WITH expense_targets AS (
  SELECT *
  FROM (
    VALUES
      ('Groceries', 925.00, 850.00),
      ('Travel', 450.00, 600.00),
      ('Auto Fuel', 260.00, 180.00),
      ('Auto Service', 140.00, 120.00),
      ('Home Repair', 300.00, 280.00),
      ('Medical', 420.00, 680.00),
      ('Cell Phone', 120.00, 120.00),
      ('Electricity', 165.00, 175.00),
      ('Water', 75.00, 80.00),
      ('Property Tax', 420.00, 420.00),
      ('Federal', 2650.00, 850.00),
      ('Social Security', 1090.00, 0.00),
      ('Entertainment', 260.00, 310.00),
      ('Memberships', 95.00, 95.00),
      ('Coffee', 55.00, 60.00),
      ('Medicine/Docs', 140.00, 260.00),
      ('Misc', 180.00, 200.00)
  ) AS t(category_name, current_monthly, retirement_monthly)
)
INSERT INTO expense_line (expense_category_id, as_of, current_monthly, retirement_monthly, actual_annual)
SELECT ec.id,
       CURRENT_DATE,
       et.current_monthly,
       et.retirement_monthly,
       ROUND((et.current_monthly * 12)::numeric, 2)
FROM expense_targets et
JOIN expense_category ec ON ec.name = et.category_name
ON CONFLICT (expense_category_id, as_of) DO UPDATE
SET current_monthly = EXCLUDED.current_monthly,
    retirement_monthly = EXCLUDED.retirement_monthly,
    actual_annual = EXCLUDED.actual_annual,
    modified = CURRENT_TIMESTAMP;

COMMIT;
