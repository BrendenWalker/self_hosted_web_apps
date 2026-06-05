import { describe, expect, test } from 'vitest';
import { chartClickToYear } from './chartClick';

describe('chartClickToYear', () => {
  test('returns numeric year from activeLabel', () => {
    expect(chartClickToYear({ activeLabel: '2030' })).toBe(2030);
    expect(chartClickToYear({ activeLabel: 2031 })).toBe(2031);
  });

  test('returns null when activeLabel missing', () => {
    expect(chartClickToYear(undefined)).toBeNull();
    expect(chartClickToYear({})).toBeNull();
  });
});
