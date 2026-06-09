import { describe, expect, test } from 'vitest';
import { mergeComparisonDrivers, pickBaselineScenario, pickScenarioHighlights } from './scenarioCompare';

describe('pickBaselineScenario', () => {
  test('prefers Baseline by name', () => {
    const rows = [
      { scenario_id: 2, scenario_name: 'Early' },
      { scenario_id: 1, scenario_name: 'Baseline' },
    ];
    expect(pickBaselineScenario(rows, [2, 1])?.scenario_id).toBe(1);
  });
});

describe('pickScenarioHighlights', () => {
  test('picks best values across all rows', () => {
    const highlights = pickScenarioHighlights([
      { scenario_name: 'A', lifetime_total_tax: 100000, ending_net_worth: 2000000, peak_rmd: 50000 },
      { scenario_name: 'B', lifetime_total_tax: 80000, ending_net_worth: 2200000, peak_rmd: 40000 },
      { scenario_name: 'C', lifetime_total_tax: 90000, ending_net_worth: 2100000, peak_rmd: 60000 },
    ]);
    expect(highlights.lowest_lifetime_tax.scenario_name).toBe('B');
    expect(highlights.highest_ending_net_worth.scenario_name).toBe('B');
    expect(highlights.lowest_peak_rmd.scenario_name).toBe('B');
  });
});

describe('mergeComparisonDrivers', () => {
  test('deduplicates driver labels', () => {
    const drivers = mergeComparisonDrivers([
      { structured_drivers: [{ label: 'Retire later lowers tax.' }] },
      { structured_drivers: [{ label: 'Retire later lowers tax.' }, { label: 'Higher RMDs.' }] },
    ]);
    expect(drivers).toHaveLength(2);
  });
});
