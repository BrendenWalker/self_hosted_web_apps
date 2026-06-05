export const CLAIM_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70];

export const WITHDRAWAL_STRATEGIES = [
  { value: 'conservative', label: 'Conservative (cash → taxable → trad → Roth)' },
  { value: 'tax_aware', label: 'Tax-aware' },
  { value: 'custom', label: 'Custom order' },
];

export const ROTH_STRATEGIES = [
  { value: 'none', label: 'None' },
  { value: 'fixed', label: 'Fixed annual amount' },
  { value: 'fill_bracket', label: 'Fill tax bracket' },
  { value: 'fill_income', label: 'Fill to income target' },
  { value: 'irmaa_aware', label: 'IRMAA-aware cap' },
];

export const WITHDRAWAL_BUCKETS = [
  { key: 'cash', label: 'Cash' },
  { key: 'taxable', label: 'Taxable' },
  { key: 'pre_tax', label: 'Traditional / pre-tax' },
  { key: 'roth', label: 'Roth' },
  { key: 'hsa', label: 'HSA' },
];

export const DEFAULT_CONSERVATIVE_ORDER = ['cash', 'taxable', 'pre_tax', 'roth', 'hsa'];

export const WIZARD_STEPS = [
  { id: 1, label: 'Basics' },
  { id: 2, label: 'Retirement' },
  { id: 3, label: 'Social Security' },
  { id: 4, label: 'Spending & growth' },
  { id: 5, label: 'Withdrawal' },
  { id: 6, label: 'Roth' },
  { id: 7, label: 'Review' },
];

export function labelForStrategy(value, list) {
  return list.find((x) => x.value === value)?.label || value || '—';
}
