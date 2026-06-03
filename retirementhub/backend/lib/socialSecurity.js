const FRA_AGE = 67;
const EARNINGS_TEST_ANNUAL_LIMIT = 23600;

function ssFactorForAge(age) {
  if (age == null || !Number.isInteger(age)) return null;
  const a = Math.min(70, Math.max(62, age));
  if (a <= 67) return 0.70 + (a - 62) * (0.30 / 5);
  return 1.0 + (a - 67) * (0.24 / 3);
}

function ssMonthlyAtClaimAge(atFraMonthly, claimAge) {
  if (atFraMonthly == null || !Number.isFinite(atFraMonthly) || atFraMonthly <= 0) return null;
  if (claimAge == null || !Number.isInteger(claimAge)) return null;
  const age = Math.min(70, Math.max(62, claimAge));
  const factor = ssFactorForAge(age);
  return factor != null ? Math.round(atFraMonthly * factor * 100) / 100 : null;
}

function ssEarningsTestWarning(claimAge, wageIncome) {
  if (claimAge == null || claimAge >= FRA_AGE) return false;
  return (wageIncome || 0) > EARNINGS_TEST_ANNUAL_LIMIT;
}

function lifetimeBenefitsEstimate(monthlyBenefit, startAge, endAge, colaFactor) {
  if (!monthlyBenefit || monthlyBenefit <= 0 || startAge == null || endAge == null) return 0;
  let total = 0;
  for (let age = startAge; age <= endAge; age++) {
    const yearsFromStart = Math.max(0, age - startAge);
    const annual = monthlyBenefit * 12 * Math.pow(colaFactor, yearsFromStart);
    total += annual;
  }
  return Math.round(total * 100) / 100;
}

function breakevenAgeVs62(monthlyAtClaim, claimAge, monthlyAt62) {
  if (!monthlyAt62 || monthlyAt62 <= 0 || !monthlyAtClaim || claimAge <= 62) return null;
  const extraPerMonth = monthlyAtClaim - monthlyAt62;
  if (extraPerMonth <= 0) return null;
  const monthsDelayed = (claimAge - 62) * 12;
  const foregone = monthlyAt62 * monthsDelayed;
  const monthsToBreakEven = foregone / extraPerMonth;
  return Math.round((62 + monthsToBreakEven / 12) * 10) / 10;
}

module.exports = {
  FRA_AGE,
  EARNINGS_TEST_ANNUAL_LIMIT,
  ssFactorForAge,
  ssMonthlyAtClaimAge,
  ssEarningsTestWarning,
  lifetimeBenefitsEstimate,
  breakevenAgeVs62,
};
