'use strict';

const { runProjection } = require('./projectionRunner');
const { assertProjectionInvariants } = require('./projectionInvariantChecker');
const {
  createMockPool,
  baseProjectionQueryHandler,
  scenarioRowForRetirementAge,
} = require('../testFixtures/projectionRunnerMock');

function findFirstDepletionYear(byYear) {
  const row = byYear.find((entry) => entry.financial_balance === 0 && entry.p1_retired);
  return row?.year ?? null;
}

function findLastWageYear(byYear) {
  let last = null;
  for (const row of byYear) {
    if ((row.income_wage_p1 ?? 0) > 0) last = row.year;
  }
  return last;
}

function firstRetirementYear(byYear) {
  return byYear.find((row) => row.p1_retired)?.year ?? null;
}

describe('projectionRunner retirement age comparison (62 vs 63 vs 65)', () => {
  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2026-06-04T12:00:00Z') });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const retirementAges = [62, 63, 65];

  it.each(retirementAges)('passes invariants for retire-at-%i scenario', async (retirementAge) => {
    const handler = baseProjectionQueryHandler({
      household: {
        p1_birth_year: 1964,
        p2_birth_year: 1966,
        p1_retirement_date: '2035-01-01',
        p2_retirement_date: '2035-01-01',
        projection_horizon_years: 25,
      },
      balances: [
        {
          account_id: 1,
          balance: 800000,
          account_type: 'ira_traditional',
          expected_depreciation_pct: null,
          liquidate_in_retirement: false,
          owner_type: 'p1',
          rmd_owner_type: 'p1',
        },
        {
          account_id: 2,
          balance: 200000,
          account_type: 'taxable',
          expected_depreciation_pct: null,
          liquidate_in_retirement: false,
          owner_type: 'joint',
          rmd_owner_type: null,
        },
      ],
      expenses: [{ current_monthly: 5000, retirement_monthly: 6000, category_type: 'regular' }],
      scenarioRow: scenarioRowForRetirementAge(retirementAge, retirementAge),
    });
    const pool = createMockPool(handler);
    const result = await runProjection(pool, {
      growth_pct: 3,
      scenario_id: retirementAge,
      retirement_age_p1: retirementAge,
    });

    assertProjectionInvariants(result.by_year);
    expect(result.by_year.length).toBeGreaterThan(0);
  });

  it('later retirement delays wage stop and depletion', async () => {
    const sharedOverrides = {
      household: {
        p1_birth_year: 1964,
        p2_birth_year: 1966,
        p1_retirement_date: '2035-01-01',
        p2_retirement_date: '2035-01-01',
        projection_horizon_years: 30,
      },
      balances: [
        {
          account_id: 1,
          balance: 350000,
          account_type: 'taxable',
          expected_depreciation_pct: null,
          liquidate_in_retirement: false,
          owner_type: 'joint',
          rmd_owner_type: null,
        },
      ],
      expenses: [{ current_monthly: 4000, retirement_monthly: 5500, category_type: 'regular' }],
    };

    const results = {};
    for (const age of retirementAges) {
      const handler = baseProjectionQueryHandler({
        ...sharedOverrides,
        scenarioRow: scenarioRowForRetirementAge(age, age),
      });
      const pool = createMockPool(handler);
      results[age] = await runProjection(pool, {
        growth_pct: 2,
        scenario_id: age,
        retirement_age_p1: age,
      });
      assertProjectionInvariants(results[age].by_year);
    }

    const p1BirthYear = 1964;
    expect(firstRetirementYear(results[62].by_year)).toBe(p1BirthYear + 62);
    expect(firstRetirementYear(results[63].by_year)).toBe(p1BirthYear + 63);
    expect(firstRetirementYear(results[65].by_year)).toBe(p1BirthYear + 65);

    expect(findLastWageYear(results[63].by_year)).toBe(p1BirthYear + 62);
    expect(findLastWageYear(results[65].by_year)).toBe(p1BirthYear + 64);

    const depletion62 = findFirstDepletionYear(results[62].by_year);
    const depletion63 = findFirstDepletionYear(results[63].by_year);
    const depletion65 = findFirstDepletionYear(results[65].by_year);

    if (depletion62 != null && depletion63 != null) {
      expect(depletion63).toBeGreaterThanOrEqual(depletion62);
    }
    if (depletion63 != null && depletion65 != null) {
      expect(depletion65).toBeGreaterThanOrEqual(depletion63);
    }
    if (depletion65 == null) {
      const ending65 = results[65].by_year[results[65].by_year.length - 1];
      expect(ending65.financial_balance).toBeGreaterThan(0);
    }
  });
});
