import { describe, it, expect } from 'vitest';
import {
  sortMeasurementsForRecipeEditor,
  formatRecipeMeasurementOptionLabel,
  isSpecialRecipeMeasurement,
} from './recipeMeasurements';

describe('sortMeasurementsForRecipeEditor', () => {
  it('places Each and Shopping Unit before others', () => {
    const sorted = sortMeasurementsForRecipeEditor([
      { id: 1, name: 'cup' },
      { id: 2, name: 'Each' },
      { id: 3, name: 'Shopping Unit' },
      { id: 4, name: 'tbsp' },
    ]);
    expect(sorted.map((m) => m.name)).toEqual(['Each', 'Shopping Unit', 'cup', 'tbsp']);
  });
});

describe('formatRecipeMeasurementOptionLabel', () => {
  it('prefixes special names with "* "', () => {
    expect(formatRecipeMeasurementOptionLabel({ name: 'Each' })).toBe('* Each');
    expect(formatRecipeMeasurementOptionLabel({ name: 'Shopping Unit' })).toBe('* Shopping Unit');
    expect(formatRecipeMeasurementOptionLabel({ name: 'cup' })).toBe('cup');
  });
});

describe('isSpecialRecipeMeasurement', () => {
  it('matches case-insensitively', () => {
    expect(isSpecialRecipeMeasurement({ name: 'each' })).toBe(true);
    expect(isSpecialRecipeMeasurement({ name: 'SHOPPING UNIT' })).toBe(true);
  });
});
