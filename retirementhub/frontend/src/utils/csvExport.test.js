import { describe, expect, test } from 'vitest';
import {
  COMPARE_EXPORT_BALANCE_NOTE,
  compareManyScenariosToCsv,
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

  test('marks first financial depletion year after retirement', () => {
    const rows = enrichScenarioYearRows([
      { year: 2026, p1_retired: false, p2_retired: false, financial_balance: 100000 },
      { year: 2027, p1_retired: true, p2_retired: false, financial_balance: 50000 },
      { year: 2028, p1_retired: true, p2_retired: false, financial_balance: 0 },
      { year: 2029, p1_retired: true, p2_retired: false, financial_balance: 0 },
    ]);
    expect(rows[0].financial_balance_depleted).toBe('');
    expect(rows[1].financial_balance_depleted).toBe('');
    expect(rows[2].financial_balance_depleted).toBe('Y');
    expect(rows[3].financial_balance_depleted).toBe('');
    expect(rows[2].post_financial_depletion).toBe('');
    expect(rows[3].post_financial_depletion).toBe('Y');
  });

  test('adds draw breakdown and portfolio depletion markers', () => {
    const rows = enrichScenarioYearRows([
      {
        year: 2060,
        p1_retired: true,
        p2_retired: true,
        financial_balance: 0,
        hard_asset_balance: 50000,
        spending_sources: {
          cash: 0,
          taxable: 0,
          traditional_ira: 0,
          roth: 0,
          hsa: 0,
          asset_liquidation: 12000,
        },
      },
      {
        year: 2061,
        p1_retired: true,
        p2_retired: true,
        financial_balance: 0,
        hard_asset_balance: 0,
      },
    ]);
    expect(rows[0].draw_asset_liquidation).toBe(12000);
    expect(rows[0].portfolio_fully_depleted).toBe('');
    expect(rows[1].post_financial_depletion).toBe('Y');
    expect(rows[1].portfolio_fully_depleted).toBe('Y');
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
    expect(lines[0]).toMatch(/^# Balance validation:/);
    const header = lines.find((line) => line.startsWith('year,'));
    expect(header).toContain('year,p1_age_eoy,p2_age_eoy');
    expect(header).toContain('Baseline:net_worth');
    expect(header).toContain('Retire Early:net_worth');
    expect(header).toContain('Baseline:p1_retirement_starts');
    expect(header).toContain('Retire Early:p1_ss_starts');
    expect(lines.length).toBe(6);
    const dataRows = lines.filter((line) => /^20\d{2},/.test(line));
    expect(dataRows).toHaveLength(2);
    expect(dataRows[0]).toMatch(/^2026,60,58,/);
    expect(dataRows[0]).toContain('1000000');
    expect(dataRows[0]).toContain('950000');
  });

  test('merges three or more scenarios with prefixed columns', () => {
    const csv = compareManyScenariosToCsv([
      { name: 'Baseline', years: [{ year: 2026, p1_age_eoy: 60, net_worth: 1000000 }] },
      { name: 'Retire Early', years: [{ year: 2026, p1_age_eoy: 60, net_worth: 950000 }] },
      { name: 'At 65', years: [{ year: 2026, p1_age_eoy: 60, net_worth: 980000 }] },
    ]);
    const header = csv.trim().split('\n').find((line) => line.startsWith('year,'));
    expect(header).toContain('Baseline:net_worth');
    expect(header).toContain('Retire Early:net_worth');
    expect(header).toContain('At 65:net_worth');
    expect(csv).toContain('1000000');
    expect(csv).toContain('950000');
    expect(csv).toContain('980000');
  });

  test('includes balance validation note and new export columns', () => {
    const csv = compareManyScenariosToCsv([
      {
        name: 'Retire at 62',
        years: [
          {
            year: 2060,
            p1_age_eoy: 98,
            p2_age_eoy: 96,
            p1_retired: true,
            p2_retired: true,
            financial_balance: 0,
            net_worth: 0,
            savings_added_total: 0,
            income_from_savings_draw: 0,
            retirement_funding_shortfall: 12000,
            expenses: 72000,
            income_ss_total: 60000,
            rmd: 0,
            income_wages: 0,
            income_bonus: 0,
          },
        ],
      },
    ]);
    expect(csv.startsWith(`# ${COMPARE_EXPORT_BALANCE_NOTE}`)).toBe(true);
    expect(csv).toContain('# financial_balance is savings accounts only');
    expect(csv).toContain('# Post-depletion funding:');
    expect(csv).toContain('Retire at 62:financial_balance_depleted');
    expect(csv).toContain('Retire at 62:post_financial_depletion');
    expect(csv).toContain('Retire at 62:draw_asset_liquidation');
    expect(csv).toContain('Retire at 62:savings_added_total');
  });
});
