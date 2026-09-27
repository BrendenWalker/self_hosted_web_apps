'use strict';

const { runProjection } = require('./projectionRunner');
const { createMockPool, baseProjectionQueryHandler } = require('../testFixtures/projectionRunnerMock');

describe('projectionRunner expense category split', () => {
  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2026-06-04T12:00:00Z') });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('keeps discretionary categories out of living expenses', async () => {
    const handler = baseProjectionQueryHandler({
      household: {
        p1_birth_year: 1964,
        p2_birth_year: 1966,
        p1_retirement_date: '2030-01-01',
        p2_retirement_date: '2032-01-01',
        projection_horizon_years: 8,
        projection_expense_growth_pct: 0,
        required_monthly_income_retirement: null,
      },
      expenses: [
        { current_monthly: 3000, retirement_monthly: 4000, category_type: 'regular', category_group: 'fixed' },
        { current_monthly: 500, retirement_monthly: 800, category_type: 'regular', category_group: 'discretionary' },
      ],
    });
    const pool = createMockPool(handler);
    const result = await runProjection(pool, { growth_pct: 0, expense_growth_pct: 0 });

    expect(result.current_living_annual).toBe(36000);
    expect(result.current_discretionary_annual).toBe(6000);
    expect(result.current_annual).toBe(42000);
    expect(result.retirement_living_annual).toBe(48000);
    expect(result.retirement_discretionary_annual).toBe(9600);
    expect(result.retirement_annual).toBe(57600);

    const working = result.by_year.find((row) => row.year === 2026);
    expect(working.expenses).toBe(42000);
    expect(working.living_expenses).toBe(36000);
    expect(working.discretionary_expenses).toBe(6000);

    const retired = result.by_year.find((row) => row.year === 2030);
    expect(retired.expenses).toBe(57600);
    expect(retired.living_expenses).toBe(48000);
    expect(retired.discretionary_expenses).toBe(9600);
  });
});
