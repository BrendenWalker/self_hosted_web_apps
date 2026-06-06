/** Income components shown on scenario compare breakdown. */
export function incomeBreakdownFromRow(row) {
  if (!row) {
    return {
      wages: 0,
      bonus: 0,
      ss: 0,
      rmd: 0,
      savings: 0,
      total: 0,
      expenses: 0,
      shortfall: 0,
    };
  }
  const wages = row.income_wages ?? 0;
  const bonus = row.income_bonus ?? 0;
  const ss = row.income_ss_total ?? 0;
  const rmd = row.rmd ?? 0;
  const expenses = row.expenses ?? 0;
  const shortfall = row.retirement_funding_shortfall ?? 0;

  let savings = row.income_from_savings_draw ?? 0;
  if (savings === 0 && row.withdrawals) {
    const w = row.withdrawals;
    savings =
      (w.cashWithdrawals ?? 0) +
      (w.taxableWithdrawals ?? 0) +
      (w.preTaxWithdrawals ?? 0) +
      (w.rothWithdrawals ?? 0) +
      (w.hsaWithdrawals ?? 0);
  }
  if (savings === 0 && row.spending_sources) {
    const src = row.spending_sources;
    savings =
      (src.cash ?? 0) +
      (src.taxable ?? 0) +
      (src.roth ?? 0) +
      (src.hsa ?? 0) +
      Math.max(0, (src.traditional_ira ?? 0) - rmd);
  }

  let total = row.income ?? wages + bonus + ss + rmd + savings;

  return { wages, bonus, ss, rmd, savings, total, expenses, shortfall };
}

/** @param {ReturnType<typeof incomeBreakdownFromRow>} breakdown */
export function incomeComponentsTotal(breakdown) {
  return breakdown.wages + breakdown.bonus + breakdown.ss + breakdown.rmd + breakdown.savings;
}

/**
 * Merge baseline and alternative yearly rows for side-by-side compare.
 * @param {Record<string, unknown>[]} baselineYears
 * @param {Record<string, unknown>[]} altYears
 * @param {string} baselineKey
 * @param {string} altKey
 */
export function mergeScenarioIncomeBreakdown(baselineYears, altYears, baselineKey, altKey) {
  const baselineByYear = new Map((baselineYears || []).map((r) => [r.year, r]));
  const altByYear = new Map((altYears || []).map((r) => [r.year, r]));
  const years = [...new Set([...baselineByYear.keys(), ...altByYear.keys()])].sort((a, b) => a - b);

  return years.map((year) => {
    const base = incomeBreakdownFromRow(baselineByYear.get(year));
    const alt = incomeBreakdownFromRow(altByYear.get(year));
    return {
      year,
      [`${baselineKey}_wages`]: base.wages + base.bonus,
      [`${baselineKey}_ss`]: base.ss,
      [`${baselineKey}_rmd`]: base.rmd,
      [`${baselineKey}_savings`]: base.savings,
      [`${baselineKey}_total`]: base.total,
      [`${baselineKey}_expenses`]: base.expenses,
      [`${altKey}_wages`]: alt.wages + alt.bonus,
      [`${altKey}_ss`]: alt.ss,
      [`${altKey}_rmd`]: alt.rmd,
      [`${altKey}_savings`]: alt.savings,
      [`${altKey}_total`]: alt.total,
      [`${altKey}_expenses`]: alt.expenses,
      baseline: base,
      alt,
    };
  });
}

export function scenarioChartKey(name, fallback) {
  const slug = String(name || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
    .toLowerCase();
  return slug || fallback;
}
