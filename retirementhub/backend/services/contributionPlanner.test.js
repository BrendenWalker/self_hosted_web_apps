const {
  capIraCombined,
  capHsaHousehold,
  computeYearContributions,
  limitsToBase,
  allocateSurplusAfterDirected,
} = require('./contributionPlanner');

describe('contributionPlanner', () => {
  const base = limitsToBase({
    ira: { base: 7000, catch_up: 1000 },
    '401k_elective': { base: 23000, catch_up: 7500 },
    hsa_individual: { base: 4150, catch_up: 1000 },
    hsa_family: { base: 8300, catch_up: 1000 },
  });

  it('caps combined IRA contributions per person', () => {
    expect(capIraCombined(5000, 4000, 7000)).toEqual({ trad: 3888.89, roth: 3111.11 });
    expect(capIraCombined(3000, 2000, 8000)).toEqual({ trad: 3000, roth: 2000 });
  });

  it('caps household HSA at family limit', () => {
    expect(capHsaHousehold(5000, 5000, 5150, 5150, 8300)).toEqual({ p1: 4150, p2: 4150 });
  });

  it('computes year contributions with IRA and HSA limits', () => {
    const c = computeYearContributions({
      income: {
        ira_traditional_annual_p1: 5000,
        ira_roth_annual_p1: 4000,
        hsa_annual_p1: 6000,
        hsa_annual_p2: 3000,
        taxable_savings_annual_p1: 12000,
        bonus_quarterly: 1000,
        bonus_quarterly_p2: 500,
      },
      limitsBase: base,
      p1BirthYear: 1970,
      p2BirthYear: 1975,
      year: 2026,
      p1Retired: false,
      p2Retired: false,
      bonusActive: true,
      raiseFactor: 1,
      salaryP1: 120000,
      salaryP2: 80000,
      fourOOneKPctP1: 0.1,
      fourOOneKPctP2: 0.08,
      matchPctP1: 0.04,
      matchPctP2: 0.04,
    });
    expect(c.total401k).toBe(26400);
    expect(c.totalIraTraditional + c.totalIraRoth).toBe(8000);
    expect(c.totalHsa).toBeLessThanOrEqual(8300);
    expect(c.incomeBonusP1).toBe(4000);
    expect(c.incomeBonusP2).toBe(2000);
    expect(c.totalTaxable).toBe(12000);
  });

  it('routes surplus to taxable or discretionary by party checkbox', () => {
    const bothSaved = allocateSurplusAfterDirected({
      surplusAfterDirected: 10000,
      p1Earned: 120000,
      p2Earned: 80000,
      surplusToTaxableP1: true,
      surplusToTaxableP2: true,
    });
    expect(bothSaved.surplusTaxableTotal).toBe(10000);
    expect(bothSaved.discretionarySpentTotal).toBe(0);
    expect(bothSaved.growthSavingsAmount).toBe(0);

    const p2Spends = allocateSurplusAfterDirected({
      surplusAfterDirected: 10000,
      p1Earned: 120000,
      p2Earned: 80000,
      surplusToTaxableP1: true,
      surplusToTaxableP2: false,
    });
    expect(p2Spends.surplusTaxableP1).toBe(6000);
    expect(p2Spends.discretionarySpentP2).toBe(4000);
  });

  it('passes negative surplus through for portfolio drawdown', () => {
    const deficit = allocateSurplusAfterDirected({
      surplusAfterDirected: -5000,
      p1Earned: 100000,
      p2Earned: 0,
      surplusToTaxableP1: true,
      surplusToTaxableP2: false,
    });
    expect(deficit.growthSavingsAmount).toBe(-5000);
    expect(deficit.surplusTaxableTotal).toBe(0);
  });
});
