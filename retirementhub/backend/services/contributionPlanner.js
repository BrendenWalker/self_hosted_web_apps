const { ageAtEoy } = require('../lib/dates');

function limitsToBase(limits) {
  return {
    ira: limits.ira?.base ?? 0,
    ira_catch_up: limits.ira?.catch_up ?? 0,
    '401k_elective': limits['401k_elective']?.base ?? 0,
    '401k_catch_up': limits['401k_elective']?.catch_up ?? 0,
    hsa_individual: limits.hsa_individual?.base ?? 0,
    hsa_family: limits.hsa_family?.base ?? 0,
    hsa_catch_up: limits.hsa_individual?.catch_up ?? 0,
  };
}

function buildPartyContributionLimits(birthYear, base, year) {
  const age = ageAtEoy(birthYear, year);
  const k401CatchUp = age != null && age >= 50 ? base['401k_catch_up'] || 0 : 0;
  const iraCatchUp = age != null && age >= 50 ? base.ira_catch_up || 0 : 0;
  const hsaCatchUp = age != null && age >= 55 ? base.hsa_catch_up || 0 : 0;
  return {
    '401k_elective_limit': (base['401k_elective'] || 0) + k401CatchUp,
    ira_combined_limit: (base.ira || 0) + iraCatchUp,
    hsa_individual_limit: (base.hsa_individual || 0) + hsaCatchUp,
  };
}

function buildHsaFamilyHouseholdLimit(base, p1BirthYear, p2BirthYear, year) {
  const p1Age = ageAtEoy(p1BirthYear, year);
  const p2Age = ageAtEoy(p2BirthYear, year);
  const catchUp = base.hsa_catch_up || 0;
  const p1CatchUp = p1Age != null && p1Age >= 55 ? catchUp : 0;
  const p2CatchUp = p2Age != null && p2Age >= 55 ? catchUp : 0;
  return (base.hsa_family || 0) + p1CatchUp + p2CatchUp;
}

function capIraCombined(tradPlanned, rothPlanned, combinedLimit) {
  const trad = Math.max(0, tradPlanned || 0);
  const roth = Math.max(0, rothPlanned || 0);
  const sum = trad + roth;
  const limit = combinedLimit > 0 ? combinedLimit : sum;
  if (sum <= limit) {
    return { trad, roth };
  }
  if (sum <= 0) return { trad: 0, roth: 0 };
  const ratio = limit / sum;
  return {
    trad: Math.round(trad * ratio * 100) / 100,
    roth: Math.round(roth * ratio * 100) / 100,
  };
}

function isMarriedFilingJointly(filingStatus) {
  return filingStatus === 'married_filing_jointly';
}

/** Per-person HSA cap used in projections: family limit for MFJ, individual otherwise. */
function getHsaEffectivePerPersonLimit(birthYear, base, year, filingStatus, familyHsaLimit) {
  if (isMarriedFilingJointly(filingStatus)) {
    return familyHsaLimit;
  }
  return buildPartyContributionLimits(birthYear, base, year).hsa_individual_limit;
}

function capHsaHousehold(hsaP1, hsaP2, p1IndLimit, p2IndLimit, familyLimit, filingStatus) {
  const mfj = isMarriedFilingJointly(filingStatus);
  const p1Cap =
    mfj && familyLimit > 0
      ? familyLimit
      : p1IndLimit > 0
        ? p1IndLimit
        : Math.max(0, hsaP1 || 0);
  const p2Cap =
    mfj && familyLimit > 0
      ? familyLimit
      : p2IndLimit > 0
        ? p2IndLimit
        : Math.max(0, hsaP2 || 0);
  let p1 = Math.min(Math.max(0, hsaP1 || 0), p1Cap);
  let p2 = Math.min(Math.max(0, hsaP2 || 0), p2Cap);
  const total = p1 + p2;
  if (mfj && familyLimit != null && familyLimit > 0 && total > familyLimit) {
    if (total <= 0) return { p1: 0, p2: 0 };
    const ratio = familyLimit / total;
    p1 = Math.round(p1 * ratio * 100) / 100;
    p2 = Math.round((familyLimit - p1) * 100) / 100;
  }
  return { p1, p2 };
}

function parseIncomeAmount(income, field) {
  if (!income || income[field] == null || income[field] === '') return 0;
  const n = parseFloat(income[field]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function scaledAnnual(baseAnnual, raiseFactor, active) {
  if (!active || baseAnnual <= 0) return 0;
  return baseAnnual * (raiseFactor > 0 ? raiseFactor : 1);
}

function computeParty401k(contribSalary, pct, matchPct, limit401k) {
  if (contribSalary <= 0) return 0;
  const planned = contribSalary * (pct || 0) + contribSalary * (matchPct || 0);
  const cap = limit401k > 0 ? limit401k : planned;
  return Math.round(Math.min(planned, cap) * 100) / 100;
}

function computeYearContributions({
  income,
  limitsBase,
  p1BirthYear,
  p2BirthYear,
  year,
  p1Retired,
  p2Retired,
  bonusActive,
  raiseFactor,
  salaryP1,
  salaryP2,
  fourOOneKPctP1,
  fourOOneKPctP2,
  matchPctP1,
  matchPctP2,
  filingStatus = 'married_filing_jointly',
}) {
  const limP1 = buildPartyContributionLimits(p1BirthYear, limitsBase, year);
  const limP2 = buildPartyContributionLimits(p2BirthYear, limitsBase, year);
  const familyHsaLimit = buildHsaFamilyHouseholdLimit(limitsBase, p1BirthYear, p2BirthYear, year);

  const contribSalaryP1 = p1Retired ? 0 : salaryP1;
  const contribSalaryP2 = p2Retired ? 0 : salaryP2;

  const fourOOneKp1 = computeParty401k(
    contribSalaryP1,
    fourOOneKPctP1,
    matchPctP1,
    limP1['401k_elective_limit']
  );
  const fourOOneKp2 = computeParty401k(
    contribSalaryP2,
    fourOOneKPctP2,
    matchPctP2,
    limP2['401k_elective_limit']
  );

  const iraP1 = capIraCombined(
    scaledAnnual(parseIncomeAmount(income, 'ira_traditional_annual_p1'), raiseFactor, !p1Retired),
    scaledAnnual(parseIncomeAmount(income, 'ira_roth_annual_p1'), raiseFactor, !p1Retired),
    limP1.ira_combined_limit || 1e9
  );
  const iraP2 = capIraCombined(
    scaledAnnual(parseIncomeAmount(income, 'ira_traditional_annual_p2'), raiseFactor, !p2Retired),
    scaledAnnual(parseIncomeAmount(income, 'ira_roth_annual_p2'), raiseFactor, !p2Retired),
    limP2.ira_combined_limit || 1e9
  );

  const hsaRawP1 = scaledAnnual(parseIncomeAmount(income, 'hsa_annual_p1'), raiseFactor, !p1Retired);
  const hsaRawP2 = scaledAnnual(parseIncomeAmount(income, 'hsa_annual_p2'), raiseFactor, !p2Retired);
  const hsa = capHsaHousehold(
    hsaRawP1,
    hsaRawP2,
    limP1.hsa_individual_limit || hsaRawP1,
    limP2.hsa_individual_limit || hsaRawP2,
    familyHsaLimit,
    filingStatus
  );

  const taxableP1 = scaledAnnual(
    parseIncomeAmount(income, 'taxable_savings_annual_p1'),
    raiseFactor,
    !p1Retired
  );
  const taxableP2 = scaledAnnual(
    parseIncomeAmount(income, 'taxable_savings_annual_p2'),
    raiseFactor,
    !p2Retired
  );

  const bonusQuarterlyP1 = income ? parseFloat(income.bonus_quarterly) || 0 : 0;
  const bonusQuarterlyP2 = income ? parseFloat(income.bonus_quarterly_p2) || 0 : 0;
  const incomeBonusP1 =
    bonusActive && !p1Retired
      ? Math.round(bonusQuarterlyP1 * 4 * (raiseFactor > 0 ? raiseFactor : 1) * 100) / 100
      : 0;
  const incomeBonusP2 =
    bonusActive && !p2Retired
      ? Math.round(bonusQuarterlyP2 * 4 * (raiseFactor > 0 ? raiseFactor : 1) * 100) / 100
      : 0;

  const round = (n) => Math.round(n * 100) / 100;
  return {
    fourOOneKp1,
    fourOOneKp2,
    iraTradP1: iraP1.trad,
    iraRothP1: iraP1.roth,
    iraTradP2: iraP2.trad,
    iraRothP2: iraP2.roth,
    hsaP1: hsa.p1,
    hsaP2: hsa.p2,
    taxableP1: round(taxableP1),
    taxableP2: round(taxableP2),
    total401k: round(fourOOneKp1 + fourOOneKp2),
    totalIraTraditional: round(iraP1.trad + iraP2.trad),
    totalIraRoth: round(iraP1.roth + iraP2.roth),
    totalHsa: round(hsa.p1 + hsa.p2),
    totalTaxable: round(taxableP1 + taxableP2),
    incomeBonusP1,
    incomeBonusP2,
    total: round(
      fourOOneKp1 +
        fourOOneKp2 +
        iraP1.trad +
        iraP1.roth +
        iraP2.trad +
        iraP2.roth +
        hsa.p1 +
        hsa.p2 +
        taxableP1 +
        taxableP2
    ),
  };
}

function applyDirectedContributions(buckets, tradP1, tradP2, c) {
  buckets.preTax401kP1 += c.fourOOneKp1;
  buckets.preTaxP1 += c.fourOOneKp1;
  tradP1 += c.fourOOneKp1;

  buckets.preTax401kP2 += c.fourOOneKp2;
  buckets.preTaxP2 += c.fourOOneKp2;
  tradP2 += c.fourOOneKp2;

  buckets.preTaxIraP1 += c.iraTradP1;
  buckets.preTaxP1 += c.iraTradP1;
  tradP1 += c.iraTradP1;

  buckets.preTaxIraP2 += c.iraTradP2;
  buckets.preTaxP2 += c.iraTradP2;
  tradP2 += c.iraTradP2;

  buckets.rothIra += c.iraRothP1 + c.iraRothP2;
  buckets.roth += c.iraRothP1 + c.iraRothP2;

  buckets.hsa += c.hsaP1 + c.hsaP2;
  buckets.taxable += c.taxableP1 + c.taxableP2;

  return { tradP1, tradP2 };
}

function splitSurplusByParty(p1Earned, p2Earned, surplus) {
  if (surplus <= 0) {
    return { p1Share: surplus, p2Share: 0 };
  }
  const p1 = Math.max(0, p1Earned || 0);
  const p2 = Math.max(0, p2Earned || 0);
  const total = p1 + p2;
  if (total <= 0) {
    const half = surplus / 2;
    return { p1Share: half, p2Share: surplus - half };
  }
  const p1Share = surplus * (p1 / total);
  return { p1Share, p2Share: surplus - p1Share };
}

/** Route positive surplus after directed contributions to taxable or discretionary spending. */
function allocateSurplusAfterDirected({
  surplusAfterDirected,
  p1Earned,
  p2Earned,
  surplusToTaxableP1,
  surplusToTaxableP2,
}) {
  const round = (n) => Math.round(n * 100) / 100;
  if (surplusAfterDirected <= 0) {
    return {
      growthSavingsAmount: surplusAfterDirected,
      surplusTaxableP1: 0,
      surplusTaxableP2: 0,
      surplusTaxableTotal: 0,
      discretionarySpentP1: 0,
      discretionarySpentP2: 0,
      discretionarySpentTotal: 0,
    };
  }
  const { p1Share, p2Share } = splitSurplusByParty(p1Earned, p2Earned, surplusAfterDirected);
  const surplusTaxableP1 = surplusToTaxableP1 ? round(p1Share) : 0;
  const surplusTaxableP2 = surplusToTaxableP2 ? round(p2Share) : 0;
  const discretionarySpentP1 = surplusToTaxableP1 ? 0 : round(p1Share);
  const discretionarySpentP2 = surplusToTaxableP2 ? 0 : round(p2Share);
  return {
    growthSavingsAmount: 0,
    surplusTaxableP1,
    surplusTaxableP2,
    surplusTaxableTotal: round(surplusTaxableP1 + surplusTaxableP2),
    discretionarySpentP1,
    discretionarySpentP2,
    discretionarySpentTotal: round(discretionarySpentP1 + discretionarySpentP2),
  };
}

function incomeSurplusToTaxableFlag(income, field) {
  if (!income || income[field] == null) return true;
  return !!income[field];
}

/**
 * Reduce surplus routed to taxable savings by estimated federal tax.
 * Directed taxable_savings_annual_* amounts are entered net and are not adjusted here.
 */
function applyFederalTaxToSurplusTaxable({ surplusTaxableP1, surplusTaxableP2, federalTaxTotal }) {
  const round = (n) => Math.round(n * 100) / 100;
  const grossP1 = Math.max(0, surplusTaxableP1 || 0);
  const grossP2 = Math.max(0, surplusTaxableP2 || 0);
  const grossTotal = round(grossP1 + grossP2);
  const taxTotal = Math.max(0, federalTaxTotal || 0);
  if (grossTotal <= 0 || taxTotal <= 0) {
    return {
      surplusTaxableP1: grossP1,
      surplusTaxableP2: grossP2,
      surplusTaxableTotal: grossTotal,
      surplusTaxableTaxWithheld: 0,
    };
  }
  const withheld = round(Math.min(taxTotal, grossTotal));
  const taxP1 = round(withheld * (grossP1 / grossTotal));
  const taxP2 = round(withheld - taxP1);
  const netP1 = round(Math.max(0, grossP1 - taxP1));
  const netP2 = round(Math.max(0, grossP2 - taxP2));
  return {
    surplusTaxableP1: netP1,
    surplusTaxableP2: netP2,
    surplusTaxableTotal: round(netP1 + netP2),
    surplusTaxableTaxWithheld: withheld,
  };
}

module.exports = {
  limitsToBase,
  buildPartyContributionLimits,
  buildHsaFamilyHouseholdLimit,
  isMarriedFilingJointly,
  getHsaEffectivePerPersonLimit,
  capIraCombined,
  capHsaHousehold,
  computeYearContributions,
  applyDirectedContributions,
  splitSurplusByParty,
  allocateSurplusAfterDirected,
  applyFederalTaxToSurplusTaxable,
  incomeSurplusToTaxableFlag,
};
