import { describe, it, expect } from 'vitest';
import {
  inStoreShoppingCountDisplay,
  inStoreTotalMeasureLabel,
  inStoreTotalGramsLabel,
  formatShoppingUnitsDisplay,
  gramsToDisplayUnits,
  itemDisplayName,
} from './shoppingQuantity';

describe('inStoreShoppingCountDisplay', () => {
  it('rounds up shopping units to a whole number', () => {
    const smg = 283.495; // ~10 oz in grams; exact value not critical
    const grams = 2.25 * smg;
    expect(inStoreShoppingCountDisplay(String(grams), smg)).toBe('3');
  });

  it('rounds up raw grams when no shopping measure', () => {
    expect(inStoreShoppingCountDisplay('500.2', null)).toBe('501');
    expect(inStoreShoppingCountDisplay(100, '')).toBe('100');
  });
});

describe('inStoreTotalGramsLabel', () => {
  it('shows exact gram string from API without rounding', () => {
    expect(inStoreTotalGramsLabel('1360.778')).toBe('1360.778 g');
    expect(inStoreTotalGramsLabel('48')).toBe('48 g');
  });

  it('returns empty for invalid or non-positive', () => {
    expect(inStoreTotalGramsLabel('')).toBe('');
    expect(inStoreTotalGramsLabel('0')).toBe('');
    expect(inStoreTotalGramsLabel('-1')).toBe('');
  });
});

describe('inStoreTotalMeasureLabel', () => {
  it('computes ceil(units) × amount in shopping_measure (10 ounces example)', () => {
    const smg = 283.495;
    const grams = 2.25 * smg;
    expect(
      inStoreTotalMeasureLabel(String(grams), smg, '10 ounces')
    ).toBe('30 ounces');
  });

  it('returns empty when shopping_measure has no leading number', () => {
    expect(inStoreTotalMeasureLabel('500', 100, 'each')).toBe('');
  });

  it('returns empty without shopping_measure_grams', () => {
    expect(inStoreTotalMeasureLabel('500', null, '10 oz')).toBe('');
  });
});

describe('formatShoppingUnitsDisplay (unchanged for list editor)', () => {
  it('still shows fractional units', () => {
    expect(formatShoppingUnitsDisplay(2.25)).toBe('2.25');
  });
});

describe('gramsToDisplayUnits', () => {
  it('divides by shopping measure grams', () => {
    expect(gramsToDisplayUnits(567, 283.5)).toBeCloseTo(2, 5);
  });
});

describe('itemDisplayName', () => {
  it('formats Name (details) - shopping measure', () => {
    expect(
      itemDisplayName({
        name: 'Milk',
        details: '2%',
        shopping_measure: '1 gallon',
      })
    ).toBe('Milk (2%) - 1 gallon');
  });

  it('omits empty details and measure', () => {
    expect(itemDisplayName({ name: 'Salt' })).toBe('Salt');
    expect(itemDisplayName({ name: 'Salt', shopping_measure: '  ' })).toBe('Salt');
  });

  it('shows name with measure when no details', () => {
    expect(itemDisplayName({ name: 'Eggs', shopping_measure: 'dozen' })).toBe('Eggs - dozen');
  });

  it('does not repeat shopping measure when same as details', () => {
    expect(
      itemDisplayName({
        name: 'Olive oil',
        details: '48 oz bottle',
        shopping_measure: '48 oz bottle',
      })
    ).toBe('Olive oil (48 oz bottle)');
  });
});
