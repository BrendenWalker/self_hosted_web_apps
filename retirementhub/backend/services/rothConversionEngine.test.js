jest.mock('./yearTaxService', () => ({
  bracketTopForRate: jest.fn(async (_pool, rate) => {
    if (rate === 12) return 94000;
    if (rate === 22) return 201000;
    return null;
  }),
}));

const { computeRothConversion, applyRothConversion } = require('./rothConversionEngine');

describe('rothConversionEngine', () => {
  const pool = {};

  it('returns 0 for none strategy', async () => {
    const amount = await computeRothConversion(pool, {
      plan: { strategy_type: 'none' },
      year: 2028,
      tradBalance: 500000,
      baseOrdinaryIncome: 40000,
      filingStatus: 'married_filing_jointly',
    });
    expect(amount).toBe(0);
  });

  it('caps fixed conversion at traditional balance', async () => {
    const amount = await computeRothConversion(pool, {
      plan: { strategy_type: 'fixed', annual_fixed_amount: 50000 },
      year: 2028,
      tradBalance: 30000,
      baseOrdinaryIncome: 0,
      filingStatus: 'married_filing_jointly',
    });
    expect(amount).toBe(30000);
  });

  it('fill_bracket uses headroom to bracket top', async () => {
    const amount = await computeRothConversion(pool, {
      plan: { strategy_type: 'fill_bracket', target_tax_bracket: 12 },
      year: 2028,
      tradBalance: 100000,
      baseOrdinaryIncome: 40000,
      filingStatus: 'married_filing_jointly',
    });
    expect(amount).toBe(54000);
  });

  it('fill_income respects max taxable income', async () => {
    const amount = await computeRothConversion(pool, {
      plan: { strategy_type: 'fill_income', max_taxable_income: 120000 },
      year: 2028,
      tradBalance: 80000,
      baseOrdinaryIncome: 90000,
      filingStatus: 'married_filing_jointly',
    });
    expect(amount).toBe(30000);
  });

  it('irmaa_aware respects max IRMAA income', async () => {
    const amount = await computeRothConversion(pool, {
      plan: { strategy_type: 'irmaa_aware', max_irmaa_income: 150000 },
      year: 2028,
      tradBalance: 100000,
      baseOrdinaryIncome: 130000,
      filingStatus: 'married_filing_jointly',
    });
    expect(amount).toBe(20000);
  });

  it('returns 0 when traditional balance is zero', async () => {
    const amount = await computeRothConversion(pool, {
      plan: { strategy_type: 'fixed', annual_fixed_amount: 10000 },
      year: 2028,
      tradBalance: 0,
      baseOrdinaryIncome: 0,
      filingStatus: 'married_filing_jointly',
    });
    expect(amount).toBe(0);
  });

  it('applyRothConversion moves balance from pre-tax to roth', () => {
    const buckets = { preTaxP1: 60000, preTaxP2: 40000, roth: 10000 };
    applyRothConversion(buckets, 20000);
    expect(buckets.preTaxP1).toBe(48000);
    expect(buckets.preTaxP2).toBe(32000);
    expect(buckets.roth).toBe(30000);
  });
});
