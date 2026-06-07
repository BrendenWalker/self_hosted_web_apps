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
    preTax401kP1: 0,
    preTax401kP2: 0,
    preTaxIraP1: 0,
    preTaxIraP2: 0,
    roth: 0,
    roth401k: 0,
    rothIra: 0,
    taxable: 0,
    cash: 0,
    hsa: 0,
    assets: [],
  };
}

function addPreTaxBalance(buckets, balance, ownerType, to401k) {
  const ot =
    ownerType != null && String(ownerType).trim() !== '' ? String(ownerType).trim() : 'joint';
  const add401k = to401k ? 'preTax401k' : 'preTaxIra';
  if (ot === 'p1') {
    buckets.preTaxP1 += balance;
    buckets[`${add401k}P1`] += balance;
  } else if (ot === 'p2') {
    buckets.preTaxP2 += balance;
    buckets[`${add401k}P2`] += balance;
  } else {
    buckets.preTaxP1 += balance * 0.5;
    buckets.preTaxP2 += balance * 0.5;
    buckets[`${add401k}P1`] += balance * 0.5;
    buckets[`${add401k}P2`] += balance * 0.5;
  }
}

function assetAnnualChangePctToFactor(pct) {
  const p = pct != null && pct !== '' ? parseFloat(pct) : 0;
  if (!Number.isFinite(p)) return 1;
  const clamped = Math.max(-100, Math.min(100, p));
  return 1 - clamped / 100;
}

function classifyAccounts(balanceRows, taxProfilesByAccountId = {}) {
  const buckets = emptyBuckets();

  for (const row of balanceRows) {
    const bal = parseFloat(row.balance) || 0;
    let type = row.account_type;
    if (type === '401k') type = '401k_traditional';
    const accountId = row.account_id;

    if (BUCKET_TYPES.asset.has(type)) {
      const depPct = row.expected_depreciation_pct != null ? parseFloat(row.expected_depreciation_pct) : 0;
      buckets.assets.push({
        balance: bal,
        depFactor: assetAnnualChangePctToFactor(Number.isFinite(depPct) ? depPct : 0),
        liquidateInRetirement:
          row.liquidate_in_retirement === true ||
          row.liquidate_in_retirement === 't' ||
          row.liquidate_in_retirement === 1,
        account_id: accountId,
      });
    } else if (RMD_ACCOUNT_TYPES.has(type)) {
      const ot =
        row.rmd_owner_type != null && String(row.rmd_owner_type).trim() !== ''
          ? String(row.rmd_owner_type).trim()
          : row.owner_type || 'joint';
      const is401k = type === '401k_traditional' || type === '401k';
      addPreTaxBalance(buckets, bal, ot, is401k);
    } else if (type === '401k_roth') {
      buckets.roth += bal;
      buckets.roth401k += bal;
    } else if (BUCKET_TYPES.roth.has(type)) {
      buckets.roth += bal;
      buckets.rothIra += bal;
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

/** Savings projection categories: 401(k), HSA, Traditional IRA, Roth IRA, Taxable (incl. cash). */
function balancesBySavingsCategorySnapshot(b) {
  return {
    '401k': Math.round((b.preTax401kP1 + b.preTax401kP2 + b.roth401k) * 100) / 100,
    hsa: Math.round(b.hsa * 100) / 100,
    ira_traditional: Math.round((b.preTaxIraP1 + b.preTaxIraP2) * 100) / 100,
    ira_roth: Math.round(b.rothIra * 100) / 100,
    taxable: Math.round((b.taxable + b.cash) * 100) / 100,
  };
}

function scaleSplitPair(buckets, keyA, keyB, prevTotal, nextTotal) {
  if (prevTotal <= 0) {
    if (nextTotal > 0 && buckets[keyA] + buckets[keyB] <= 0) {
      buckets[keyA] = nextTotal * 0.5;
      buckets[keyB] = nextTotal * 0.5;
    }
    return;
  }
  if (nextTotal === prevTotal) return;
  const ratio = nextTotal / prevTotal;
  buckets[keyA] *= ratio;
  buckets[keyB] *= ratio;
}

/** Keep sub-balances aligned when aggregate pre-tax, roth, or cash/taxable totals change. */
function syncBucketDetails(buckets, prev, next) {
  scaleSplitPair(buckets, 'preTax401kP1', 'preTaxIraP1', prev.preTaxP1, next.preTaxP1);
  scaleSplitPair(buckets, 'preTax401kP2', 'preTaxIraP2', prev.preTaxP2, next.preTaxP2);
  scaleSplitPair(buckets, 'roth401k', 'rothIra', prev.roth, next.roth);
  const prevTaxableTotal = prev.taxable + prev.cash;
  const nextTaxableTotal = next.taxable + next.cash;
  if (prevTaxableTotal > 0 && nextTaxableTotal !== prevTaxableTotal) {
    const ratio = nextTaxableTotal / prevTaxableTotal;
    buckets.taxable *= ratio;
    buckets.cash *= ratio;
  }
  buckets.preTaxP1 = next.preTaxP1;
  buckets.preTaxP2 = next.preTaxP2;
  buckets.roth = next.roth;
  buckets.taxable = next.taxable;
  buckets.cash = next.cash;
  buckets.hsa = next.hsa;
}

function snapshotBucketAggregates(buckets, tradP1, tradP2) {
  return {
    preTaxP1: tradP1,
    preTaxP2: tradP2,
    roth: buckets.roth,
    taxable: buckets.taxable,
    cash: buckets.cash,
    hsa: buckets.hsa,
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
  assetAnnualChangePctToFactor,
  classifyAccounts,
  totalPreTax,
  totalFinancial,
  balancesByBucketSnapshot,
  balancesBySavingsCategorySnapshot,
  syncBucketDetails,
  snapshotBucketAggregates,
  applyGrowthToBuckets,
  estimateTaxableDividendsAndGains,
};
