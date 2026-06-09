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
      (w.hsaWithdrawals ?? 0) +
      (w.assetLiquidations ?? 0);
  }
  if (savings === 0 && row.spending_sources) {
    const src = row.spending_sources;
    savings =
      (src.cash ?? 0) +
      (src.taxable ?? 0) +
      (src.roth ?? 0) +
      (src.hsa ?? 0) +
      (src.asset_liquidation ?? 0) +
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
 * Merge yearly rows for one or more scenarios (side-by-side compare).
 * @param {{ key: string, name?: string, years: Record<string, unknown>[] }[]} scenarioSeries
 */
export function mergeMultiScenarioIncomeBreakdown(scenarioSeries) {
  const series = (scenarioSeries || []).map((scenario, index) => ({
    key: scenario.key || scenarioChartKey(scenario.name, `scenario_${index + 1}`),
    byYear: new Map((scenario.years || []).map((row) => [row.year, row])),
  }));
  const years = [
    ...new Set(series.flatMap((entry) => [...entry.byYear.keys()])),
  ].sort((a, b) => a - b);

  return years.map((year) => {
    const row = { year, scenarios: {} };
    for (const entry of series) {
      const breakdown = incomeBreakdownFromRow(entry.byYear.get(year));
      row.scenarios[entry.key] = breakdown;
      row[`${entry.key}_wages`] = breakdown.wages + breakdown.bonus;
      row[`${entry.key}_ss`] = breakdown.ss;
      row[`${entry.key}_rmd`] = breakdown.rmd;
      row[`${entry.key}_savings`] = breakdown.savings;
      row[`${entry.key}_total`] = breakdown.total;
      row[`${entry.key}_expenses`] = breakdown.expenses;
    }
    if (series[0]) row.baseline = row.scenarios[series[0].key];
    if (series[1]) row.alt = row.scenarios[series[1].key];
    return row;
  });
}

/**
 * Merge baseline and alternative yearly rows for side-by-side compare.
 * @param {Record<string, unknown>[]} baselineYears
 * @param {Record<string, unknown>[]} altYears
 * @param {string} baselineKey
 * @param {string} altKey
 */
export function mergeScenarioIncomeBreakdown(baselineYears, altYears, baselineKey, altKey) {
  return mergeMultiScenarioIncomeBreakdown([
    { key: baselineKey, years: baselineYears },
    { key: altKey, years: altYears },
  ]);
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
