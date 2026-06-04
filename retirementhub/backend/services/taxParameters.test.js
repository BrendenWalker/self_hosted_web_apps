'use strict';

const tp = require('./taxParameters');

function makePool(rowsByQuery) {
  return {
    query: jest.fn((sql, params) => {
      const s = sql || '';
      for (const [pattern, handler] of Object.entries(rowsByQuery)) {
        if (s.includes(pattern)) {
          const rows = typeof handler === 'function' ? handler(sql, params) : handler;
          return Promise.resolve({ rows });
        }
      }
      return Promise.resolve({ rows: [] });
    }),
    connect: jest.fn(),
  };
}

describe('taxParameters service', () => {
  test('getStandardDeduction returns DB value for a published year', async () => {
    const pool = makePool({
      'FROM tax_standard_deduction': [{ amount: '30000', age65_add_on: '1550' }],
    });
    const v = await tp.getStandardDeduction(pool, 2025, 'married_filing_jointly', 60, 60);
    expect(v).toBe(30000);
  });

  test('getStandardDeduction adds age65 add-on for each qualifying spouse (MFJ)', async () => {
    const pool = makePool({
      'FROM tax_standard_deduction': [{ amount: '30000', age65_add_on: '1550' }],
    });
    const v = await tp.getStandardDeduction(pool, 2025, 'married_filing_jointly', 66, 66);
    expect(v).toBe(33100);
  });

  test('getStandardDeduction inflates forward when year not in DB', async () => {
    const pool = makePool({
      "SELECT year FROM tax_year WHERE status='published'": [{ year: 2026 }],
      'FROM tax_standard_deduction': (sql, params) => {
        if (params && params[0] === 2026) return [{ amount: '31000', age65_add_on: '1550' }];
        return [];
      },
      'FROM tax_year WHERE year = $1': [{ inflation_pct: '2.00' }],
    });
    const v = await tp.getStandardDeduction(pool, 2030, 'married_filing_jointly', 60, 60);
    expect(v).toBeCloseTo(33555.39, 1);
  });

  test('getFederalBrackets returns ordered bracket array', async () => {
    const pool = makePool({
      'FROM tax_bracket': [
        { ordinal: 0, lower_bound: '0', rate: '0.1' },
        { ordinal: 1, lower_bound: '23850', rate: '0.12' },
      ],
    });
    const br = await tp.getFederalBrackets(pool, 2025, 'married_filing_jointly');
    expect(br).toHaveLength(2);
    expect(br[0].lower_bound).toBe(0);
    expect(br[1].rate).toBe(0.12);
  });

  test('getContributionLimits returns all four kinds for a year', async () => {
    const pool = makePool({
      'FROM tax_contribution_limit': [
        { kind: 'ira', base_amount: '7000', catch_up_amount: '1000' },
        { kind: '401k_elective', base_amount: '23500', catch_up_amount: '7500' },
        { kind: 'hsa_individual', base_amount: '4300', catch_up_amount: '1000' },
        { kind: 'hsa_family', base_amount: '8550', catch_up_amount: '1000' },
      ],
    });
    const limits = await tp.getContributionLimits(pool, 2025);
    expect(limits.ira.base).toBe(7000);
    expect(limits['401k_elective'].catch_up).toBe(7500);
    expect(limits.hsa_family.base).toBe(8550);
  });

  test('createTaxYear clones rows from source year', async () => {
    const clientQuery = jest.fn((sql, params) => {
      const s = sql || '';
      if (s.includes('INSERT INTO')) return Promise.resolve({ rowCount: 1 });
      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') return Promise.resolve({});
      return Promise.resolve({ rows: [] });
    });
    const pool = {
      query: jest.fn((sql, params) => {
        const s = sql || '';
        if (s.includes('SELECT 1 FROM tax_year WHERE year = $1')) {
          return Promise.resolve({ rows: params[0] === 2027 ? [] : [{ year: params[0] }] });
        }
        if (s.includes('FROM tax_year WHERE year = $1') && params[0] === 2026) {
          return Promise.resolve({
            rows: [{ year: 2026, inflation_pct: '2.00', notes: 'test' }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
      connect: jest.fn().mockResolvedValue({ query: clientQuery, release: jest.fn() }),
    };

    const result = await tp.createTaxYear(pool, { year: 2027, cloneFromYear: 2026 });
    expect(result.year).toBe(2027);
    expect(result.clone_from_year).toBe(2026);
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tax_standard_deduction'),
      [2027, 2026]
    );
  });

  test('getMedicarePartB falls back to last published year + growth when year missing', async () => {
    const pool = makePool({
      "SELECT year FROM tax_year WHERE status='published'": [{ year: 2026 }],
      'FROM tax_medicare_part_b': (sql, params) => {
        if (params && params[0] === 2026) return [{ monthly_premium: '193.00' }];
        return [];
      },
    });
    const v = await tp.getMedicarePartB(pool, 2028);
    expect(v).toBe(212.78);
  });
});
