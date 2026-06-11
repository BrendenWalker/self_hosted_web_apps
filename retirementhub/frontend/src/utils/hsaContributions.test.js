import { describe, it, expect } from 'vitest';
import { capHsaHousehold, buildLimitKeys, isMarriedFilingJointly } from './hsaContributions';

describe('hsaContributions', () => {
  it('identifies MFJ filing status', () => {
    expect(isMarriedFilingJointly('married_filing_jointly')).toBe(true);
    expect(isMarriedFilingJointly('single')).toBe(false);
  });

  it('caps household HSA at family limit for MFJ', () => {
    expect(
      capHsaHousehold(5000, 5000, 5150, 5150, 8300, 'married_filing_jointly')
    ).toEqual({ p1: 4150, p2: 4150 });
  });

  it('allows one MFJ spouse to contribute up to the family HSA limit', () => {
    expect(
      capHsaHousehold(8500, 0, 4400, 4400, 8750, 'married_filing_jointly')
    ).toEqual({ p1: 8500, p2: 0 });
    expect(capHsaHousehold(8500, 0, 4400, 4400, 8750, 'single')).toEqual({ p1: 4400, p2: 0 });
  });

  it('buildLimitKeys uses one family HSA row for MFJ', () => {
    const mfjKeys = buildLimitKeys('married_filing_jointly');
    expect(mfjKeys.filter((k) => k.key.startsWith('hsa_'))).toHaveLength(1);
    expect(mfjKeys.some((k) => k.key === 'hsa_effective_limit')).toBe(true);
    expect(mfjKeys.some((k) => k.key === 'hsa_family_limit')).toBe(false);
    expect(mfjKeys.some((k) => k.key === 'hsa_individual_limit')).toBe(false);
  });

  it('buildLimitKeys uses individual HSA row for non-MFJ', () => {
    const keys = buildLimitKeys('single');
    expect(keys.some((k) => k.key === 'hsa_individual_limit')).toBe(true);
    expect(keys.some((k) => k.key === 'hsa_family_limit')).toBe(false);
  });
});
