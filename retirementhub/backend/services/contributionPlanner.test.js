const {
  capIraCombined,
  capHsaHousehold,
  computeYearContributions,
  limitsToBase,
  getHsaEffectivePerPersonLimit,
  allocateSurplusAfterDirected,
  applyFederalTaxToSurplusTaxable,
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

  it('caps household HSA at family limit for MFJ', () => {
    expect(
      capHsaHousehold(5000, 5000, 5150, 5150, 8300, 'married_filing_jointly')
    ).toEqual({ p1: 4150, p2: 4150 });
  });

  it('allows one MFJ spouse to contribute up to the family HSA limit', () => {
    expect(
      capHsaHousehold(8000, 0, 4400, 4400, 8750, 'married_filing_jointly')
    ).toEqual({ p1: 8000, p2: 0 });
    expect(
      capHsaHousehold(8000, 0, 4400, 4400, 8750, 'single')
    ).toEqual({ p1: 4400, p2: 0 });
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
      p1BirthYear: 1980,
      p2BirthYear: 1985,
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
      filingStatus: 'married_filing_jointly',
    });
    expect(c.total401k).toBe(26400);
    expect(c.totalIraTraditional + c.totalIraRoth).toBe(7000);
    expect(c.totalHsa).toBe(8300);
    expect(c.incomeBonusP1).toBe(4000);
    expect(c.incomeBonusP2).toBe(2000);
    expect(c.totalTaxable).toBe(12000);
  });

  it('uses family HSA limit for MFJ when only one spouse contributes', () => {
    const c = computeYearContributions({
      income: { hsa_annual_p1: 8500, hsa_annual_p2: 0 },
      limitsBase: base,
      p1BirthYear: 1980,
      p2BirthYear: 1982,
      year: 2026,
      p1Retired: false,
      p2Retired: false,
      bonusActive: true,
      raiseFactor: 1,
      salaryP1: 100000,
      salaryP2: 0,
      fourOOneKPctP1: 0,
      fourOOneKPctP2: 0,
      matchPctP1: 0,
      matchPctP2: 0,
      filingStatus: 'married_filing_jointly',
    });
    expect(c.hsaP1).toBe(8300);
    expect(c.hsaP2).toBe(0);
    expect(c.totalHsa).toBe(8300);
  });

  it('getHsaEffectivePerPersonLimit uses family cap for MFJ and individual otherwise', () => {
    const familyLimit = 8750;
    expect(getHsaEffectivePerPersonLimit(1980, base, 2026, 'married_filing_jointly', familyLimit)).toBe(8750);
    expect(getHsaEffectivePerPersonLimit(1980, base, 2026, 'single', familyLimit)).toBe(4150);
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

  it('withholds federal tax from surplus routed to taxable savings', () => {
    const adjusted = applyFederalTaxToSurplusTaxable({
      surplusTaxableP1: 60000,
      surplusTaxableP2: 40000,
      federalTaxTotal: 23724.56,
    });
    expect(adjusted.surplusTaxableTaxWithheld).toBe(23724.56);
    expect(adjusted.surplusTaxableP1).toBe(45765.26);
    expect(adjusted.surplusTaxableP2).toBe(30510.18);
    expect(adjusted.surplusTaxableTotal).toBe(76275.44);
  });

  it('does not withhold more tax than gross surplus to taxable', () => {
    const adjusted = applyFederalTaxToSurplusTaxable({
      surplusTaxableP1: 5000,
      surplusTaxableP2: 0,
      federalTaxTotal: 23724.56,
    });
    expect(adjusted.surplusTaxableTaxWithheld).toBe(5000);
    expect(adjusted.surplusTaxableTotal).toBe(0);
  });

  it('leaves discretionary surplus unchanged when tax is applied to taxable routing', () => {
    const gross = allocateSurplusAfterDirected({
      surplusAfterDirected: 10000,
      p1Earned: 120000,
      p2Earned: 80000,
      surplusToTaxableP1: true,
      surplusToTaxableP2: false,
    });
    expect(gross.discretionarySpentP2).toBe(4000);
    const adjusted = applyFederalTaxToSurplusTaxable({
      surplusTaxableP1: gross.surplusTaxableP1,
      surplusTaxableP2: gross.surplusTaxableP2,
      federalTaxTotal: 3000,
    });
    expect(adjusted.surplusTaxableP1).toBe(3000);
    expect(adjusted.surplusTaxableP2).toBe(0);
    expect(gross.discretionarySpentP2).toBe(4000);
  });
});
