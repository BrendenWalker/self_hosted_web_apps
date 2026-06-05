const { explainScenarioComparison, pickBest } = require('./scenarioExplanationService');

describe('scenarioExplanationService', () => {
  const baseline = {
    scenario_name: 'Baseline',
    lifetime_total_tax: 400000,
    ending_net_worth: 1200000,
    peak_rmd: 45000,
    peak_rmd_year: 2045,
    total_roth_conversions: 0,
    withdrawal_strategy: 'conservative',
    p1_ss_claim_age: 67,
  };

  const alternative = {
    scenario_name: 'Early Roth',
    lifetime_total_tax: 358000,
    ending_net_worth: 1250000,
    peak_rmd: 38000,
    peak_rmd_year: 2045,
    total_roth_conversions: 120000,
    withdrawal_strategy: 'tax_aware',
    p1_ss_claim_age: 67,
  };

  it('summarizes tax and net worth differences', () => {
    const result = explainScenarioComparison(baseline, alternative);
    expect(result.summary).toMatch(/Early Roth lowers lifetime taxes/i);
    expect(result.drivers.length).toBeGreaterThan(0);
    expect(result.highlights.lowest_lifetime_tax.scenario_name).toBe('Early Roth');
    expect(result.highlights.highest_ending_net_worth.scenario_name).toBe('Early Roth');
  });

  it('pickBest selects min or max', () => {
    const rows = [baseline, alternative];
    expect(pickBest(rows, 'lifetime_total_tax', true).scenario_name).toBe('Early Roth');
    expect(pickBest(rows, 'ending_net_worth', false).scenario_name).toBe('Early Roth');
  });

  it('warns when peak RMD rises materially', () => {
    const highRmd = { ...alternative, peak_rmd: 70000, peak_rmd_year: 2048 };
    const result = explainScenarioComparison(baseline, highRmd);
    expect(result.warnings.some((w) => /Peak RMD/i.test(w))).toBe(true);
  });
});
