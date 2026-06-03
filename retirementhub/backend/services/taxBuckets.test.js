const { classifyAccounts, balancesByBucketSnapshot } = require('./taxBuckets');

describe('taxBuckets', () => {
  it('classifies account types into buckets', () => {
    const rows = [
      { account_type: 'ira_traditional', balance: 100000, owner_type: 'p1', rmd_owner_type: 'p1' },
      { account_type: 'ira_roth', balance: 50000, owner_type: 'joint' },
      { account_type: 'taxable', balance: 30000, owner_type: 'joint' },
      { account_type: 'checking', balance: 5000, owner_type: 'joint' },
    ];
    const b = classifyAccounts(rows);
    expect(b.preTaxP1).toBe(100000);
    expect(b.roth).toBe(50000);
    expect(b.taxable).toBe(30000);
    expect(b.cash).toBe(5000);
    const snap = balancesByBucketSnapshot(b);
    expect(snap.pre_tax).toBe(100000);
    expect(snap.roth).toBe(50000);
  });
});
