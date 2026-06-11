import { describe, expect, test } from 'vitest';
import {
  drawFundingBreakdownFromRow,
  incomeBreakdownFromRow,
  incomeComponentsTotal,
  mergeMultiScenarioIncomeBreakdown,
  mergeScenarioIncomeBreakdown,
} from './incomeBreakdown';

describe('incomeBreakdownFromRow', () => {
  test('extracts components that sum to spendable income', () => {
    const row = {
      income_wages: 80000,
      income_bonus: 5000,
      income_ss_total: 24000,
      rmd: 5000,
      income_from_savings_draw: 10000,
      income: 124000,
      expenses: 120000,
      retirement_funding_shortfall: 0,
    };
    const breakdown = incomeBreakdownFromRow(row);
    expect(incomeComponentsTotal(breakdown)).toBe(124000);
    expect(breakdown.total).toBe(124000);
    expect(breakdown.expenses).toBe(120000);
  });

  test('extracts per-bucket draw breakdown from spending_sources', () => {
    const breakdown = drawFundingBreakdownFromRow({
      rmd: 5000,
      spending_sources: {
        cash: 1000,
        taxable: 2000,
        traditional_ira: 8000,
        roth: 3000,
        hsa: 500,
        asset_liquidation: 15000,
      },
    });
    expect(breakdown.draw_cash).toBe(1000);
    expect(breakdown.draw_taxable).toBe(2000);
    expect(breakdown.draw_pretax).toBe(3000);
    expect(breakdown.draw_roth).toBe(3000);
    expect(breakdown.draw_hsa).toBe(500);
    expect(breakdown.draw_asset_liquidation).toBe(15000);
    expect(
      breakdown.draw_cash +
        breakdown.draw_taxable +
        breakdown.draw_pretax +
        breakdown.draw_roth +
        breakdown.draw_hsa +
        breakdown.draw_asset_liquidation
    ).toBe(24500);
  });

  test('falls back to withdrawals object for savings draw', () => {
    const breakdown = incomeBreakdownFromRow({
      income_wages: 0,
      income_ss_total: 32122,
      rmd: 0,
      income: 74343,
      income_from_savings_draw: 0,
      expenses: 74343,
      withdrawals: {
        cashWithdrawals: 0,
        taxableWithdrawals: 42221,
        preTaxWithdrawals: 0,
        rothWithdrawals: 0,
        hsaWithdrawals: 0,
        unmetSpending: 0,
      },
    });
    expect(breakdown.savings).toBe(42221);
    expect(breakdown.total).toBe(74343);
  });
});

describe('mergeScenarioIncomeBreakdown', () => {
  test('merges years from both scenarios', () => {
    const rows = mergeScenarioIncomeBreakdown(
      [{
        year: 2026,
        income_wages: 0,
        income_bonus: 0,
        income_ss_total: 43416,
        rmd: 0,
        income_from_savings_draw: 19621,
        income: 63037,
        expenses: 63037,
      }],
      [{
        year: 2026,
        income_ss_total: 200,
        rmd: 50,
        income_from_savings_draw: 0,
        income: 250,
        expenses: 300,
        retirement_funding_shortfall: 50,
      }],
      'baseline',
      'alt'
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].baseline.total).toBe(63037);
    expect(rows[0].baseline.expenses).toBe(63037);
    expect(rows[0].alt.shortfall).toBe(50);
  });
});

describe('mergeMultiScenarioIncomeBreakdown', () => {
  test('merges three scenarios by year', () => {
    const rows = mergeMultiScenarioIncomeBreakdown([
      { key: 'a', years: [{ year: 2026, income: 100, expenses: 80 }] },
      { key: 'b', years: [{ year: 2026, income: 200, expenses: 150 }] },
      { key: 'c', years: [{ year: 2026, income: 300, expenses: 250 }] },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].scenarios.a.total).toBe(100);
    expect(rows[0].scenarios.b.total).toBe(200);
    expect(rows[0].scenarios.c.total).toBe(300);
  });
});
