/** Stable column order for projection year exports. */
export const PROJECTION_CSV_COLUMNS = [
  'year',
  'p1_age_eoy',
  'p2_age_eoy',
  'net_worth',
  'financial_balance',
  'hard_asset_balance',
  'income',
  'income_wages',
  'income_bonus',
  'income_ss_total',
  'taxable_ss_estimate',
  'rmd',
  'income_from_savings_draw',
  'taxable_income_before_deduction',
  'taxable_income_after_standard_deduction',
  'standard_deduction_estimate',
  'federal_tax_total',
  'federal_effective_rate_pct',
  'expenses',
  'savings',
  'contributions_401k',
  'retirement_funding_shortfall',
];

/** Shown in compare CSV header comment and on the compare page. */
export const COMPARE_EXPORT_BALANCE_NOTE =
  'Balance validation: use financial_balance, income_from_savings_draw, retirement_funding_shortfall, savings_added_total. Tax columns and savings are informational cash-flow fields.';

/** Per-scenario milestone columns (retirement / Social Security start). */
export const SCENARIO_COMPARE_INDICATOR_COLUMNS = [
  'p1_retired',
  'p2_retired',
  'p1_retirement_starts',
  'p2_retirement_starts',
  'p1_ss_starts',
  'p2_ss_starts',
  'financial_balance_depleted',
];

/** Numeric projection fields exported for each scenario in a comparison. */
export const SCENARIO_COMPARE_VALUE_COLUMNS = [
  'net_worth',
  'financial_balance',
  'hard_asset_balance',
  'income',
  'income_wages',
  'income_wage_p1',
  'income_wage_p2',
  'income_bonus',
  'income_ss_p1',
  'income_ss_p2',
  'income_ss_total',
  'taxable_ss_estimate',
  'rmd',
  'rmd_p1',
  'rmd_p2',
  'roth_conversion',
  'income_from_savings_draw',
  'retirement_funding_shortfall',
  'taxable_income_before_deduction',
  'taxable_income_after_standard_deduction',
  'standard_deduction_estimate',
  'taxable_ss_plus_rmd',
  'federal_tax_ordinary_estimate',
  'federal_tax_capital_gains_estimate',
  'federal_tax_total',
  'federal_effective_rate_pct',
  'marginal_rate_pct',
  'medicare_part_b_monthly_estimate',
  'expenses',
  'savings',
  'contributions_401k',
  'savings_added_total',
];

function escapeCsvCell(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowValue(row, key) {
  const v = row[key];
  if (v != null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

function scenarioDisplayName(name, fallback) {
  const trimmed = String(name || fallback).trim();
  return trimmed || fallback;
}

function scenarioColumnHeader(scenarioName, columnKey, fallback) {
  return `${scenarioDisplayName(scenarioName, fallback)}:${columnKey}`;
}

function scenarioFileSlug(name, fallback) {
  const slug = String(name || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .toLowerCase();
  return slug || fallback;
}

/**
 * Adds Y markers for the first year each party retires or starts Social Security.
 * @param {Record<string, unknown>[]} years
 */
export function enrichScenarioYearRows(years) {
  if (!years?.length) return [];
  let p1RetSeen = false;
  let p2RetSeen = false;
  let p1SsSeen = false;
  let p2SsSeen = false;
  let retirementPhaseSeen = false;
  let depletedSeen = false;
  return years.map((row) => {
    const p1RetirementStarts = !p1RetSeen && row.p1_retired;
    const p2RetirementStarts = !p2RetSeen && row.p2_retired;
    const p1SsStarts = !p1SsSeen && (row.income_ss_p1 ?? 0) > 0;
    const p2SsStarts = !p2SsSeen && (row.income_ss_p2 ?? 0) > 0;
    const inRetirementPhase = !!(row.p1_retired || row.p2_retired);
    if (inRetirementPhase) retirementPhaseSeen = true;
    const financialBalanceDepleted =
      retirementPhaseSeen &&
      !depletedSeen &&
      (row.financial_balance ?? 0) === 0;
    if (row.p1_retired) p1RetSeen = true;
    if (row.p2_retired) p2RetSeen = true;
    if ((row.income_ss_p1 ?? 0) > 0) p1SsSeen = true;
    if ((row.income_ss_p2 ?? 0) > 0) p2SsSeen = true;
    if (financialBalanceDepleted) depletedSeen = true;
    return {
      ...row,
      p1_retired: row.p1_retired ? 'Y' : '',
      p2_retired: row.p2_retired ? 'Y' : '',
      p1_retirement_starts: p1RetirementStarts ? 'Y' : '',
      p2_retirement_starts: p2RetirementStarts ? 'Y' : '',
      p1_ss_starts: p1SsStarts ? 'Y' : '',
      p2_ss_starts: p2SsStarts ? 'Y' : '',
      financial_balance_depleted: financialBalanceDepleted ? 'Y' : '',
    };
  });
}

function rowsByYear(years) {
  const map = new Map();
  for (const row of enrichScenarioYearRows(years || [])) {
    map.set(row.year, row);
  }
  return map;
}

/**
 * @param {Record<string, unknown>[]} years
 * @param {string[]} [columns]
 */
export function yearsToCsv(years, columns = PROJECTION_CSV_COLUMNS) {
  if (!years?.length) {
    return `${columns.join(',')}\n`;
  }
  const header = columns.join(',');
  const body = years.map((row) => columns.map((k) => escapeCsvCell(rowValue(row, k))).join(','));
  return `${header}\n${body.join('\n')}\n`;
}

/**
 * One row per year with shared ages and prefixed columns for each scenario.
 * @param {{ name: string, years: Record<string, unknown>[] }[]} scenarios
 * @param {{ valueColumns?: string[], indicatorColumns?: string[] }} [options]
 */
export function compareManyScenariosToCsv(
  scenarios,
  {
    valueColumns = SCENARIO_COMPARE_VALUE_COLUMNS,
    indicatorColumns = SCENARIO_COMPARE_INDICATOR_COLUMNS,
  } = {}
) {
  const series = (scenarios || []).map((scenario, index) => ({
    name: scenarioDisplayName(scenario.name, `Scenario ${index + 1}`),
    byYear: rowsByYear(scenario.years),
  }));
  const years = [
    ...new Set(series.flatMap((entry) => [...entry.byYear.keys()])),
  ].sort((a, b) => a - b);

  const headerCells = [
    'year',
    'p1_age_eoy',
    'p2_age_eoy',
    ...series.flatMap((entry) => [
      ...indicatorColumns.map((k) => scenarioColumnHeader(entry.name, k, 'Scenario')),
      ...valueColumns.map((k) => scenarioColumnHeader(entry.name, k, 'Scenario')),
    ]),
  ];

  const noteLine = `# ${COMPARE_EXPORT_BALANCE_NOTE}`;

  if (!years.length) {
    return `${noteLine}\n${headerCells.map((c) => escapeCsvCell(c)).join(',')}\n`;
  }

  const body = years.map((year) => {
    const ageRow =
      series.map((entry) => entry.byYear.get(year)).find((row) => row?.p1_age_eoy != null) ||
      series.map((entry) => entry.byYear.get(year)).find(Boolean) ||
      {};
    const cells = [
      year,
      ageRow.p1_age_eoy ?? '',
      ageRow.p2_age_eoy ?? '',
      ...series.flatMap((entry) => {
        const row = entry.byYear.get(year) || {};
        return [
          ...indicatorColumns.map((k) => row[k] ?? ''),
          ...valueColumns.map((k) => rowValue(row, k)),
        ];
      }),
    ];
    return cells.map((v) => escapeCsvCell(v)).join(',');
  });

  return `${noteLine}\n${headerCells.map((c) => escapeCsvCell(c)).join(',')}\n${body.join('\n')}\n`;
}

/**
 * @deprecated Prefer compareManyScenariosToCsv — kept for two-scenario callers.
 */
export function compareScenariosToCsv(
  baselineYears,
  altYears,
  {
    baselineName = 'Baseline',
    altName = 'Alternative',
    valueColumns = SCENARIO_COMPARE_VALUE_COLUMNS,
    indicatorColumns = SCENARIO_COMPARE_INDICATOR_COLUMNS,
  } = {}
) {
  return compareManyScenariosToCsv(
    [
      { name: baselineName, years: baselineYears },
      { name: altName, years: altYears },
    ],
    { valueColumns, indicatorColumns }
  );
}

/** Trigger a browser download of a multi-scenario comparison CSV. */
export function downloadManyScenariosCompareCsv(scenarios) {
  const csv = compareManyScenariosToCsv(scenarios);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = (scenarios || [])
    .map((scenario, index) => scenarioFileSlug(scenario.name, `scenario_${index + 1}`))
    .join('-vs-');
  a.download = `retirementhub-compare-${slug || 'scenarios'}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** @deprecated Prefer downloadManyScenariosCompareCsv */
export function downloadScenarioCompareCsv(baselineYears, altYears, { baselineName, altName } = {}) {
  downloadManyScenariosCompareCsv([
    { name: baselineName, years: baselineYears },
    { name: altName, years: altYears },
  ]);
}
