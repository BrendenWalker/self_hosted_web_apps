const { explainYearlyDiff, computeYearlyDeltas } = require('./scenarioYearlyDiffService');

function makeRow(year, overrides = {}) {
  return {
    year,
    federal_tax_total: 10000,
    net_worth: 1000000,
    rmd: 0,
    roth_conversion: 0,
    income_ss_total: 0,
    income_ss_p1: 0,
    income_ss_p2: 0,
    is_retired: false,
    irmaa_warning: false,
    withdrawals: { preTaxWithdrawals: 0, taxableWithdrawals: 0, rothWithdrawals: 0 },
    ...overrides,
  };
}

describe('scenarioYearlyDiffService', () => {
  it('computes per-year tax and net worth deltas', () => {
    const baseline = [makeRow(2030), makeRow(2031, { federal_tax_total: 12000 })];
    const alt = [makeRow(2030, { federal_tax_total: 15000 }), makeRow(2031, { federal_tax_total: 11000 })];
    const deltas = computeYearlyDeltas(baseline, alt);
    expect(deltas).toHaveLength(2);
    expect(deltas[0].federal_tax_delta).toBe(5000);
    expect(deltas[1].federal_tax_delta).toBe(-1000);
  });

  it('attributes Roth conversion window with tax impact', () => {
    const baseline = [2032, 2033, 2034, 2035, 2036, 2037].map((y) => makeRow(y));
    const alt = [2032, 2033, 2034, 2035, 2036, 2037].map((y) =>
      makeRow(y, {
        roth_conversion: y <= 2035 ? 25000 : 0,
        federal_tax_total: y <= 2035 ? 18000 : 10000,
      })
    );
    const { period_drivers } = explainYearlyDiff(baseline, alt);
    const roth = period_drivers.find((d) => d.kind === 'roth_conversion');
    expect(roth).toBeDefined();
    expect(roth.year_start).toBe(2032);
    expect(roth.year_end).toBe(2035);
    expect(roth.amount_delta).toBe(100000);
  });

  it('detects SS timing shift for P1', () => {
    const baseline = [makeRow(2028), makeRow(2029, { income_ss_p1: 24000, income_ss_total: 24000 })];
    const alt = [makeRow(2028), makeRow(2029), makeRow(2030, { income_ss_p1: 30000, income_ss_total: 30000 })];
    const { period_drivers } = explainYearlyDiff(baseline, alt);
    expect(period_drivers.some((d) => d.kind === 'ss_timing' && /P1 Social Security/.test(d.label))).toBe(true);
  });

  it('warns on new IRMAA years in alternative', () => {
    const baseline = [makeRow(2028)];
    const alt = [makeRow(2028, { irmaa_warning: true })];
    const { irmaa_warnings } = explainYearlyDiff(baseline, alt);
    expect(irmaa_warnings.some((w) => /IRMAA/.test(w))).toBe(true);
  });
});
