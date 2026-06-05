import { describe, expect, test } from 'vitest';
import { yearsToCsv } from './csvExport';

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
