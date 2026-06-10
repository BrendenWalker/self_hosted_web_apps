'use strict';

const TOLERANCE = 0.02;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Spending gap before portfolio draws (matches projectionRunner spendingGap). */
function computeSpendingGap(row) {
  const expenses = num(row.expenses);
  const covered =
    num(row.income_ss_total) +
    num(row.rmd) +
    num(row.income_wages) +
    num(row.income_bonus);
  return Math.max(0, round2(expenses - covered));
}

function violation(year, rule, expected, actual) {
  return { year, rule, expected, actual };
}

function assertFinancialBalanceNonNegative(row) {
  const balance = num(row.financial_balance);
  if (balance < -TOLERANCE) {
    return violation(row.year, 'financial_balance_non_negative', '>= 0', balance);
  }
  return null;
}

function assertFundingIdentity(row) {
  const spendingGap = computeSpendingGap(row);
  if (spendingGap <= TOLERANCE) return null;

  const draws = num(row.income_from_savings_draw);
  const shortfall = num(row.retirement_funding_shortfall);
  const expectedGap = round2(draws + shortfall);

  if (Math.abs(expectedGap - spendingGap) > TOLERANCE) {
    return violation(
      row.year,
      'funding_identity',
      `draws + shortfall ≈ spending gap (${spendingGap})`,
      `draws=${draws}, shortfall=${shortfall}, sum=${expectedGap}`
    );
  }
  return null;
}

/** After prior year was fully depleted, ongoing gap must surface as shortfall (not draws). */
function assertDepletionPersistence(prevRow, row) {
  if (!prevRow) return null;

  const prevFinancial = num(prevRow.financial_balance);
  const prevHard = num(prevRow.hard_asset_balance);
  if (prevFinancial > TOLERANCE || prevHard > TOLERANCE) return null;

  const spendingGap = computeSpendingGap(row);
  if (spendingGap <= TOLERANCE) return null;

  const draws = num(row.income_from_savings_draw);
  const shortfall = num(row.retirement_funding_shortfall);

  if (draws > TOLERANCE) {
    return violation(
      row.year,
      'depletion_no_phantom_draws',
      'income_from_savings_draw ≈ 0 when portfolio was already depleted',
      draws
    );
  }
  if (shortfall <= TOLERANCE) {
    return violation(
      row.year,
      'depletion_shortfall_active',
      `shortfall ≈ spending gap (${spendingGap}) when portfolio was already depleted`,
      shortfall
    );
  }
  return null;
}

/** Once depleted with ongoing gap, balance stays zero unless savings are added. */
function assertNoSpuriousRecovery(prevRow, row) {
  if (!prevRow) return null;

  const prevFinancial = num(prevRow.financial_balance);
  const prevHard = num(prevRow.hard_asset_balance);
  if (prevFinancial > TOLERANCE || prevHard > TOLERANCE) return null;

  const spendingGap = computeSpendingGap(row);
  if (spendingGap <= TOLERANCE) return null;

  const savingsAdded = num(row.savings_added_total);
  if (savingsAdded > TOLERANCE) return null;

  const financial = num(row.financial_balance);
  if (financial > TOLERANCE) {
    return violation(
      row.year,
      'no_spurious_recovery',
      'financial_balance ≈ 0 when depleted with ongoing gap and no savings added',
      financial
    );
  }
  return null;
}

function assertIncomeSmoothing(row) {
  const spendingGap = computeSpendingGap(row);
  const shortfall = num(row.retirement_funding_shortfall);
  if (spendingGap <= TOLERANCE || shortfall > TOLERANCE) return null;

  const income = num(row.income);
  const expenses = num(row.expenses);
  if (Math.abs(income - expenses) > TOLERANCE) {
    return violation(
      row.year,
      'income_smoothing',
      `income ≈ expenses (${expenses}) when fully funded`,
      income
    );
  }
  return null;
}

function assertNetWorthConsistency(row) {
  const financial = num(row.financial_balance);
  const hard = num(row.hard_asset_balance);
  const netWorth = num(row.net_worth);
  const expected = round2(financial + hard);
  if (Math.abs(netWorth - expected) > TOLERANCE) {
    return violation(row.year, 'net_worth_consistency', expected, netWorth);
  }
  return null;
}

const ROW_CHECKS = [
  assertFinancialBalanceNonNegative,
  assertFundingIdentity,
  assertIncomeSmoothing,
  assertNetWorthConsistency,
];

/**
 * Validate projection year rows. Returns structured violations (empty = pass).
 * @param {Record<string, unknown>[]} byYear
 */
function checkProjectionInvariants(byYear) {
  const violations = [];
  const rows = byYear || [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prevRow = i > 0 ? rows[i - 1] : null;
    for (const check of ROW_CHECKS) {
      const result = check(row);
      if (result) violations.push(result);
    }
    const persistence = assertDepletionPersistence(prevRow, row);
    if (persistence) violations.push(persistence);
    const recovery = assertNoSpuriousRecovery(prevRow, row);
    if (recovery) violations.push(recovery);
  }
  return violations;
}

/**
 * @param {Record<string, unknown>[]} byYear
 * @throws {Error}
 */
function assertProjectionInvariants(byYear) {
  const violations = checkProjectionInvariants(byYear);
  if (violations.length === 0) return;
  const summary = violations
    .map((v) => `year ${v.year} [${v.rule}]: expected ${v.expected}, got ${v.actual}`)
    .join('\n');
  throw new Error(`Projection invariant violations:\n${summary}`);
}

module.exports = {
  TOLERANCE,
  computeSpendingGap,
  checkProjectionInvariants,
  assertProjectionInvariants,
  assertFinancialBalanceNonNegative,
  assertFundingIdentity,
  assertDepletionPersistence,
  assertNoSpuriousRecovery,
  assertIncomeSmoothing,
};
