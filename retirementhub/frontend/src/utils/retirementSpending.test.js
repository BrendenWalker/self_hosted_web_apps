import { describe, expect, test } from 'vitest';
import {
  annualFromRetirementSpending,
  describeRetirementSpending,
  retirementSpendingFormFromAnnual,
} from './retirementSpending';

describe('retirementSpending', () => {
  test('converts monthly and yearly to annual', () => {
    expect(annualFromRetirementSpending('5000', 'monthly')).toBe(60000);
    expect(annualFromRetirementSpending('72000', 'yearly')).toBe(72000);
    expect(annualFromRetirementSpending('', 'monthly')).toBeNull();
  });

  test('round-trips from annual', () => {
    expect(retirementSpendingFormFromAnnual(60000, 'monthly')).toEqual({
      amount: '5000',
      period: 'monthly',
    });
    expect(retirementSpendingFormFromAnnual(60000, 'yearly')).toEqual({
      amount: '60000',
      period: 'yearly',
    });
  });

  test('describeRetirementSpending mentions growth', () => {
    expect(describeRetirementSpending(60000, 'monthly', 2.5)).toContain('+2.5%/yr');
  });
});
