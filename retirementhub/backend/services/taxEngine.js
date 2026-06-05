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

module.exports = { ordinaryTaxFromBrackets };
