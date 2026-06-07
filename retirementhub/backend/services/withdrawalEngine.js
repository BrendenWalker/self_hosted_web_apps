const DEFAULT_CONSERVATIVE = ['cash', 'taxable', 'pre_tax', 'roth', 'hsa'];
/** Roth before pre-tax to reduce taxable withdrawals and future RMD pressure. */
const DEFAULT_TAX_AWARE = ['cash', 'taxable', 'roth', 'pre_tax', 'hsa'];

function resolveOrder(strategy, customOrder) {
  if (strategy === 'custom' && Array.isArray(customOrder) && customOrder.length > 0) {
    return customOrder;
  }
  if (strategy === 'tax_aware') return DEFAULT_TAX_AWARE;
  return DEFAULT_CONSERVATIVE;
}

function bucketAvailable(buckets, key) {
  switch (key) {
    case 'cash':
      return buckets.cash;
    case 'taxable':
      return buckets.taxable;
    case 'pre_tax':
      return buckets.preTaxP1 + buckets.preTaxP2;
    case 'roth':
      return buckets.roth;
    case 'hsa':
      return buckets.hsa;
    default:
      return 0;
  }
}

function drawFromBucket(buckets, key, amount) {
  let taken = 0;
  if (amount <= 0) {
    return { taken: 0, preTaxP1: 0, preTaxP2: 0 };
  }
  switch (key) {
    case 'cash': {
      taken = Math.min(amount, buckets.cash);
      buckets.cash -= taken;
      break;
    }
    case 'taxable': {
      taken = Math.min(amount, buckets.taxable);
      buckets.taxable -= taken;
      break;
    }
    case 'pre_tax': {
      const total = buckets.preTaxP1 + buckets.preTaxP2;
      taken = Math.min(amount, total);
      if (total > 0) {
        const p1Share = buckets.preTaxP1 / total;
        buckets.preTaxP1 -= taken * p1Share;
        buckets.preTaxP2 -= taken * (1 - p1Share);
      }
      break;
    }
    case 'roth': {
      taken = Math.min(amount, buckets.roth);
      buckets.roth -= taken;
      break;
    }
    case 'hsa': {
      taken = Math.min(amount, buckets.hsa);
      buckets.hsa -= taken;
      break;
    }
    default:
      break;
  }
  return { taken };
}

function computeWithdrawals(spendingGap, buckets, strategy, customOrder) {
  const order = resolveOrder(strategy, customOrder);
  let remaining = Math.max(0, spendingGap);
  const result = {
    cashWithdrawals: 0,
    taxableWithdrawals: 0,
    preTaxWithdrawals: 0,
    rothWithdrawals: 0,
    hsaWithdrawals: 0,
    unmetSpending: 0,
  };

  for (const key of order) {
    if (remaining <= 0) break;
    const avail = bucketAvailable(buckets, key);
    if (avail <= 0) continue;
    const draw = Math.min(remaining, avail);
    drawFromBucket(buckets, key, draw);
    remaining -= draw;
    switch (key) {
      case 'cash':
        result.cashWithdrawals += draw;
        break;
      case 'taxable':
        result.taxableWithdrawals += draw;
        break;
      case 'pre_tax':
        result.preTaxWithdrawals += draw;
        break;
      case 'roth':
        result.rothWithdrawals += draw;
        break;
      case 'hsa':
        result.hsaWithdrawals += draw;
        break;
      default:
        break;
    }
  }

  result.unmetSpending = Math.round(remaining * 100) / 100;
  result.cashWithdrawals = Math.round(result.cashWithdrawals * 100) / 100;
  result.taxableWithdrawals = Math.round(result.taxableWithdrawals * 100) / 100;
  result.preTaxWithdrawals = Math.round(result.preTaxWithdrawals * 100) / 100;
  result.rothWithdrawals = Math.round(result.rothWithdrawals * 100) / 100;
  result.hsaWithdrawals = Math.round(result.hsaWithdrawals * 100) / 100;
  return result;
}

/** Sell liquidatable asset balances to cover remaining retirement spending gap. */
function liquidateAssetsForSpending(assetParts, unmetSpending) {
  let remaining = Math.max(0, unmetSpending);
  let assetLiquidations = 0;
  if (!assetParts?.length || remaining <= 0) {
    return { assetLiquidations: 0, unmetSpending: Math.round(remaining * 100) / 100 };
  }
  for (const ap of assetParts) {
    if (!ap.liquidateInRetirement || remaining <= 0) continue;
    const taken = Math.min(remaining, Math.max(0, ap.balance));
    ap.balance -= taken;
    remaining -= taken;
    assetLiquidations += taken;
  }
  return {
    assetLiquidations: Math.round(assetLiquidations * 100) / 100,
    unmetSpending: Math.round(remaining * 100) / 100,
  };
}

module.exports = { computeWithdrawals, liquidateAssetsForSpending, resolveOrder, DEFAULT_CONSERVATIVE, DEFAULT_TAX_AWARE };
