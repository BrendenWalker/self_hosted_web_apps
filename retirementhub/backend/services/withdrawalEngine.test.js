const { computeWithdrawals, resolveOrder, DEFAULT_CONSERVATIVE, DEFAULT_TAX_AWARE } = require('./withdrawalEngine');

describe('withdrawalEngine', () => {
  it('draws conservative order cash then taxable then pre_tax', () => {
    const buckets = { preTaxP1: 10000, preTaxP2: 0, roth: 5000, taxable: 3000, cash: 2000, hsa: 0 };
    const r = computeWithdrawals(4000, buckets, 'conservative');
    expect(r.cashWithdrawals).toBe(2000);
    expect(r.taxableWithdrawals).toBe(2000);
    expect(r.unmetSpending).toBe(0);
    expect(buckets.cash).toBe(0);
    expect(buckets.taxable).toBe(1000);
  });

  it('tax_aware uses roth before pre_tax', () => {
    const buckets = { preTaxP1: 10000, preTaxP2: 0, roth: 8000, taxable: 0, cash: 0, hsa: 0 };
    const conservative = computeWithdrawals(5000, { ...buckets }, 'conservative');
    const taxAware = computeWithdrawals(5000, { ...buckets }, 'tax_aware');
    expect(conservative.preTaxWithdrawals).toBe(5000);
    expect(conservative.rothWithdrawals).toBe(0);
    expect(taxAware.rothWithdrawals).toBe(5000);
    expect(taxAware.preTaxWithdrawals).toBe(0);
  });

  it('resolveOrder differs for tax_aware vs conservative', () => {
    expect(resolveOrder('conservative')).toEqual(DEFAULT_CONSERVATIVE);
    expect(resolveOrder('tax_aware')).toEqual(DEFAULT_TAX_AWARE);
    expect(DEFAULT_TAX_AWARE).not.toEqual(DEFAULT_CONSERVATIVE);
  });

  it('uses custom withdrawal order when provided', () => {
    const buckets = { preTaxP1: 10000, preTaxP2: 0, roth: 5000, taxable: 3000, cash: 2000, hsa: 0 };
    const r = computeWithdrawals(4000, buckets, 'custom', ['roth', 'cash']);
    expect(r.rothWithdrawals).toBe(4000);
    expect(r.cashWithdrawals).toBe(0);
  });

  it('draws from hsa last in default order', () => {
    const buckets = { preTaxP1: 0, preTaxP2: 0, roth: 0, taxable: 0, cash: 0, hsa: 3000 };
    const r = computeWithdrawals(1500, buckets, 'conservative');
    expect(r.hsaWithdrawals).toBe(1500);
    expect(buckets.hsa).toBe(1500);
  });
});
