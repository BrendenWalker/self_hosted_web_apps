function formatMoney(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function pickBest(rows, field, preferLower = false) {
  const valid = rows.filter((r) => r[field] != null && Number.isFinite(r[field]));
  if (!valid.length) return null;
  return valid.reduce((best, row) => {
    if (!best) return row;
    if (preferLower) return row[field] < best[field] ? row : best;
    return row[field] > best[field] ? row : best;
  }, null);
}

function explainScenarioComparison(baseline, alternative) {
  if (!baseline || !alternative) {
    return { summary: 'Insufficient data to compare scenarios.', drivers: [], warnings: [] };
  }

  const taxDelta = (alternative.lifetime_total_tax ?? 0) - (baseline.lifetime_total_tax ?? 0);
  const worthDelta = (alternative.ending_net_worth ?? 0) - (baseline.ending_net_worth ?? 0);
  const rothDelta = (alternative.total_roth_conversions ?? 0) - (baseline.total_roth_conversions ?? 0);

  const drivers = [];
  const warnings = [];

  if (Math.abs(taxDelta) >= 1000) {
    drivers.push(
      taxDelta < 0
        ? `${alternative.scenario_name} reduces lifetime federal tax by ${formatMoney(Math.abs(taxDelta))} vs ${baseline.scenario_name}.`
        : `${alternative.scenario_name} increases lifetime federal tax by ${formatMoney(taxDelta)} vs ${baseline.scenario_name}.`
    );
  }

  if (Math.abs(worthDelta) >= 1000) {
    drivers.push(
      worthDelta > 0
        ? `Ending net worth is ${formatMoney(worthDelta)} higher under ${alternative.scenario_name}.`
        : `Ending net worth is ${formatMoney(Math.abs(worthDelta))} lower under ${alternative.scenario_name}.`
    );
  }

  if (Math.abs(rothDelta) >= 1000) {
    drivers.push(
      rothDelta > 0
        ? `Roth conversions total ${formatMoney(rothDelta)} more over the horizon.`
        : `Roth conversions total ${formatMoney(Math.abs(rothDelta))} less over the horizon.`
    );
  }

  if (
    alternative.withdrawal_strategy &&
    baseline.withdrawal_strategy &&
    alternative.withdrawal_strategy !== baseline.withdrawal_strategy
  ) {
    drivers.push(
      `Withdrawal strategy differs (${baseline.withdrawal_strategy} vs ${alternative.withdrawal_strategy}).`
    );
  }

  if (
    alternative.p1_ss_claim_age != null &&
    baseline.p1_ss_claim_age != null &&
    alternative.p1_ss_claim_age !== baseline.p1_ss_claim_age
  ) {
    drivers.push(
      `P1 SS claim age ${alternative.p1_ss_claim_age} vs ${baseline.p1_ss_claim_age} changes benefit timing and taxable income.`
    );
  }

  if ((alternative.peak_rmd ?? 0) > (baseline.peak_rmd ?? 0) * 1.1 && alternative.peak_rmd > 25000) {
    warnings.push(
      `Peak RMD rises to ${formatMoney(alternative.peak_rmd)} in ${alternative.peak_rmd_year ?? 'later years'}.`
    );
  }

  const summaryParts = [];
  if (Math.abs(taxDelta) >= 1000) {
    summaryParts.push(
      taxDelta < 0
        ? `${alternative.scenario_name} lowers lifetime taxes by ${formatMoney(Math.abs(taxDelta))}`
        : `${alternative.scenario_name} raises lifetime taxes by ${formatMoney(taxDelta)}`
    );
  }
  if (Math.abs(worthDelta) >= 1000) {
    summaryParts.push(
      worthDelta > 0
        ? `ending net worth is ${formatMoney(worthDelta)} higher`
        : `ending net worth is ${formatMoney(Math.abs(worthDelta))} lower`
    );
  }
  if (Math.abs(rothDelta) >= 1000 && rothDelta > 0) {
    summaryParts.push(`driven partly by ${formatMoney(rothDelta)} in Roth conversions`);
  }

  const summary =
    summaryParts.length > 0
      ? `${summaryParts[0]}${summaryParts.length > 1 ? `; ${summaryParts.slice(1).join('; ')}` : ''}.`
      : `${alternative.scenario_name} produces similar lifetime tax and ending net worth to ${baseline.scenario_name}.`;

  return {
    summary,
    drivers,
    warnings,
    highlights: {
      lowest_lifetime_tax: pickBest([baseline, alternative], 'lifetime_total_tax', true),
      highest_ending_net_worth: pickBest([baseline, alternative], 'ending_net_worth', false),
      lowest_peak_rmd: pickBest([baseline, alternative], 'peak_rmd', true),
    },
  };
}

module.exports = { explainScenarioComparison, formatMoney, pickBest };
