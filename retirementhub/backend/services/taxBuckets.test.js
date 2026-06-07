const {
  assetAnnualChangePctToFactor,
  classifyAccounts,
  balancesByBucketSnapshot,
  balancesBySavingsCategorySnapshot,
} = require('./taxBuckets');

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
    expect(b.preTaxIraP1).toBe(100000);
    expect(b.roth).toBe(50000);
    expect(b.rothIra).toBe(50000);
    expect(b.taxable).toBe(30000);
    expect(b.cash).toBe(5000);
    const snap = balancesByBucketSnapshot(b);
    expect(snap.pre_tax).toBe(100000);
    expect(snap.roth).toBe(50000);
  });

  it('maps legacy 401k type to pre-tax bucket', () => {
    const b = classifyAccounts([
      { account_type: '401k', balance: 250000, owner_type: 'p1', rmd_owner_type: 'p1' },
    ]);
    expect(b.preTaxP1).toBe(250000);
    expect(b.preTax401kP1).toBe(250000);
  });

  it('builds savings category snapshot', () => {
    const b = classifyAccounts([
      { account_type: '401k_traditional', balance: 200000, owner_type: 'p1', rmd_owner_type: 'p1' },
      { account_type: '401k_roth', balance: 50000, owner_type: 'p1' },
      { account_type: 'ira_traditional', balance: 80000, owner_type: 'p2', rmd_owner_type: 'p2' },
      { account_type: 'ira_roth', balance: 40000, owner_type: 'joint' },
      { account_type: 'hsa', balance: 15000, owner_type: 'p1' },
      { account_type: 'taxable', balance: 25000, owner_type: 'joint' },
      { account_type: 'checking', balance: 5000, owner_type: 'joint' },
    ]);
    expect(balancesBySavingsCategorySnapshot(b)).toEqual({
      '401k': 250000,
      hsa: 15000,
      ira_traditional: 80000,
      ira_roth: 40000,
      taxable: 30000,
    });
  });

  it('applies depreciation and appreciation factors to asset accounts', () => {
    expect(assetAnnualChangePctToFactor(10)).toBeCloseTo(0.9);
    expect(assetAnnualChangePctToFactor(-5)).toBeCloseTo(1.05);
    expect(assetAnnualChangePctToFactor(0)).toBe(1);

    const depreciating = classifyAccounts([
      { account_type: 'asset', balance: 100000, expected_depreciation_pct: 10 },
    ]);
    expect(depreciating.assets[0].depFactor).toBeCloseTo(0.9);

    const appreciating = classifyAccounts([
      { account_type: 'asset', balance: 200000, expected_depreciation_pct: -3 },
    ]);
    expect(appreciating.assets[0].depFactor).toBeCloseTo(1.03);
  });
});
