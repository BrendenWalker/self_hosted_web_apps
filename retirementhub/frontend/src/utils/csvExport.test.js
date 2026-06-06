import { describe, expect, test } from 'vitest';
import {
  compareScenariosToCsv,
  enrichScenarioYearRows,
  yearsToCsv,
} from './csvExport';

describe('yearsToCsv', () => {
  test('produces header + one row per year', () => {
    const csv = yearsToCsv([
      { year: 2026, taxable_income_before_deduction: 100, federal_tax_total: 12 },
      { year: 2027, taxable_income_before_deduction: 110, federal_tax_total: 14 },
    ]);
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toMatch(/^year,/);
    expect(lines[1]).toMatch(/^2026,/);
    expect(lines[2]).toMatch(/^2027,/);
  });

  test('escapes commas and quotes in values', () => {
    const csv = yearsToCsv([{ year: 2026, note: 'has "quotes", commas' }], ['year', 'note']);
    expect(csv).toContain('"has ""quotes"", commas"');
  });
});

describe('enrichScenarioYearRows', () => {
  test('marks first retirement and SS start years', () => {
    const rows = enrichScenarioYearRows([
      { year: 2026, p1_retired: false, p2_retired: false, income_ss_p1: 0, income_ss_p2: 0 },
      { year: 2027, p1_retired: true, p2_retired: false, income_ss_p1: 12000, income_ss_p2: 0 },
      { year: 2028, p1_retired: true, p2_retired: true, income_ss_p1: 12000, income_ss_p2: 8000 },
    ]);
    expect(rows[0].p1_retirement_starts).toBe('');
    expect(rows[1].p1_retirement_starts).toBe('Y');
    expect(rows[1].p1_ss_starts).toBe('Y');
    expect(rows[2].p2_retirement_starts).toBe('Y');
    expect(rows[2].p2_ss_starts).toBe('Y');
    expect(rows[2].p1_retirement_starts).toBe('');
  });
});

describe('compareScenariosToCsv', () => {
  test('merges two scenarios with prefixed columns and one row per year', () => {
    const csv = compareScenariosToCsv(
      [
        { year: 2026, p1_age_eoy: 60, p2_age_eoy: 58, net_worth: 1000000, federal_tax_total: 10000 },
        { year: 2027, p1_age_eoy: 61, p2_age_eoy: 59, net_worth: 1100000, federal_tax_total: 11000 },
      ],
      [
        { year: 2026, p1_age_eoy: 60, p2_age_eoy: 58, net_worth: 950000, federal_tax_total: 9000 },
        { year: 2027, p1_age_eoy: 61, p2_age_eoy: 59, net_worth: 1050000, federal_tax_total: 9500 },
      ],
      { baselineName: 'Baseline', altName: 'Retire Early' }
    );
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('year,p1_age_eoy,p2_age_eoy');
    expect(lines[0]).toContain('Baseline:net_worth');
    expect(lines[0]).toContain('Retire Early:net_worth');
    expect(lines[0]).toContain('Baseline:p1_retirement_starts');
    expect(lines[0]).toContain('Retire Early:p1_ss_starts');
    expect(lines.length).toBe(3);
    expect(lines[1]).toMatch(/^2026,60,58,/);
    expect(lines[1]).toContain('1000000');
    expect(lines[1]).toContain('950000');
  });
});
