const { computeWithdrawals } = require('./withdrawalEngine');

describe('withdrawalEngine', () => {
  it('draws conservative order cash then taxable', () => {
    const buckets = { preTaxP1: 10000, preTaxP2: 0, roth: 5000, taxable: 3000, cash: 2000, hsa: 0 };
    const r = computeWithdrawals(4000, buckets, 'conservative');
    expect(r.cashWithdrawals).toBe(2000);
    expect(r.taxableWithdrawals).toBe(2000);
    expect(r.unmetSpending).toBe(0);
    expect(buckets.cash).toBe(0);
    expect(buckets.taxable).toBe(1000);
  });

  it('reports unmet spending when insufficient', () => {
    const buckets = { preTaxP1: 0, preTaxP2: 0, roth: 0, taxable: 0, cash: 100, hsa: 0 };
    const r = computeWithdrawals(5000, buckets, 'conservative');
    expect(r.cashWithdrawals).toBe(100);
    expect(r.unmetSpending).toBe(4900);
  });
});
