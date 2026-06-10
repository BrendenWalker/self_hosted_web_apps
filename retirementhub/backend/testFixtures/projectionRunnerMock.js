'use strict';

const { taxQueryHandler } = require('./taxParametersMock');

function createMockPool(handler) {
  const query = jest.fn().mockImplementation((sql, params) => Promise.resolve(handler(sql, params)));
  return {
    query,
    connect: jest.fn().mockResolvedValue({ query, release: jest.fn() }),
  };
}

const BASE_HOUSEHOLD = {
  p1_display_name: 'P1',
  p2_display_name: 'P2',
  p1_birth_year: 1964,
  p2_birth_year: 1966,
  p1_retirement_date: '2030-01-01',
  p2_retirement_date: '2032-01-01',
  p1_ss_at_fra: 2400,
  p2_ss_at_fra: 1800,
  filing_status: 'married_filing_jointly',
  required_monthly_income_retirement: null,
  projection_horizon_years: 15,
  projection_growth_pct: 0,
  projection_expense_growth_pct: 0,
  projection_ssi_growth_pct: 0,
};

const BASE_INCOME = {
  gross_salary: 120000,
  gross_salary_p2: 0,
  expected_raise_pct: 0,
  bonus_quarterly: 0,
  bonus_quarterly_p2: 0,
  four_o_one_k_pct: 0,
  four_o_one_k_match_pct: 0,
  four_o_one_k_pct_p2: 0,
  four_o_one_k_match_pct_p2: 0,
  surplus_to_taxable_p1: false,
  surplus_to_taxable_p2: false,
};

function baseProjectionQueryHandler(overrides = {}) {
  const household = { ...BASE_HOUSEHOLD, ...overrides.household };
  const income = { ...BASE_INCOME, ...overrides.income };
  const balances = overrides.balances ?? [
    {
      account_id: 1,
      balance: 50000,
      account_type: 'taxable',
      expected_depreciation_pct: null,
      liquidate_in_retirement: false,
      owner_type: 'joint',
      rmd_owner_type: null,
    },
  ];
  const expenses = overrides.expenses ?? [
    { current_monthly: 4000, retirement_monthly: 5000, category_type: 'regular' },
  ];
  const scenarioRow = overrides.scenarioRow ?? null;

  return function projectionQueryHandler(sql, params) {
    const s = (sql || '').trim();
    const tax = taxQueryHandler(sql, params);
    if (tax != null) return tax;

    if (s.includes('FROM household ORDER BY id LIMIT 1')) {
      return { rows: [household] };
    }
    if (s.includes('SELECT * FROM income ORDER BY')) {
      return { rows: [income] };
    }
    if (s.includes('DISTINCT ON (ab.account_id)')) {
      return { rows: balances };
    }
    if (s.includes('expense_category ec')) {
      return { rows: expenses };
    }
    if (s.includes('FROM mortgage')) {
      return { rows: [{ monthly_payment: 0 }] };
    }
    if (s.includes('FROM account_tax_profile')) {
      return { rows: [] };
    }
    if (s.includes('FROM scenario s') || s.includes('scenario_assumption')) {
      return { rows: scenarioRow ? [scenarioRow] : [] };
    }
    if (s.includes('roth_conversion_plan')) {
      return { rows: [] };
    }
    return { rows: [] };
  };
}

function scenarioRowForRetirementAge(scenarioId, retirementAgeP1, extra = {}) {
  return {
    id: scenarioId,
    name: `Retire at ${retirementAgeP1}`,
    description: null,
    is_default: false,
    household_id: 1,
    retirement_age_p1: retirementAgeP1,
    retirement_age_p2: null,
    social_security_claim_age_p1: retirementAgeP1,
    social_security_claim_age_p2: null,
    annual_spending_target: null,
    inflation_rate: 0,
    portfolio_return_rate: 0,
    withdrawal_strategy: 'conservative',
    withdrawal_order_custom: null,
    roth_conversion_strategy: 'none',
    notes: null,
    ...extra,
  };
}

module.exports = {
  createMockPool,
  baseProjectionQueryHandler,
  scenarioRowForRetirementAge,
  BASE_HOUSEHOLD,
  BASE_INCOME,
};
