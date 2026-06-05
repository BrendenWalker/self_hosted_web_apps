'use strict';

function ordinaryTaxFromBrackets(taxableIncome, brackets) {
  if (!Array.isArray(brackets) || brackets.length === 0) return { total: 0, brackets: [] };
  let remaining = Math.max(0, taxableIncome || 0);
  let total = 0;
  const out = [];
  for (let i = 0; i < brackets.length; i++) {
    const low = brackets[i].lower_bound;
    const high = i + 1 < brackets.length ? brackets[i + 1].lower_bound : Infinity;
    const bandWidth = high === Infinity ? remaining : Math.max(0, high - low);
    const take = Math.min(remaining, bandWidth);
    if (take > 0) {
      const taxAmt = take * brackets[i].rate;
      total += taxAmt;
      out.push({
        rate_pct: Math.round(brackets[i].rate * 1000) / 10,
        income_in_band: Math.round(take * 100) / 100,
        tax: Math.round(taxAmt * 100) / 100,
      });
      remaining -= take;
    }
    if (remaining <= 0) break;
  }
  return { total: Math.round(total * 100) / 100, brackets: out };
}

function taxableSocialSecurity(otherIncome, ssAnnual, filingStatus) {
  if (ssAnnual <= 0) return 0;
  const halfSs = ssAnnual * 0.5;
  const combined = otherIncome + halfSs;
  const fs = filingStatus || 'married_filing_jointly';
  const mfj = fs === 'married_filing_jointly' || fs === 'married';
  const t0 = mfj ? 32000 : 25000;
  const t1 = mfj ? 44000 : 34000;
  const bridge = mfj ? 6000 : 4500;
  if (combined <= t0) return 0;
  if (combined <= t1) {
    return Math.round(Math.min(0.5 * ssAnnual, 0.5 * (combined - t0)) * 100) / 100;
  }
  const cap = 0.85 * ssAnnual;
  const alt = 0.85 * (combined - t1) + bridge;
  return Math.round(Math.min(cap, alt) * 100) / 100;
}

const estimateTaxableSocialSecurityAnnual = taxableSocialSecurity;

module.exports = {
  ordinaryTaxFromBrackets,
  taxableSocialSecurity,
  estimateTaxableSocialSecurityAnnual,
};
