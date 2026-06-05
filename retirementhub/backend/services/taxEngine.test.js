'use strict';

const { ordinaryTaxFromBrackets } = require('./taxEngine');

const MFJ_2025 = [
  { lower_bound: 0, rate: 0.10 },
  { lower_bound: 23850, rate: 0.12 },
  { lower_bound: 96950, rate: 0.22 },
  { lower_bound: 206700, rate: 0.24 },
  { lower_bound: 394600, rate: 0.32 },
  { lower_bound: 501050, rate: 0.35 },
  { lower_bound: 751600, rate: 0.37 },
];

describe('ordinaryTaxFromBrackets', () => {
  test('zero income → zero tax', () => {
    expect(ordinaryTaxFromBrackets(0, MFJ_2025).total).toBe(0);
  });

  test('income inside first bracket', () => {
    expect(ordinaryTaxFromBrackets(10000, MFJ_2025).total).toBeCloseTo(1000, 2);
  });

  test('income exactly at first threshold uses only the 10% bracket', () => {
    expect(ordinaryTaxFromBrackets(23850, MFJ_2025).total).toBeCloseTo(2385, 2);
  });

  test('income one cent above first threshold puts the penny in the 12% bracket', () => {
    const r = ordinaryTaxFromBrackets(23850.01, MFJ_2025);
    expect(r.brackets).toHaveLength(2);
    expect(r.brackets[1].income_in_band).toBe(0.01);
    expect(r.brackets[1].rate_pct).toBe(12);
    expect(r.total).toBeCloseTo(2385, 2);
  });

  test('income across all brackets matches hand-computed total', () => {
    expect(ordinaryTaxFromBrackets(200000, MFJ_2025).total).toBeCloseTo(33828, 2);
  });

  test('per-bracket breakdown income_in_band sums to total income', () => {
    const r = ordinaryTaxFromBrackets(200000, MFJ_2025);
    const summed = r.brackets.reduce((s, b) => s + b.income_in_band, 0);
    expect(summed).toBeCloseTo(200000, 2);
  });

  test('empty or missing brackets → zero tax', () => {
    expect(ordinaryTaxFromBrackets(50000, []).total).toBe(0);
    expect(ordinaryTaxFromBrackets(50000, null).total).toBe(0);
  });

  test('negative income treated as zero', () => {
    expect(ordinaryTaxFromBrackets(-1000, MFJ_2025).total).toBe(0);
  });
});
