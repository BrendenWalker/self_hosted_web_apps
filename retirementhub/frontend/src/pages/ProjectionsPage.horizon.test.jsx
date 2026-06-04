import { latestPublishedYearFromRows } from './ProjectionsPage';

describe('latestPublishedYearFromRows', () => {
  test('returns max year_used where inflation is not applied', () => {
    const rows = [
      {
        tax_param_provenance: {
          standard_deduction: { year_used: 2026, inflation_applied: false },
          brackets: { year_used: 2025, inflation_applied: false },
          medicare_part_b: { year_used: 2026, inflation_applied: true },
        },
      },
    ];
    expect(latestPublishedYearFromRows(rows)).toBe(2026);
  });

  test('returns null when no provenance', () => {
    expect(latestPublishedYearFromRows([])).toBeNull();
  });
});
