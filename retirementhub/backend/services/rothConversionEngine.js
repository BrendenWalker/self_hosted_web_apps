const { bracketTopForRate } = require('./taxEngine');

function computeRothConversion({
  plan,
  year,
  tradBalance,
  baseOrdinaryIncome,
  filingStatus,
  age1,
  age2,
}) {
  if (!plan || tradBalance <= 0) return 0;
  const strategy = plan.strategy_type || 'none';
  if (strategy === 'none') return 0;

  if (strategy === 'fixed') {
    const fixed = parseFloat(plan.annual_fixed_amount) || 0;
    return Math.round(Math.min(fixed, tradBalance) * 100) / 100;
  }

  if (strategy === 'fill_bracket') {
    const target = plan.target_tax_bracket;
    if (target == null) return 0;
    const top = bracketTopForRate(target, filingStatus, year);
    if (top == null) return Math.round(tradBalance * 100) / 100;
    const headroom = Math.max(0, top - baseOrdinaryIncome);
    return Math.round(Math.min(headroom, tradBalance) * 100) / 100;
  }

  if (strategy === 'fill_income') {
    const maxInc = parseFloat(plan.max_taxable_income);
    if (!Number.isFinite(maxInc) || maxInc <= 0) return 0;
    const headroom = Math.max(0, maxInc - baseOrdinaryIncome);
    return Math.round(Math.min(headroom, tradBalance) * 100) / 100;
  }

  if (strategy === 'irmaa_aware') {
    const maxIrmaa = parseFloat(plan.max_irmaa_income);
    if (!Number.isFinite(maxIrmaa) || maxIrmaa <= 0) return 0;
    const headroom = Math.max(0, maxIrmaa - baseOrdinaryIncome);
    return Math.round(Math.min(headroom, tradBalance) * 100) / 100;
  }

  return 0;
}

function applyRothConversion(buckets, amount) {
  if (amount <= 0) return;
  const total = buckets.preTaxP1 + buckets.preTaxP2;
  if (total <= 0) return;
  const p1Share = buckets.preTaxP1 / total;
  buckets.preTaxP1 = Math.max(0, buckets.preTaxP1 - amount * p1Share);
  buckets.preTaxP2 = Math.max(0, buckets.preTaxP2 - amount * (1 - p1Share));
  buckets.roth += amount;
}

module.exports = { computeRothConversion, applyRothConversion };
