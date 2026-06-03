function herfindahl(weights) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return 1;
  return weights.reduce((h, w) => {
    const p = w / sum;
    return h + p * p;
  }, 0);
}

function computePlanningScores({ byYear, startingBuckets, baselineLifetimeTax }) {
  let lifetimeTax = 0;
  let peakRmd = 0;
  let peakRmdYear = null;
  const last = byYear.length ? byYear[byYear.length - 1] : null;
  const endBuckets = last?.balances_by_bucket;

  for (const row of byYear) {
    lifetimeTax += row.federal_tax_total ?? row.federal_tax_ordinary_estimate ?? 0;
    if ((row.rmd ?? 0) > peakRmd) {
      peakRmd = row.rmd;
      peakRmdYear = row.year;
    }
  }
  lifetimeTax = Math.round(lifetimeTax * 100) / 100;

  const endPreTax = endBuckets?.pre_tax ?? 0;
  const endRoth = endBuckets?.roth ?? 0;
  const endTaxable = endBuckets?.taxable ?? 0;
  const endCash = endBuckets?.cash ?? 0;
  const endHsa = endBuckets?.hsa ?? 0;
  const h = herfindahl([endPreTax, endRoth, endTaxable, endCash, endHsa]);
  const flexibilityScore = Math.round((1 - h) * 100);

  const taxEfficiencyScore =
    baselineLifetimeTax != null && baselineLifetimeTax > 0
      ? Math.round(Math.max(0, Math.min(100, 100 * (1 - lifetimeTax / baselineLifetimeTax))) * 10) / 10
      : null;

  const tradShare = endPreTax / Math.max(1, endPreTax + endRoth + endTaxable + endCash + endHsa);
  let rmdRisk = 'Low';
  if (tradShare > 0.6 || peakRmd > 50000) rmdRisk = 'High';
  else if (tradShare > 0.4 || peakRmd > 25000) rmdRisk = 'Moderate';

  const insights = [];
  if (peakRmdYear != null && peakRmd > 0) {
    insights.push(`Peak projected RMD of $${Math.round(peakRmd).toLocaleString()} in ${peakRmdYear}.`);
  }
  if (baselineLifetimeTax != null && lifetimeTax < baselineLifetimeTax * 0.95) {
    insights.push(
      `This scenario reduces projected lifetime federal tax by about $${Math.round(baselineLifetimeTax - lifetimeTax).toLocaleString()} vs baseline.`
    );
  }

  return {
    lifetime_total_tax: lifetimeTax,
    tax_efficiency_score: taxEfficiencyScore,
    rmd_risk: rmdRisk,
    flexibility_score: flexibilityScore,
    peak_rmd: peakRmd,
    peak_rmd_year: peakRmdYear,
    insights,
  };
}

const {
  ssMonthlyAtClaimAge,
  lifetimeBenefitsEstimate,
  breakevenAgeVs62,
} = require('../lib/socialSecurity');

function computeSsComparison(p1Monthly, p2Monthly, p1ClaimAge, p2ClaimAge, p1BirthYear, p2BirthYear, colaFactor) {
  const endAge = 90;
  const p1Monthly62 = p1Monthly ? ssMonthlyAtClaimAge(p1Monthly, 62) : null;
  const p2Monthly62 = p2Monthly ? ssMonthlyAtClaimAge(p2Monthly, 62) : null;

  const p1AtClaim = p1Monthly && p1ClaimAge ? ssMonthlyAtClaimAge(p1Monthly, p1ClaimAge) : null;
  const p2AtClaim = p2Monthly && p2ClaimAge ? ssMonthlyAtClaimAge(p2Monthly, p2ClaimAge) : null;

  return {
    p1: {
      claim_age: p1ClaimAge,
      annual_benefit: p1AtClaim != null ? Math.round(p1AtClaim * 12 * 100) / 100 : null,
      lifetime_benefits:
        p1AtClaim != null && p1ClaimAge != null && p1BirthYear != null
          ? lifetimeBenefitsEstimate(p1AtClaim, p1ClaimAge, endAge, colaFactor)
          : null,
      breakeven_age_vs_62:
        p1AtClaim != null && p1ClaimAge != null && p1Monthly62 != null
          ? breakevenAgeVs62(p1AtClaim, p1ClaimAge, p1Monthly62)
          : null,
    },
    p2: {
      claim_age: p2ClaimAge,
      annual_benefit: p2AtClaim != null ? Math.round(p2AtClaim * 12 * 100) / 100 : null,
      lifetime_benefits:
        p2AtClaim != null && p2ClaimAge != null && p2BirthYear != null
          ? lifetimeBenefitsEstimate(p2AtClaim, p2ClaimAge, endAge, colaFactor)
          : null,
      breakeven_age_vs_62:
        p2AtClaim != null && p2ClaimAge != null && p2Monthly62 != null
          ? breakevenAgeVs62(p2AtClaim, p2ClaimAge, p2Monthly62)
          : null,
    },
  };
}

module.exports = { computePlanningScores, computeSsComparison, herfindahl };
