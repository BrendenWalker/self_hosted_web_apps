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
