'use strict';

const { runProjection } = require('./projectionRunner');
const { assertProjectionInvariants } = require('./projectionInvariantChecker');
const { createMockPool, baseProjectionQueryHandler } = require('../testFixtures/projectionRunnerMock');

describe('projectionRunner portfolio depletion', () => {
  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2026-06-04T12:00:00Z') });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('depletes financial assets and records shortfall in subsequent years', async () => {
    const handler = baseProjectionQueryHandler({
      household: {
        p1_birth_year: 1960,
        p2_birth_year: 1962,
        p1_retirement_date: '2026-01-01',
        p2_retirement_date: '2030-01-01',
        projection_horizon_years: 12,
      },
      balances: [
        {
          account_id: 1,
          balance: 40000,
          account_type: 'taxable',
          expected_depreciation_pct: null,
          liquidate_in_retirement: false,
          owner_type: 'joint',
          rmd_owner_type: null,
        },
      ],
      expenses: [{ current_monthly: 3000, retirement_monthly: 5000, category_type: 'regular' }],
    });
    const pool = createMockPool(handler);
    const result = await runProjection(pool, { growth_pct: 0, retirement_age_p1: 66 });

    assertProjectionInvariants(result.by_year);

    const depletedRows = result.by_year.filter((row) => row.financial_balance === 0 && row.p1_retired);
    expect(depletedRows.length).toBeGreaterThan(0);

    const firstDepletionYear = depletedRows[0].year;
    const postDepletion = result.by_year.filter(
      (row) => row.year >= firstDepletionYear && row.expenses > row.income_ss_total + row.rmd
    );
    expect(postDepletion.length).toBeGreaterThan(0);

    const withShortfall = postDepletion.filter((row) => row.retirement_funding_shortfall > 0);
    expect(withShortfall.length).toBeGreaterThan(0);

    for (const row of postDepletion) {
      expect(row.financial_balance).toBeGreaterThanOrEqual(0);
      if (row.hard_asset_balance === 0 && row.income_from_savings_draw === 0) {
        expect(row.retirement_funding_shortfall).toBeGreaterThan(0);
      }
    }
  });

  it('keeps financial balance at zero once depleted with ongoing spending gap', async () => {
    const handler = baseProjectionQueryHandler({
      household: {
        p1_birth_year: 1960,
        p2_birth_year: 1962,
        p1_retirement_date: '2026-01-01',
        p2_retirement_date: '2030-01-01',
        projection_horizon_years: 10,
      },
      balances: [
        {
          account_id: 1,
          balance: 20000,
          account_type: 'checking',
          expected_depreciation_pct: null,
          liquidate_in_retirement: false,
          owner_type: 'joint',
          rmd_owner_type: null,
        },
      ],
      expenses: [{ current_monthly: 2000, retirement_monthly: 4000, category_type: 'regular' }],
    });
    const pool = createMockPool(handler);
    const result = await runProjection(pool, { growth_pct: 0, retirement_age_p1: 66 });

    assertProjectionInvariants(result.by_year);

    let depletionSeen = false;
    for (const row of result.by_year) {
      if (row.financial_balance === 0 && row.p1_retired) depletionSeen = true;
      if (depletionSeen) {
        expect(row.financial_balance).toBe(0);
      }
    }
    expect(depletionSeen).toBe(true);
  });
});
