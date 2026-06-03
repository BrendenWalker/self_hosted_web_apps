const TAX_PARAM_BASE_YEAR = 2025;

const FEDERAL_ORDINARY_BRACKETS_2025 = {
  married_filing_jointly: {
    thresholds: [0, 23850, 96950, 206700, 394600, 501050, 751600, Infinity],
    rates: [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37],
  },
  single: {
    thresholds: [0, 11925, 48475, 103350, 197300, 250525, 626350, Infinity],
    rates: [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37],
  },
  head_of_household: {
    thresholds: [0, 17000, 64850, 103350, 197300, 256100, 626350, Infinity],
    rates: [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37],
  },
};

const LTCG_BRACKETS_MFJ_2025 = [
  { max: 96700, rate: 0 },
  { max: 600050, rate: 0.15 },
  { max: Infinity, rate: 0.2 },
];

const IRMAA_THRESHOLDS_MFJ_2025 = [
  { max: 206000, tier: 0 },
  { max: 258000, tier: 1 },
  { max: 322000, tier: 2 },
  { max: 386000, tier: 3 },
  { max: 750000, tier: 4 },
  { max: Infinity, tier: 5 },
];

function taxParameterInflationFactor(year) {
  return Math.pow(1.02, Math.max(0, year - TAX_PARAM_BASE_YEAR));
}

function inflateTaxDollars(amount, year) {
  const f = taxParameterInflationFactor(year);
  return Math.round(amount * f * 100) / 100;
}

function estimateTaxableSocialSecurityAnnual(otherIncome, ssAnnual, filingStatus) {
  if (ssAnnual <= 0) return 0;
  const halfSs = ssAnnual * 0.5;
  const combined = otherIncome + halfSs;
  const fs = filingStatus || 'married_filing_jointly';
  const mfj = fs === 'married_filing_jointly';
  const t0 = mfj ? 32000 : 25000;
  const t1 = mfj ? 44000 : 34000;
  const bridge = mfj ? 6000 : 4500;
  if (combined <= t0) return 0;
  if (combined <= t1) {
    return Math.round(Math.min(0.5 * ssAnnual, 0.5 * (combined - t0)) * 100) / 100;
  }
  const cap = 0.85 * ssAnnual;
  const alt = 0.85 * (combined - t1) + bridge;
  return Math.round(Math.min(cap, alt) * 100) / 100;
}

function federalOrdinaryTaxWithBreakdown(taxableIncome, filingStatus, year) {
  const fs = filingStatus || 'married_filing_jointly';
  const key = fs === 'head_of_household' ? 'head_of_household' : fs === 'married_filing_jointly' ? 'married_filing_jointly' : 'single';
  const cfg = FEDERAL_ORDINARY_BRACKETS_2025[key];
  const f = taxParameterInflationFactor(year);
  const thresholds = cfg.thresholds.map((t) => (t === Infinity ? Infinity : Math.round(t * f * 100) / 100));
  const rates = cfg.rates;
  let remaining = Math.max(0, taxableIncome);
  let total = 0;
  const brackets = [];
  for (let i = 0; i < rates.length; i++) {
    const low = thresholds[i];
    const high = thresholds[i + 1];
    const bandMax = high === Infinity ? remaining : high - low;
    const take = Math.min(remaining, bandMax);
    if (take > 0) {
      const taxAmt = take * rates[i];
      total += taxAmt;
      brackets.push({
        rate_pct: Math.round(rates[i] * 1000) / 10,
        income_in_band: Math.round(take * 100) / 100,
        tax: Math.round(taxAmt * 100) / 100,
      });
      remaining -= take;
    }
    if (remaining <= 0) break;
  }
  return { total: Math.round(total * 100) / 100, brackets };
}

function standardDeductionEstimate(filingStatus, year, age1, age2) {
  const fs = filingStatus || 'married_filing_jointly';
  const base2025 = {
    married_filing_jointly: 31500,
    single: 15750,
    head_of_household: 23625,
    married_filing_separately: 15750,
  };
  let b = base2025[fs] ?? base2025.married_filing_jointly;
  b = inflateTaxDollars(b, year);
  const addMfj = inflateTaxDollars(1550, year);
  const addSingle = inflateTaxDollars(1950, year);
  if (fs === 'married_filing_jointly') {
    const e1 = age1 != null && age1 >= 65 ? addMfj : 0;
    const e2 = age2 != null && age2 >= 65 ? addMfj : 0;
    return Math.round((b + e1 + e2) * 100) / 100;
  }
  const age = fs === 'married_filing_separately' ? age1 : age1;
  const elderly = age != null && age >= 65;
  return Math.round((b + (elderly ? addSingle : 0)) * 100) / 100;
}

function federalLtcgTax(ltcg, ordinaryTaxableAfterDeduction, filingStatus, year) {
  if (ltcg <= 0) return 0;
  const f = taxParameterInflationFactor(year);
  const isMfj = (filingStatus || 'married_filing_jointly') === 'married_filing_jointly';
  const brackets = isMfj ? LTCG_BRACKETS_MFJ_2025 : LTCG_BRACKETS_MFJ_2025;
  let tax = 0;
  let remaining = ltcg;
  let prev = 0;
  const stackBase = Math.max(0, ordinaryTaxableAfterDeduction);
  for (const b of brackets) {
    const max = b.max === Infinity ? Infinity : Math.round(b.max * f * 100) / 100;
    const room = max === Infinity ? remaining : Math.max(0, max - stackBase - prev);
    const take = Math.min(remaining, room > 0 ? room : remaining);
    if (take > 0 && b.rate > 0) tax += take * b.rate;
    remaining -= take;
    if (max !== Infinity) prev = max - stackBase;
    if (remaining <= 0) break;
  }
  return Math.round(tax * 100) / 100;
}

function marginalOrdinaryRate(taxableIncomeAfterDeduction, filingStatus, year) {
  const result = federalOrdinaryTaxWithBreakdown(taxableIncomeAfterDeduction + 1000, filingStatus, year);
  const atBase = federalOrdinaryTaxWithBreakdown(taxableIncomeAfterDeduction, filingStatus, year);
  const delta = result.total - atBase.total;
  return delta > 0 ? Math.round((delta / 1000) * 10000) / 10000 : 0;
}

function bracketTopForRate(targetRatePct, filingStatus, year) {
  const fs = filingStatus || 'married_filing_jointly';
  const key = fs === 'head_of_household' ? 'head_of_household' : fs === 'married_filing_jointly' ? 'married_filing_jointly' : 'single';
  const cfg = FEDERAL_ORDINARY_BRACKETS_2025[key];
  const f = taxParameterInflationFactor(year);
  const rate = targetRatePct / 100;
  for (let i = 0; i < cfg.rates.length; i++) {
    if (Math.abs(cfg.rates[i] - rate) < 0.001) {
      const next = cfg.thresholds[i + 1];
      return next === Infinity ? null : Math.round(next * f * 100) / 100;
    }
  }
  return null;
}

function checkIrmaaWarning(magiProxy, filingStatus, year) {
  const f = taxParameterInflationFactor(year);
  const isMfj = (filingStatus || 'married_filing_jointly') === 'married_filing_jointly';
  const thresholds = isMfj ? IRMAA_THRESHOLDS_MFJ_2025 : IRMAA_THRESHOLDS_MFJ_2025;
  const firstTier = Math.round(thresholds[1].max * f * 100) / 100;
  return magiProxy >= firstTier * 0.95;
}

function computeYearTax({
  wages = 0,
  bonus = 0,
  rmd = 0,
  rothConversion = 0,
  preTaxWithdrawals = 0,
  rothWithdrawals = 0,
  cashWithdrawals = 0,
  taxableWithdrawals = 0,
  longTermCapGains = 0,
  qualifiedDividends = 0,
  ssAnnual = 0,
  filingStatus,
  year,
  age1,
  age2,
}) {
  const ordinaryBeforeSs =
    wages + bonus + rmd + rothConversion + preTaxWithdrawals + cashWithdrawals;
  const otherForSs = ordinaryBeforeSs + longTermCapGains + qualifiedDividends;
  const taxableSs = estimateTaxableSocialSecurityAnnual(otherForSs, ssAnnual, filingStatus);
  const ordinaryIncome =
    ordinaryBeforeSs + taxableSs + qualifiedDividends;
  const standardDeduction = standardDeductionEstimate(filingStatus, year, age1, age2);
  const ordinaryTaxable = Math.max(0, Math.round((ordinaryIncome - standardDeduction) * 100) / 100);
  const ordinaryResult = federalOrdinaryTaxWithBreakdown(ordinaryTaxable, filingStatus, year);
  const ltcgTax = federalLtcgTax(longTermCapGains, ordinaryTaxable, filingStatus, year);
  const totalTax = Math.round((ordinaryResult.total + ltcgTax) * 100) / 100;
  const magiProxy = ordinaryIncome + longTermCapGains;
  const effectiveRate =
    ordinaryTaxable + longTermCapGains > 0
      ? Math.round((totalTax / (ordinaryTaxable + longTermCapGains)) * 10000) / 100
      : 0;

  return {
    ordinaryTax: ordinaryResult.total,
    capitalGainsTax: ltcgTax,
    totalTax,
    effectiveRate,
    marginalRate: marginalOrdinaryRate(ordinaryTaxable, filingStatus, year),
    irmaaWarning: checkIrmaaWarning(magiProxy, filingStatus, year),
    taxableSs,
    standardDeduction,
    taxableIncomeAfterDeduction: ordinaryTaxable,
    federal_tax_brackets: ordinaryResult.brackets,
    rothWithdrawals,
  };
}

module.exports = {
  TAX_PARAM_BASE_YEAR,
  taxParameterInflationFactor,
  inflateTaxDollars,
  estimateTaxableSocialSecurityAnnual,
  federalOrdinaryTaxWithBreakdown,
  standardDeductionEstimate,
  federalLtcgTax,
  marginalOrdinaryRate,
  bracketTopForRate,
  checkIrmaaWarning,
  computeYearTax,
};
