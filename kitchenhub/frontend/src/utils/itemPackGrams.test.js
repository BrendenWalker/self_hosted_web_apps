import { describe, it, expect } from 'vitest';
import { validateCountPerPackOneGrams } from './itemPackGrams';

describe('validateCountPerPackOneGrams', () => {
  it('allows any values when count per pack is not 1', () => {
    expect(validateCountPerPackOneGrams({ count_per_pack: '2', ingredient_unit_grams: '10', shopping_measure_grams: '99' }).ok).toBe(true);
  });

  it('allows both empty when count per pack is 1', () => {
    expect(validateCountPerPackOneGrams({ count_per_pack: '1', ingredient_unit_grams: '', shopping_measure_grams: '' }).ok).toBe(true);
  });

  it('requires both set when count per pack is 1 and one field has a value', () => {
    const r = validateCountPerPackOneGrams({
      count_per_pack: '1',
      ingredient_unit_grams: '100',
      shopping_measure_grams: '',
    });
    expect(r.ok).toBe(false);
    expect(r.message).toBeTruthy();
  });

  it('rejects mismatch when count per pack is 1', () => {
    const r = validateCountPerPackOneGrams({
      count_per_pack: '1',
      ingredient_unit_grams: '100',
      shopping_measure_grams: '50',
    });
    expect(r.ok).toBe(false);
  });

  it('accepts equal values when count per pack is 1', () => {
    expect(
      validateCountPerPackOneGrams({
        count_per_pack: '1',
        ingredient_unit_grams: '1360.5',
        shopping_measure_grams: '1360.5',
      }).ok
    ).toBe(true);
  });
});
