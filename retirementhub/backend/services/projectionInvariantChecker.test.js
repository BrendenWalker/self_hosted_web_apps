'use strict';

const {
  computeSpendingGap,
  checkProjectionInvariants,
  assertProjectionInvariants,
} = require('./projectionInvariantChecker');

describe('projectionInvariantChecker', () => {
  it('computeSpendingGap matches expenses minus covered income', () => {
    const gap = computeSpendingGap({
      expenses: 80000,
      income_ss_total: 20000,
      rmd: 5000,
      income_wages: 0,
      income_bonus: 0,
    });
    expect(gap).toBe(55000);
  });

  it('passes a fully funded retirement year', () => {
    const row = {
      year: 2030,
      financial_balance: 500000,
      hard_asset_balance: 0,
      net_worth: 500000,
      expenses: 80000,
      income: 80000,
      income_wages: 0,
      income_bonus: 0,
      income_ss_total: 30000,
      rmd: 10000,
      income_from_savings_draw: 40000,
      retirement_funding_shortfall: 0,
    };
    expect(checkProjectionInvariants([row])).toEqual([]);
    expect(() => assertProjectionInvariants([row])).not.toThrow();
  });

  it('flags negative financial balance', () => {
    const violations = checkProjectionInvariants([
      {
        year: 2031,
        financial_balance: -100,
        hard_asset_balance: 0,
        net_worth: -100,
        expenses: 0,
        income: 0,
        income_wages: 0,
        income_bonus: 0,
        income_ss_total: 0,
        rmd: 0,
        income_from_savings_draw: 0,
        retirement_funding_shortfall: 0,
      },
    ]);
    expect(violations.some((v) => v.rule === 'financial_balance_non_negative')).toBe(true);
  });

  it('flags funding identity mismatch', () => {
    const violations = checkProjectionInvariants([
      {
        year: 2032,
        financial_balance: 0,
        hard_asset_balance: 0,
        net_worth: 0,
        expenses: 60000,
        income: 30000,
        income_wages: 0,
        income_bonus: 0,
        income_ss_total: 30000,
        rmd: 0,
        income_from_savings_draw: 10000,
        retirement_funding_shortfall: 0,
      },
    ]);
    expect(violations.some((v) => v.rule === 'funding_identity')).toBe(true);
  });

  it('flags phantom draws when portfolio was already depleted', () => {
    const violations = checkProjectionInvariants([
      {
        year: 2032,
        financial_balance: 0,
        hard_asset_balance: 0,
        net_worth: 0,
        expenses: 60000,
        income: 60000,
        income_wages: 0,
        income_bonus: 0,
        income_ss_total: 30000,
        rmd: 0,
        income_from_savings_draw: 30000,
        retirement_funding_shortfall: 0,
        savings_added_total: 0,
      },
      {
        year: 2033,
        financial_balance: 0,
        hard_asset_balance: 0,
        net_worth: 0,
        expenses: 60000,
        income: 35000,
        income_wages: 0,
        income_bonus: 0,
        income_ss_total: 30000,
        rmd: 0,
        income_from_savings_draw: 5000,
        retirement_funding_shortfall: 25000,
        savings_added_total: 0,
      },
    ]);
    expect(violations.some((v) => v.rule === 'depletion_no_phantom_draws')).toBe(true);
  });

  it('requires shortfall when portfolio was already depleted and unfunded', () => {
    const violations = checkProjectionInvariants([
      {
        year: 2033,
        financial_balance: 0,
        hard_asset_balance: 0,
        net_worth: 0,
        expenses: 60000,
        income: 60000,
        income_wages: 0,
        income_bonus: 0,
        income_ss_total: 30000,
        rmd: 0,
        income_from_savings_draw: 30000,
        retirement_funding_shortfall: 0,
        savings_added_total: 0,
      },
      {
        year: 2034,
        financial_balance: 0,
        hard_asset_balance: 0,
        net_worth: 0,
        expenses: 60000,
        income: 30000,
        income_wages: 0,
        income_bonus: 0,
        income_ss_total: 30000,
        rmd: 0,
        income_from_savings_draw: 0,
        retirement_funding_shortfall: 0,
        savings_added_total: 0,
      },
    ]);
    expect(violations.some((v) => v.rule === 'depletion_shortfall_active')).toBe(true);
  });

  it('allows draws in the depletion year itself', () => {
    const row = {
      year: 2030,
      financial_balance: 0,
      hard_asset_balance: 0,
      net_worth: 0,
      expenses: 60000,
      income: 60000,
      income_wages: 0,
      income_bonus: 0,
      income_ss_total: 20000,
      rmd: 0,
      income_from_savings_draw: 40000,
      retirement_funding_shortfall: 0,
      savings_added_total: 0,
    };
    expect(checkProjectionInvariants([row])).toEqual([]);
  });
});
