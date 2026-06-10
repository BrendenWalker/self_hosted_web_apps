'use strict';

/**
 * Sweeps depletion-window years (±2 around first zero balance) with the invariant checker.
 * Substitutes for manual CSV review of user-specific years (e.g. 2058–2062).
 */
const { runProjection } = require('./projectionRunner');
const { checkProjectionInvariants } = require('./projectionInvariantChecker');
const { createMockPool, baseProjectionQueryHandler } = require('../testFixtures/projectionRunnerMock');

function depletionWindowYears(byYear, radius = 2) {
  const firstZero = byYear.find((row) => row.financial_balance === 0 && row.p1_retired);
  if (!firstZero) return [];
  const years = new Set();
  for (const row of byYear) {
    if (Math.abs(row.year - firstZero.year) <= radius) years.add(row.year);
  }
  return [...years].sort((a, b) => a - b);
}

describe('projectionRunner depletion window invariant audit', () => {
  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2026-06-04T12:00:00Z') });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('passes invariants in years surrounding financial depletion', async () => {
    const handler = baseProjectionQueryHandler({
      household: {
        p1_birth_year: 1960,
        p2_birth_year: 1962,
        p1_retirement_date: '2026-01-01',
        p2_retirement_date: '2030-01-01',
        projection_horizon_years: 20,
      },
      balances: [
        {
          account_id: 1,
          balance: 35000,
          account_type: 'taxable',
          expected_depreciation_pct: null,
          liquidate_in_retirement: false,
          owner_type: 'joint',
          rmd_owner_type: null,
        },
      ],
      expenses: [{ current_monthly: 2500, retirement_monthly: 4500, category_type: 'regular' }],
    });
    const pool = createMockPool(handler);
    const result = await runProjection(pool, { growth_pct: 0, retirement_age_p1: 66 });

    const windowYears = depletionWindowYears(result.by_year);
    expect(windowYears.length).toBeGreaterThan(0);

    const windowRows = result.by_year.filter((row) => windowYears.includes(row.year));
    const violations = checkProjectionInvariants(windowRows);
    expect(violations).toEqual([]);
  });
});
