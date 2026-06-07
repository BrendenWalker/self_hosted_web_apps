import { describe, expect, it } from 'vitest';
import {
  accumulationSummary,
  accumulationEndYearFromRetirement,
  buildChartRowsWithBeginning,
  chartYearDomain,
  clientRetirementYear,
  filterAccumulationYears,
  mapRowsToSavingsCategoryChart,
  retirementAgeFromStoredDate,
  retirementYearFromStoredDate,
} from './savingProjections';

describe('savingProjections', () => {
  it('parses retirement year and age from stored date', () => {
    expect(retirementYearFromStoredDate('2037-01-01')).toBe(2037);
    expect(retirementAgeFromStoredDate('2037-01-01', 1970)).toBe('67');
  });

  it('filters rows before retirement year', () => {
    const rows = [
      { year: 2026, financial_balance: 100 },
      { year: 2027, financial_balance: 110 },
      { year: 2028, financial_balance: 120, is_retired: true },
      { year: 2029, financial_balance: 130, is_retired: true },
    ];
    expect(filterAccumulationYears(rows, 2028, 2027)).toEqual([
      { year: 2026, financial_balance: 100 },
      { year: 2027, financial_balance: 110 },
    ]);
  });

  it('derives client retirement year from household ages', () => {
    expect(
      clientRetirementYear({ p1_birth_year: 1970, p2_birth_year: 1972 }, '67', '65')
    ).toBe(2037);
    expect(accumulationEndYearFromRetirement(2037)).toBe(2036);
  });

  it('clips chart rows to accumulation end year', () => {
    const projection = {
      start_year: 2026,
      starting_balances_by_savings_category: { '401k': 100, hsa: 0, ira_traditional: 0, ira_roth: 0, taxable: 0 },
    };
    const rows = [
      { year: 2026, balances_by_savings_category: { '401k': 110, hsa: 0, ira_traditional: 0, ira_roth: 0, taxable: 0 } },
      { year: 2027, balances_by_savings_category: { '401k': 120, hsa: 0, ira_traditional: 0, ira_roth: 0, taxable: 0 } },
      { year: 2028, balances_by_savings_category: { '401k': 130, hsa: 0, ira_traditional: 0, ira_roth: 0, taxable: 0 } },
    ];
    const chart = buildChartRowsWithBeginning(projection, rows, 2027);
    expect(chart.map((row) => row.year)).toEqual([2025, 2026, 2027]);
    expect(chartYearDomain(chart)).toEqual([2025, 2027]);
  });

  it('summarizes accumulation totals', () => {
    const rows = [
      {
        year: 2026,
        financial_balance: 100000,
        net_worth: 100000,
        contributions_401k: 10000,
        savings: 5000,
        balances_by_savings_category: { '401k': 60000, hsa: 5000, ira_traditional: 20000, ira_roth: 10000, taxable: 5000 },
      },
      {
        year: 2027,
        financial_balance: 120000,
        net_worth: 120000,
        contributions_401k: 10000,
        savings: 3000,
        balances_by_savings_category: { '401k': 70000, hsa: 6000, ira_traditional: 25000, ira_roth: 12000, taxable: 7000 },
      },
    ];
    const summary = accumulationSummary(rows, {
      target_25x_retirement: 1500000,
      retirement_year: 2028,
      year_reaches_target: null,
    });
    expect(summary.totalContributions401k).toBe(20000);
    expect(summary.totalSurplusSavings).toBe(8000);
    expect(summary.gapToTarget).toBe(1380000);
    expect(summary.endYear).toBe(2027);
    expect(summary.endingByCategory).toEqual([
      { key: '401k', label: '401(k)', value: 70000 },
      { key: 'hsa', label: 'HSA', value: 6000 },
      { key: 'ira_traditional', label: 'Traditional IRA', value: 25000 },
      { key: 'ira_roth', label: 'Roth IRA', value: 12000 },
      { key: 'taxable', label: 'Taxable', value: 7000 },
    ]);
  });

  it('maps projection rows to chart data', () => {
    const chart = mapRowsToSavingsCategoryChart([
      {
        year: 2026,
        balances_by_savings_category: { '401k': 100, hsa: 10, ira_traditional: 20, ira_roth: 30, taxable: 40 },
      },
    ]);
    expect(chart[0]).toMatchObject({ year: 2026, '401k': 100, hsa: 10, taxable: 40 });
  });

  it('prepends beginning balances to chart rows', () => {
    const projection = {
      start_year: 2026,
      starting_balances_by_savings_category: { '401k': 50000, hsa: 0, ira_traditional: 0, ira_roth: 0, taxable: 10000 },
    };
    const rows = [
      {
        year: 2026,
        balances_by_savings_category: { '401k': 60000, hsa: 0, ira_traditional: 0, ira_roth: 0, taxable: 12000 },
      },
    ];
    const chart = buildChartRowsWithBeginning(projection, rows);
    expect(chart).toHaveLength(2);
    expect(chart[0].year).toBe(2025);
    expect(chart[0]['401k']).toBe(50000);
    expect(chart[1]['401k']).toBe(60000);
  });

  it('uses starting account balances in summary', () => {
    const rows = [
      {
        year: 2026,
        financial_balance: 100000,
        net_worth: 100000,
        contributions_401k: 10000,
        savings_added_total: 15000,
        savings: 5000,
        balances_by_savings_category: { '401k': 60000, hsa: 0, ira_traditional: 0, ira_roth: 0, taxable: 40000 },
      },
    ];
    const summary = accumulationSummary(rows, {
      starting_financial_balance: 85000,
      starting_balances_by_savings_category: { '401k': 50000, hsa: 0, ira_traditional: 0, ira_roth: 0, taxable: 35000 },
      target_25x_retirement: 1500000,
      retirement_year: 2028,
    });
    expect(summary.startingFinancialBalance).toBe(85000);
    expect(summary.totalSavingsAdded).toBe(15000);
    expect(summary.startingByCategory[0]).toMatchObject({ key: '401k', value: 50000 });
  });
});
