const taxParams = require('./taxParameters');
const {
  ordinaryTaxFromBrackets,
  estimateTaxableSocialSecurityAnnual,
} = require('./taxEngine');

const TAX_PARAM_BASE_YEAR = 2025;

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

async function federalOrdinaryTaxWithBreakdown(pool, taxableIncome, filingStatus, year) {
  const brackets = await taxParams.getFederalBrackets(pool, year, filingStatus);
  return ordinaryTaxFromBrackets(taxableIncome, brackets);
}

async function standardDeductionEstimate(pool, filingStatus, year, age1, age2) {
  return taxParams.getStandardDeduction(pool, year, filingStatus, age1, age2);
}

function federalLtcgTax(ltcg, ordinaryTaxableAfterDeduction, filingStatus, year) {
  if (ltcg <= 0) return 0;
  const f = taxParameterInflationFactor(year);
  const isMfj =
    (filingStatus || 'married_filing_jointly') === 'married_filing_jointly' ||
    filingStatus === 'married';
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

async function marginalOrdinaryRate(pool, taxableIncomeAfterDeduction, filingStatus, year) {
  const result = await federalOrdinaryTaxWithBreakdown(
    pool,
    taxableIncomeAfterDeduction + 1000,
    filingStatus,
    year
  );
  const atBase = await federalOrdinaryTaxWithBreakdown(
    pool,
    taxableIncomeAfterDeduction,
    filingStatus,
    year
  );
  const delta = result.total - atBase.total;
  return delta > 0 ? Math.round((delta / 1000) * 10000) / 10000 : 0;
}

async function bracketTopForRate(pool, targetRatePct, filingStatus, year) {
  const { thresholds, rates } = await taxParams.getFederalBracketConfig(pool, year, filingStatus);
  const rate = targetRatePct / 100;
  for (let i = 0; i < rates.length; i++) {
    if (Math.abs(rates[i] - rate) < 0.001) {
      const next = thresholds[i + 1];
      return next === Infinity ? null : Math.round(next * 100) / 100;
    }
  }
  return null;
}

function checkIrmaaWarning(magiProxy, filingStatus, year) {
  const f = taxParameterInflationFactor(year);
  const isMfj =
    (filingStatus || 'married_filing_jointly') === 'married_filing_jointly' ||
    filingStatus === 'married';
  const thresholds = isMfj ? IRMAA_THRESHOLDS_MFJ_2025 : IRMAA_THRESHOLDS_MFJ_2025;
  const firstTier = Math.round(thresholds[1].max * f * 100) / 100;
  return magiProxy >= firstTier * 0.95;
}

async function computeYearTax(pool, {
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
  const ordinaryIncome = ordinaryBeforeSs + taxableSs + qualifiedDividends;
  const standardDeduction = await standardDeductionEstimate(pool, filingStatus, year, age1, age2);
  const ordinaryTaxable = Math.max(0, Math.round((ordinaryIncome - standardDeduction) * 100) / 100);
  const ordinaryResult = await federalOrdinaryTaxWithBreakdown(pool, ordinaryTaxable, filingStatus, year);
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
    marginalRate: await marginalOrdinaryRate(pool, ordinaryTaxable, filingStatus, year),
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
  estimateTaxableSocialSecurityAnnual,
  federalOrdinaryTaxWithBreakdown,
  standardDeductionEstimate,
  federalLtcgTax,
  marginalOrdinaryRate,
  bracketTopForRate,
  checkIrmaaWarning,
  computeYearTax,
};
