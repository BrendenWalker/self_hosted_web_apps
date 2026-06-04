'use strict';

/** Seeded defaults for POST /api/tax-parameters/:year/reset (mirrors migration 016). */
const TAX_YEARS = [
  { year: 2024, status: 'published', inflation_pct: 2.0, notes: 'IRS Rev. Proc. 2023-34' },
  { year: 2025, status: 'published', inflation_pct: 2.0, notes: 'IRS Rev. Proc. 2024-40' },
  { year: 2026, status: 'published', inflation_pct: 2.0, notes: 'IRS Rev. Proc. 2025-32 / TCJA post-sunset values' },
];

const STANDARD_DEDUCTION = [
  { year: 2024, filing_status: 'married_filing_jointly', amount: 29200, age65_add_on: 1550 },
  { year: 2025, filing_status: 'married_filing_jointly', amount: 30000, age65_add_on: 1550 },
  { year: 2026, filing_status: 'married_filing_jointly', amount: 31000, age65_add_on: 1550 },
  { year: 2024, filing_status: 'single', amount: 14600, age65_add_on: 1950 },
  { year: 2025, filing_status: 'single', amount: 15000, age65_add_on: 1950 },
  { year: 2026, filing_status: 'single', amount: 15750, age65_add_on: 1950 },
  { year: 2024, filing_status: 'head_of_household', amount: 21900, age65_add_on: 1950 },
  { year: 2025, filing_status: 'head_of_household', amount: 22500, age65_add_on: 1950 },
  { year: 2026, filing_status: 'head_of_household', amount: 23400, age65_add_on: 1950 },
];

const BRACKETS = [
  // 2024 MFJ
  { year: 2024, filing_status: 'married_filing_jointly', ordinal: 0, lower_bound: 0, rate: 0.1 },
  { year: 2024, filing_status: 'married_filing_jointly', ordinal: 1, lower_bound: 23200, rate: 0.12 },
  { year: 2024, filing_status: 'married_filing_jointly', ordinal: 2, lower_bound: 94300, rate: 0.22 },
  { year: 2024, filing_status: 'married_filing_jointly', ordinal: 3, lower_bound: 201050, rate: 0.24 },
  { year: 2024, filing_status: 'married_filing_jointly', ordinal: 4, lower_bound: 383900, rate: 0.32 },
  { year: 2024, filing_status: 'married_filing_jointly', ordinal: 5, lower_bound: 487450, rate: 0.35 },
  { year: 2024, filing_status: 'married_filing_jointly', ordinal: 6, lower_bound: 731200, rate: 0.37 },
  // 2025 MFJ
  { year: 2025, filing_status: 'married_filing_jointly', ordinal: 0, lower_bound: 0, rate: 0.1 },
  { year: 2025, filing_status: 'married_filing_jointly', ordinal: 1, lower_bound: 23850, rate: 0.12 },
  { year: 2025, filing_status: 'married_filing_jointly', ordinal: 2, lower_bound: 96950, rate: 0.22 },
  { year: 2025, filing_status: 'married_filing_jointly', ordinal: 3, lower_bound: 206700, rate: 0.24 },
  { year: 2025, filing_status: 'married_filing_jointly', ordinal: 4, lower_bound: 394600, rate: 0.32 },
  { year: 2025, filing_status: 'married_filing_jointly', ordinal: 5, lower_bound: 501050, rate: 0.35 },
  { year: 2025, filing_status: 'married_filing_jointly', ordinal: 6, lower_bound: 751600, rate: 0.37 },
  // 2026 MFJ
  { year: 2026, filing_status: 'married_filing_jointly', ordinal: 0, lower_bound: 0, rate: 0.1 },
  { year: 2026, filing_status: 'married_filing_jointly', ordinal: 1, lower_bound: 24327, rate: 0.12 },
  { year: 2026, filing_status: 'married_filing_jointly', ordinal: 2, lower_bound: 98889, rate: 0.22 },
  { year: 2026, filing_status: 'married_filing_jointly', ordinal: 3, lower_bound: 210834, rate: 0.24 },
  { year: 2026, filing_status: 'married_filing_jointly', ordinal: 4, lower_bound: 402492, rate: 0.32 },
  { year: 2026, filing_status: 'married_filing_jointly', ordinal: 5, lower_bound: 511071, rate: 0.35 },
  { year: 2026, filing_status: 'married_filing_jointly', ordinal: 6, lower_bound: 766632, rate: 0.37 },
  // 2024 single
  { year: 2024, filing_status: 'single', ordinal: 0, lower_bound: 0, rate: 0.1 },
  { year: 2024, filing_status: 'single', ordinal: 1, lower_bound: 11600, rate: 0.12 },
  { year: 2024, filing_status: 'single', ordinal: 2, lower_bound: 47150, rate: 0.22 },
  { year: 2024, filing_status: 'single', ordinal: 3, lower_bound: 100525, rate: 0.24 },
  { year: 2024, filing_status: 'single', ordinal: 4, lower_bound: 191950, rate: 0.32 },
  { year: 2024, filing_status: 'single', ordinal: 5, lower_bound: 243725, rate: 0.35 },
  { year: 2024, filing_status: 'single', ordinal: 6, lower_bound: 609350, rate: 0.37 },
  // 2025 single
  { year: 2025, filing_status: 'single', ordinal: 0, lower_bound: 0, rate: 0.1 },
  { year: 2025, filing_status: 'single', ordinal: 1, lower_bound: 11925, rate: 0.12 },
  { year: 2025, filing_status: 'single', ordinal: 2, lower_bound: 48475, rate: 0.22 },
  { year: 2025, filing_status: 'single', ordinal: 3, lower_bound: 103350, rate: 0.24 },
  { year: 2025, filing_status: 'single', ordinal: 4, lower_bound: 197300, rate: 0.32 },
  { year: 2025, filing_status: 'single', ordinal: 5, lower_bound: 250525, rate: 0.35 },
  { year: 2025, filing_status: 'single', ordinal: 6, lower_bound: 626350, rate: 0.37 },
  // 2026 single
  { year: 2026, filing_status: 'single', ordinal: 0, lower_bound: 0, rate: 0.1 },
  { year: 2026, filing_status: 'single', ordinal: 1, lower_bound: 12164, rate: 0.12 },
  { year: 2026, filing_status: 'single', ordinal: 2, lower_bound: 49445, rate: 0.22 },
  { year: 2026, filing_status: 'single', ordinal: 3, lower_bound: 105417, rate: 0.24 },
  { year: 2026, filing_status: 'single', ordinal: 4, lower_bound: 201246, rate: 0.32 },
  { year: 2026, filing_status: 'single', ordinal: 5, lower_bound: 255535, rate: 0.35 },
  { year: 2026, filing_status: 'single', ordinal: 6, lower_bound: 638877, rate: 0.37 },
  // 2025 head of household (projection support)
  { year: 2025, filing_status: 'head_of_household', ordinal: 0, lower_bound: 0, rate: 0.1 },
  { year: 2025, filing_status: 'head_of_household', ordinal: 1, lower_bound: 17000, rate: 0.12 },
  { year: 2025, filing_status: 'head_of_household', ordinal: 2, lower_bound: 64850, rate: 0.22 },
  { year: 2025, filing_status: 'head_of_household', ordinal: 3, lower_bound: 103350, rate: 0.24 },
  { year: 2025, filing_status: 'head_of_household', ordinal: 4, lower_bound: 197300, rate: 0.32 },
  { year: 2025, filing_status: 'head_of_household', ordinal: 5, lower_bound: 256100, rate: 0.35 },
  { year: 2025, filing_status: 'head_of_household', ordinal: 6, lower_bound: 626350, rate: 0.37 },
];

const CONTRIBUTION_LIMITS = [
  { year: 2024, kind: 'ira', base_amount: 7000, catch_up_amount: 1000 },
  { year: 2024, kind: '401k_elective', base_amount: 23000, catch_up_amount: 7500 },
  { year: 2024, kind: 'hsa_individual', base_amount: 4150, catch_up_amount: 1000 },
  { year: 2024, kind: 'hsa_family', base_amount: 8300, catch_up_amount: 1000 },
  { year: 2025, kind: 'ira', base_amount: 7000, catch_up_amount: 1000 },
  { year: 2025, kind: '401k_elective', base_amount: 23500, catch_up_amount: 7500 },
  { year: 2025, kind: 'hsa_individual', base_amount: 4300, catch_up_amount: 1000 },
  { year: 2025, kind: 'hsa_family', base_amount: 8550, catch_up_amount: 1000 },
  { year: 2026, kind: 'ira', base_amount: 7500, catch_up_amount: 1100 },
  { year: 2026, kind: '401k_elective', base_amount: 24500, catch_up_amount: 8000 },
  { year: 2026, kind: 'hsa_individual', base_amount: 4400, catch_up_amount: 1000 },
  { year: 2026, kind: 'hsa_family', base_amount: 8750, catch_up_amount: 1000 },
];

const MEDICARE_PART_B = [
  { year: 2024, monthly_premium: 174.7 },
  { year: 2025, monthly_premium: 185.0 },
  { year: 2026, monthly_premium: 193.0 },
];

function rowsForYear(year) {
  return {
    taxYears: TAX_YEARS.filter((r) => r.year === year),
    standardDeduction: STANDARD_DEDUCTION.filter((r) => r.year === year),
    brackets: BRACKETS.filter((r) => r.year === year),
    contributionLimits: CONTRIBUTION_LIMITS.filter((r) => r.year === year),
    medicarePartB: MEDICARE_PART_B.filter((r) => r.year === year),
  };
}

function hasIrsSeedYear(year) {
  return TAX_YEARS.some((r) => r.year === year);
}

module.exports = {
  TAX_YEARS,
  STANDARD_DEDUCTION,
  BRACKETS,
  CONTRIBUTION_LIMITS,
  MEDICARE_PART_B,
  rowsForYear,
  hasIrsSeedYear,
};
