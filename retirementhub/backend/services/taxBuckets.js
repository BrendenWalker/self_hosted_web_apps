const { RMD_ACCOUNT_TYPES } = require('../lib/rmd');

const BUCKET_TYPES = {
  pre_tax: new Set(['ira_traditional', '401k_traditional']),
  roth: new Set(['ira_roth', '401k_roth']),
  taxable: new Set(['taxable']),
  cash: new Set(['checking', 'savings']),
  hsa: new Set(['hsa']),
  asset: new Set(['asset']),
};

function emptyBuckets() {
  return {
    preTaxP1: 0,
    preTaxP2: 0,
    roth: 0,
    taxable: 0,
    cash: 0,
    hsa: 0,
    assets: [],
  };
}

function classifyAccounts(balanceRows, taxProfilesByAccountId = {}) {
  const buckets = emptyBuckets();

  function depPctToFactor(pct) {
    const p = pct != null && pct !== '' ? parseFloat(pct) : 0;
    const n = Number.isFinite(p) && p > 0 ? Math.min(100, p) : 0;
    return 1 - n / 100;
  }

  for (const row of balanceRows) {
    const bal = parseFloat(row.balance) || 0;
    const type = row.account_type;
    const accountId = row.account_id;

    if (BUCKET_TYPES.asset.has(type)) {
      const depPct = row.expected_depreciation_pct != null ? parseFloat(row.expected_depreciation_pct) : 0;
      buckets.assets.push({
        balance: bal,
        depFactor: depPctToFactor(Number.isFinite(depPct) ? depPct : 0),
        account_id: accountId,
      });
    } else if (RMD_ACCOUNT_TYPES.has(type)) {
      const ot =
        row.rmd_owner_type != null && String(row.rmd_owner_type).trim() !== ''
          ? String(row.rmd_owner_type).trim()
          : row.owner_type || 'joint';
      if (ot === 'p1') buckets.preTaxP1 += bal;
      else if (ot === 'p2') buckets.preTaxP2 += bal;
      else {
        buckets.preTaxP1 += bal * 0.5;
        buckets.preTaxP2 += bal * 0.5;
      }
    } else if (BUCKET_TYPES.roth.has(type)) {
      buckets.roth += bal;
    } else if (BUCKET_TYPES.taxable.has(type)) {
      buckets.taxable += bal;
      if (accountId != null && taxProfilesByAccountId[accountId]) {
        buckets.taxableProfiles = buckets.taxableProfiles || [];
        buckets.taxableProfiles.push({
          balance: bal,
          ...taxProfilesByAccountId[accountId],
        });
      }
    } else if (BUCKET_TYPES.cash.has(type)) {
      buckets.cash += bal;
    } else if (BUCKET_TYPES.hsa.has(type)) {
      buckets.hsa += bal;
    }
  }

  return buckets;
}

function totalPreTax(b) {
  return b.preTaxP1 + b.preTaxP2;
}

function totalFinancial(b) {
  return totalPreTax(b) + b.roth + b.taxable + b.cash + b.hsa;
}

function balancesByBucketSnapshot(b) {
  return {
    pre_tax: Math.round(totalPreTax(b) * 100) / 100,
    roth: Math.round(b.roth * 100) / 100,
    taxable: Math.round(b.taxable * 100) / 100,
    cash: Math.round(b.cash * 100) / 100,
    hsa: Math.round(b.hsa * 100) / 100,
  };
}

function applyGrowthToBuckets(buckets, growthFactor, savingsAmount, tradP1, tradP2) {
  let invTotal = tradP1 + tradP2 + buckets.roth + buckets.taxable + buckets.cash + buckets.hsa;
  invTotal = invTotal * growthFactor + savingsAmount;
  const tradAfter = tradP1 + tradP2;
  const other = buckets.roth + buckets.taxable + buckets.cash + buckets.hsa;
  const denom = tradAfter + other;
  if (invTotal <= 0) {
    return { preTaxP1: 0, preTaxP2: 0, roth: 0, taxable: 0, cash: 0, hsa: 0 };
  }
  if (denom <= 0) {
    return { preTaxP1: 0, preTaxP2: 0, roth: invTotal, taxable: 0, cash: 0, hsa: 0 };
  }
  const ratioTrad = tradAfter / denom;
  const newTrad = invTotal * ratioTrad;
  const p1Share = tradAfter > 0 ? tradP1 / tradAfter : 0.5;
  const newP1 = newTrad * p1Share;
  const newP2 = newTrad * (1 - p1Share);
  const newOther = invTotal * (1 - ratioTrad);
  const otherDenom = other > 0 ? other : 1;
  return {
    preTaxP1: newP1,
    preTaxP2: newP2,
    roth: (buckets.roth / otherDenom) * newOther,
    taxable: (buckets.taxable / otherDenom) * newOther,
    cash: (buckets.cash / otherDenom) * newOther,
    hsa: (buckets.hsa / otherDenom) * newOther,
  };
}

function estimateTaxableDividendsAndGains(buckets, taxableWithdrawal) {
  let qualifiedDividends = 0;
  let longTermCapGains = 0;
  if (buckets.taxableProfiles && buckets.taxableProfiles.length > 0) {
    for (const p of buckets.taxableProfiles) {
      const bal = p.balance || 0;
      const divYield = parseFloat(p.dividend_yield) || 0;
      const qPct = (parseFloat(p.qualified_dividend_percent) ?? 100) / 100;
      qualifiedDividends += bal * divYield * qPct;
      const gainPct = (parseFloat(p.unrealized_gain_percent) || 0) / 100;
      if (taxableWithdrawal > 0 && bal > 0) {
        const share = Math.min(1, taxableWithdrawal / bal);
        longTermCapGains += taxableWithdrawal * share * gainPct;
      }
    }
  } else if (taxableWithdrawal > 0 && buckets.taxable > 0) {
    longTermCapGains += taxableWithdrawal * 0.3;
  }
  return {
    qualifiedDividends: Math.round(qualifiedDividends * 100) / 100,
    longTermCapGains: Math.round(longTermCapGains * 100) / 100,
  };
}

module.exports = {
  BUCKET_TYPES,
  emptyBuckets,
  classifyAccounts,
  totalPreTax,
  totalFinancial,
  balancesByBucketSnapshot,
  applyGrowthToBuckets,
  estimateTaxableDividendsAndGains,
};
