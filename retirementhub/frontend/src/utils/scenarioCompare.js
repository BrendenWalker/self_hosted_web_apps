/** Pick Baseline/default scenario for compare anchor. */
export function pickBaselineScenario(summaryRows, ids = []) {
  if (!summaryRows?.length) return null;
  return (
    summaryRows.find((r) => r.scenario_name === 'Baseline') ||
    summaryRows.find((r) => r.is_default) ||
    summaryRows.find((r) => r.scenario_id === ids[0]) ||
    summaryRows[0]
  );
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

/** Highlights across all compared scenarios (not just the first pair). */
export function pickScenarioHighlights(rows) {
  if (!rows?.length) return null;
  return {
    lowest_lifetime_tax: pickBest(rows, 'lifetime_total_tax', true),
    highest_ending_net_worth: pickBest(rows, 'ending_net_worth', false),
    lowest_peak_rmd: pickBest(rows, 'peak_rmd', true),
  };
}

/** Merge unique driver labels from multiple baseline-vs-alt explanations. */
export function mergeComparisonDrivers(comparisons = []) {
  const structured = [];
  const seen = new Set();
  for (const comparison of comparisons) {
    const list = comparison.structured_drivers?.length
      ? comparison.structured_drivers
      : (comparison.drivers || []).map((label) => ({ label }));
    for (const driver of list) {
      const label = driver?.label;
      if (!label || seen.has(label)) continue;
      seen.add(label);
      structured.push(driver);
    }
  }
  return structured;
}
