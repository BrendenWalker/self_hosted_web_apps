'use strict';

const { taxQueryHandler } = require('./taxParametersMock');

const HOUSEHOLD_ROW = {
  id: 1,
  p1_display_name: 'P1',
  p2_display_name: 'P2',
  p1_birth_year: 1960,
  p2_birth_year: 1962,
  p1_retirement_date: '2025-01-01',
  p2_retirement_date: '2027-06-01',
  p1_ss_monthly_estimate: 2000,
  p2_ss_monthly_estimate: 1500,
  p1_ss_at_fra: 2200,
  p2_ss_at_fra: 1800,
  filing_status: 'married_filing_jointly',
  required_monthly_income_retirement: 5000,
  projection_horizon_years: 5,
  projection_growth_pct: 5,
  projection_expense_growth_pct: 2.5,
  projection_ssi_growth_pct: 2.5,
  modified: null,
};

const INCOME_ROW = {
  id: 1,
  as_of: '2025-01-01',
  gross_salary: 120000,
  gross_salary_p2: 80000,
  expected_raise_pct: 3,
  bonus_quarterly: 0,
  bonus_quarterly_p2: 0,
  ira_traditional_annual_p1: null,
  ira_roth_annual_p1: null,
  hsa_annual_p1: null,
  taxable_savings_annual_p1: null,
  ira_traditional_annual_p2: null,
  ira_roth_annual_p2: null,
  hsa_annual_p2: null,
  taxable_savings_annual_p2: null,
  four_o_one_k_pct: 10,
  four_o_one_k_match_pct: 4,
  four_o_one_k_pct_p2: 8,
  four_o_one_k_match_pct_p2: 4,
  surplus_to_taxable_p1: true,
  surplus_to_taxable_p2: true,
};

const ACCOUNT_BALANCES = [
  {
    account_id: 1,
    balance: 500000,
    account_type: '401k_traditional',
    expected_depreciation_pct: null,
    owner_type: 'p1',
    rmd_owner_type: 'p1',
  },
  {
    account_id: 2,
    balance: 300000,
    account_type: '401k_traditional',
    expected_depreciation_pct: null,
    owner_type: 'p2',
    rmd_owner_type: 'p2',
  },
  {
    account_id: 3,
    balance: 200000,
    account_type: 'brokerage',
    expected_depreciation_pct: null,
    owner_type: 'joint',
    rmd_owner_type: null,
  },
  {
    account_id: 4,
    balance: 50000,
    account_type: 'checking',
    expected_depreciation_pct: null,
    owner_type: 'joint',
    rmd_owner_type: null,
  },
];

const EXPENSE_LINES = [
  { current_monthly: 3000, retirement_monthly: 4000, category_type: 'regular' },
  { current_monthly: 500, retirement_monthly: 600, category_type: 'regular' },
];

function snapshotQueryHandler(sql, params) {
  const s = (sql || '').trim();
  const tax = taxQueryHandler(sql, params);
  if (tax != null) return tax;

  if (s.includes('SELECT * FROM household ORDER BY id LIMIT 1') || s.includes('FROM household ORDER BY id LIMIT 1')) {
    if (s.includes('p1_display_name, p2_display_name, p1_birth_year')) {
      return { rows: [HOUSEHOLD_ROW] };
    }
    return { rows: [HOUSEHOLD_ROW] };
  }
  if (s.includes('SELECT * FROM income ORDER BY')) {
    return { rows: [INCOME_ROW] };
  }
  if (s.includes('FROM account_balance ab') || s.includes('DISTINCT ON (ab.account_id)')) {
    return { rows: ACCOUNT_BALANCES };
  }
  if (s.includes('FROM expense_line') || s.includes('expense_category ec')) {
    return { rows: EXPENSE_LINES };
  }
  if (s.includes('FROM mortgage')) {
    return { rows: [{ monthly_payment: 2000 }] };
  }
  if (s.includes('FROM account_tax_profile')) {
    return { rows: [] };
  }
  if (s.includes('FROM scenario')) {
    return { rows: [] };
  }
  if (s.includes('scenario_assumption')) {
    return { rows: [] };
  }
  if (s.includes('roth_conversion_plan')) {
    return { rows: [] };
  }

  return { rows: [] };
}

module.exports = { snapshotQueryHandler, HOUSEHOLD_ROW };
