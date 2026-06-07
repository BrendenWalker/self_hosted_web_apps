/** Calendar year from stored retirement date (YYYY-MM-DD). */
export function retirementYearFromStoredDate(dateStr) {
  if (!dateStr) return null;
  const y = parseInt(String(dateStr).slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/** Integer age at retirement from stored date + birth year. */
export function retirementAgeFromStoredDate(dateStr, birthYear) {
  const ry = retirementYearFromStoredDate(dateStr);
  const by = birthYear != null && birthYear !== '' ? parseInt(String(birthYear), 10) : null;
  if (ry == null || by == null || !Number.isFinite(by)) return '';
  const age = ry - by;
  if (!Number.isFinite(age)) return '';
  return String(Math.min(100, Math.max(62, age)));
}

/** Calendar year when the later of P1/P2 retires, from page inputs. */
export function clientRetirementYear(household, p1RetirementAge, p2RetirementAge) {
  const years = [];
  if (p1RetirementAge !== '' && household?.p1_birth_year != null) {
    const y = parseInt(String(household.p1_birth_year), 10) + parseInt(String(p1RetirementAge), 10);
    if (Number.isFinite(y)) years.push(y);
  }
  if (p2RetirementAge !== '' && household?.p2_birth_year != null) {
    const y = parseInt(String(household.p2_birth_year), 10) + parseInt(String(p2RetirementAge), 10);
    if (Number.isFinite(y)) years.push(y);
  }
  return years.length ? Math.max(...years) : null;
}

export function accumulationEndYearFromRetirement(retirementYear) {
  return retirementYear != null ? retirementYear - 1 : null;
}

/** Rows through the last accumulation year before household retirement. */
export function filterAccumulationYears(byYear, retirementYear, explicitEndYear) {
  const endYear = explicitEndYear ?? accumulationEndYearFromRetirement(retirementYear);
  if (!byYear?.length) return [];
  return byYear.filter((row) => {
    const y = Number(row.year);
    if (!Number.isFinite(y)) return false;
    if (endYear != null && y > endYear) return false;
    if (retirementYear != null && y >= retirementYear) return false;
    if (row.is_retired) return false;
    return true;
  });
}

export function chartYearDomain(chartRows) {
  if (!chartRows?.length) return undefined;
  const years = chartRows.map((row) => Number(row.year)).filter(Number.isFinite);
  if (!years.length) return undefined;
  return [Math.min(...years), Math.max(...years)];
}

export const SAVINGS_CATEGORIES = [
  { key: '401k', label: '401(k)', fill: '#4a6fa5' },
  { key: 'hsa', label: 'HSA', fill: '#c9b87a' },
  { key: 'ira_traditional', label: 'Traditional IRA', fill: '#6b8cae' },
  { key: 'ira_roth', label: 'Roth IRA', fill: '#2d8a6e' },
  { key: 'taxable', label: 'Taxable', fill: '#7a9e7e' },
];

export function mapSavingsCategoryRow(row) {
  const c = row.balances_by_savings_category || {};
  return {
    year: row.year,
    '401k': c['401k'] ?? 0,
    hsa: c.hsa ?? 0,
    ira_traditional: c.ira_traditional ?? 0,
    ira_roth: c.ira_roth ?? 0,
    taxable: c.taxable ?? 0,
  };
}

export function mapRowsToSavingsCategoryChart(rows) {
  return (rows || []).map(mapSavingsCategoryRow);
}

/** Prepend current account balances as the chart/table starting point. */
export function buildChartRowsWithBeginning(projection, rows, maxYear) {
  let clipped = rows || [];
  if (maxYear != null) {
    clipped = clipped.filter((row) => Number(row.year) <= maxYear);
  }
  const start = projection?.starting_balances_by_savings_category;
  if (!start || !clipped.length) return mapRowsToSavingsCategoryChart(clipped);
  const beginningYear = (projection.start_year ?? clipped[0].year) - 1;
  return mapRowsToSavingsCategoryChart([
    { year: beginningYear, balances_by_savings_category: start },
    ...clipped,
  ]);
}

export function beginningBalancesByCategory(projection) {
  const c = projection?.starting_balances_by_savings_category || {};
  return SAVINGS_CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    value: c[key] ?? 0,
  }));
}

export function savingsAddedForYear(row) {
  if (row?.savings_added_total != null) return row.savings_added_total;
  return (
    (row?.contributions_401k ?? 0) +
    (row?.contributions_ira_traditional ?? 0) +
    (row?.contributions_ira_roth ?? 0) +
    (row?.contributions_hsa ?? 0) +
    (row?.contributions_taxable ?? 0) +
    (row?.surplus_to_taxable ?? 0)
  );
}

export function endingBalancesByCategory(lastRow) {
  const c = lastRow?.balances_by_savings_category || {};
  return SAVINGS_CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    value: c[key] ?? 0,
  }));
}

/** Summary stats for the accumulation phase. */
export function accumulationSummary(rows, projection) {
  if (!rows?.length) {
    return {
      yearCount: 0,
      startYear: null,
      endYear: null,
      startingFinancialBalance: null,
      startingByCategory: [],
      endingFinancialBalance: null,
      endingNetWorth: null,
      totalContributions401k: 0,
      totalSavingsAdded: 0,
      totalSurplusSavings: 0,
      gapToTarget: null,
      reachesTargetBeforeRetirement: false,
      endingByCategory: [],
    };
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const target = projection?.target_25x_retirement ?? null;
  const endingFinancial = last.financial_balance ?? 0;
  const endingNetWorth = last.net_worth ?? 0;

  let totalContributions401k = 0;
  let totalSavingsAdded = 0;
  let totalSurplusSavings = 0;
  for (const row of rows) {
    totalContributions401k += row.contributions_401k ?? 0;
    totalSavingsAdded += savingsAddedForYear(row);
    const surplus = row.savings ?? 0;
    if (surplus > 0) totalSurplusSavings += surplus;
  }

  const yearReachesTarget = projection?.year_reaches_target ?? null;
  const retirementYear = projection?.retirement_year ?? null;
  const reachesTargetBeforeRetirement =
    yearReachesTarget != null &&
    retirementYear != null &&
    yearReachesTarget < retirementYear;

  return {
    yearCount: rows.length,
    startYear: first.year,
    endYear: last.year,
    startingFinancialBalance:
      projection?.starting_financial_balance ??
      (projection?.starting_balances_by_savings_category
        ? SAVINGS_CATEGORIES.reduce(
            (sum, cat) => sum + (projection.starting_balances_by_savings_category[cat.key] ?? 0),
            0
          )
        : null) ??
      (first.opening_balances_by_savings_category
        ? SAVINGS_CATEGORIES.reduce(
            (sum, cat) => sum + (first.opening_balances_by_savings_category[cat.key] ?? 0),
            0
          )
        : first.financial_balance ?? projection?.starting_net_worth ?? 0),
    startingByCategory: beginningBalancesByCategory(projection),
    endingFinancialBalance: endingFinancial,
    endingNetWorth,
    totalContributions401k: Math.round(totalContributions401k * 100) / 100,
    totalSavingsAdded: Math.round(totalSavingsAdded * 100) / 100,
    totalSurplusSavings: Math.round(totalSurplusSavings * 100) / 100,
    gapToTarget: target != null ? Math.round((target - endingNetWorth) * 100) / 100 : null,
    reachesTargetBeforeRetirement,
    yearReachesTarget,
    endingByCategory: endingBalancesByCategory(last),
  };
}
