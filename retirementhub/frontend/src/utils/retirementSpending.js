/** @typedef {'monthly' | 'yearly'} RetirementSpendingPeriod */

/**
 * @param {string|number|null|undefined} amountStr
 * @param {RetirementSpendingPeriod} period
 * @returns {number|null}
 */
export function annualFromRetirementSpending(amountStr, period) {
  const trimmed = String(amountStr ?? '').trim();
  if (trimmed === '') return null;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return period === 'monthly' ? Math.round(n * 12 * 100) / 100 : Math.round(n * 100) / 100;
}

/**
 * @param {number|null|undefined} annual
 * @param {RetirementSpendingPeriod} [preferPeriod='monthly']
 */
export function retirementSpendingFormFromAnnual(annual, preferPeriod = 'monthly') {
  if (annual == null || annual <= 0) {
    return { amount: '', period: preferPeriod };
  }
  if (preferPeriod === 'yearly') {
    return { amount: String(Math.round(annual * 100) / 100), period: 'yearly' };
  }
  return { amount: String(Math.round((annual / 12) * 100) / 100), period: 'monthly' };
}

/**
 * @param {number|null|undefined} annual
 * @param {RetirementSpendingPeriod} period
 * @param {number|null|undefined} expenseGrowthPct
 */
export function describeRetirementSpending(annual, period, expenseGrowthPct) {
  if (annual == null || annual <= 0) return null;
  const shown =
    period === 'monthly'
      ? `${formatMoney(annual / 12)}/mo`
      : `${formatMoney(annual)}/yr`;
  const other =
    period === 'monthly'
      ? `${formatMoney(annual)}/yr`
      : `${formatMoney(annual / 12)}/mo`;
  const growth =
    expenseGrowthPct != null && Number.isFinite(expenseGrowthPct)
      ? `, then +${expenseGrowthPct}%/yr`
      : ', then grows with expense %/yr';
  return `${shown} (${other} in first retirement year${growth})`;
}

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}
