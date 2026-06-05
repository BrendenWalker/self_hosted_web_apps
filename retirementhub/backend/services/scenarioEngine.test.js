jest.mock('./projectionRunner', () => ({
  runProjection: jest.fn(async () => ({
    scenario: { id: 2, name: 'Test' },
    by_year: [
      { year: 2026, net_worth: 1000000, federal_tax_total: 10000, roth_conversion: 5000 },
      { year: 2027, net_worth: 1100000, federal_tax_total: 12000, roth_conversion: 0, rmd: 20000 },
    ],
    projection_meta: {
      planning_scores: { lifetime_total_tax: 22000, peak_rmd: 20000, peak_rmd_year: 2027 },
      p1_retirement_year: 2030,
      withdrawal_strategy: 'tax_aware',
      roth_conversion_strategy: 'fixed',
    },
    year_reaches_target: null,
  })),
}));

const { runProjection } = require('./projectionRunner');
const {
  runScenario,
  summarizeScenarioProjection,
  persistYearlyResults,
  loadCachedYearlyResults,
} = require('./scenarioEngine');

describe('scenarioEngine', () => {
  it('summarizeScenarioProjection aggregates key metrics', () => {
    const summary = summarizeScenarioProjection({
      scenario: { id: 2, name: 'Test' },
      by_year: [
        { year: 2026, net_worth: 1000000, roth_conversion: 5000 },
        { year: 2027, net_worth: 1100000, roth_conversion: 0 },
      ],
      projection_meta: {
        planning_scores: { lifetime_total_tax: 22000, peak_rmd: 20000, peak_rmd_year: 2027 },
        p1_retirement_year: 2030,
        withdrawal_strategy: 'tax_aware',
        roth_conversion_strategy: 'fixed',
      },
      year_reaches_target: 2040,
    });
    expect(summary.scenario_name).toBe('Test');
    expect(summary.lifetime_total_tax).toBe(22000);
    expect(summary.ending_net_worth).toBe(1100000);
    expect(summary.total_roth_conversions).toBe(5000);
  });

  it('runScenario persists yearly rows', async () => {
    const queries = [];
    const client = {
      query: jest.fn(async (sql, params) => {
        queries.push({ sql, params });
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = {
      connect: jest.fn(async () => client),
    };
    await runScenario(pool, 2);
    expect(runProjection).toHaveBeenCalledWith(pool, { scenario_id: 2 });
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(queries.some((q) => q.sql.includes('INSERT INTO scenario_yearly_result'))).toBe(true);
  });

  it('persistYearlyResults replaces existing rows', async () => {
    const client = { query: jest.fn(async () => ({ rows: [] })) };
    await persistYearlyResults(client, 3, [{ year: 2026, net_worth: 1 }]);
    expect(client.query).toHaveBeenCalledWith(
      'DELETE FROM scenario_yearly_result WHERE scenario_id = $1',
      [3]
    );
  });

  it('loadCachedYearlyResults returns rows or null', async () => {
    const pool = {
      query: jest.fn(async () => ({
        rows: [{ year: 2026, result_row: { year: 2026, net_worth: 1 } }],
      })),
    };
    const rows = await loadCachedYearlyResults(pool, 5);
    expect(rows).toEqual([{ year: 2026, net_worth: 1 }]);

    pool.query.mockRejectedValueOnce({ code: '42P01' });
    expect(await loadCachedYearlyResults(pool, 5)).toBeNull();
  });

  it('runScenario skips persist when table missing', async () => {
    const client = {
      query: jest.fn(async (sql) => {
        if (sql === 'DELETE FROM scenario_yearly_result WHERE scenario_id = $1') {
          throw { code: '42P01' };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn(async () => client) };
    await expect(runScenario(pool, 9)).resolves.toBeDefined();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
