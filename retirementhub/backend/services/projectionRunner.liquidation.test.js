'use strict';

const { runProjection } = require('./projectionRunner');
const { taxQueryHandler } = require('../testFixtures/taxParametersMock');

function createMockPool(handler) {
  const query = jest.fn().mockImplementation((sql, params) => Promise.resolve(handler(sql, params)));
  return {
    query,
    connect: jest.fn().mockResolvedValue({ query, release: jest.fn() }),
  };
}

const HOUSEHOLD = {
  p1_display_name: 'P1',
  p2_display_name: 'P2',
  p1_birth_year: 1960,
  p2_birth_year: 1962,
  p1_retirement_date: '2025-01-01',
  p2_retirement_date: '2030-01-01',
  p1_ss_at_fra: 2200,
  p2_ss_at_fra: 1800,
  filing_status: 'married_filing_jointly',
  required_monthly_income_retirement: 8000,
  projection_horizon_years: 3,
  projection_growth_pct: 0,
  projection_expense_growth_pct: 0,
  projection_ssi_growth_pct: 0,
};

const INCOME = {
  gross_salary: 150000,
  gross_salary_p2: 50000,
  expected_raise_pct: 0,
  bonus_quarterly: 0,
  bonus_quarterly_p2: 0,
  four_o_one_k_pct: 0,
  four_o_one_k_match_pct: 0,
  four_o_one_k_pct_p2: 0,
  four_o_one_k_match_pct_p2: 0,
  surplus_to_taxable_p1: true,
  surplus_to_taxable_p2: true,
};

const BALANCES = [
  {
    account_id: 1,
    balance: 0,
    account_type: 'checking',
    expected_depreciation_pct: null,
    liquidate_in_retirement: false,
    owner_type: 'joint',
    rmd_owner_type: null,
  },
  {
    account_id: 2,
    balance: 100000,
    account_type: 'asset',
    expected_depreciation_pct: 0,
    liquidate_in_retirement: true,
    owner_type: 'joint',
    rmd_owner_type: null,
  },
];

function liquidationQueryHandler(sql, params) {
  const s = (sql || '').trim();
  const tax = taxQueryHandler(sql, params);
  if (tax != null) return tax;

  if (s.includes('FROM household ORDER BY id LIMIT 1')) {
    return { rows: [HOUSEHOLD] };
  }
  if (s.includes('SELECT * FROM income ORDER BY')) {
    return { rows: [INCOME] };
  }
  if (s.includes('DISTINCT ON (ab.account_id)')) {
    return { rows: BALANCES };
  }
  if (s.includes('expense_category ec')) {
    return { rows: [{ current_monthly: 5000, retirement_monthly: 5000, category_type: 'regular' }] };
  }
  if (s.includes('FROM mortgage')) {
    return { rows: [{ monthly_payment: 0 }] };
  }
  if (s.includes('FROM account_tax_profile')) {
    return { rows: [] };
  }
  if (s.includes('FROM scenario') || s.includes('scenario_assumption') || s.includes('roth_conversion_plan')) {
    return { rows: [] };
  }
  return { rows: [] };
}

describe('projectionRunner asset liquidation', () => {
  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2026-06-04T12:00:00Z') });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('liquidates flagged assets during retirement spending when savings are exhausted', async () => {
    const pool = createMockPool(liquidationQueryHandler);
    const result = await runProjection(pool, { growth_pct: 0 });

    const y2026 = result.by_year.find((row) => row.year === 2026);
    expect(y2026).toBeDefined();
    expect(y2026.is_retired).toBe(false);
    expect(y2026.p1_retired).toBe(true);
    expect(y2026.withdrawals.assetLiquidations).toBeGreaterThan(0);
    expect(y2026.spending_sources.asset_liquidation).toBeGreaterThan(0);
    expect(y2026.retirement_funding_shortfall).toBeLessThan(
      y2026.expenses - y2026.income_ss_total - y2026.income_wages
    );
    expect(y2026.hard_asset_balance).toBeLessThan(100000);
  });
});
