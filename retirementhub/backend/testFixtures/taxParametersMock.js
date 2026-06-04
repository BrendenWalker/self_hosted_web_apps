'use strict';

const seeds = require('../services/taxParametersSeeds');

function taxQueryHandler(sql, params) {
  const s = (sql || '').trim();

  if (s.includes("status='published'") && s.includes('ORDER BY year DESC LIMIT 1')) {
    return { rows: [{ year: 2026 }] };
  }
  if (s.includes('SELECT year, status, inflation_pct, notes FROM tax_year')) {
    return {
      rows: seeds.TAX_YEARS.map((r) => ({
        year: r.year,
        status: r.status,
        inflation_pct: String(r.inflation_pct),
        notes: r.notes,
        has_irs_seed: seeds.hasIrsSeedYear(r.year),
      })),
    };
  }
  if (s.includes('SELECT year FROM tax_year ORDER BY year')) {
    return { rows: seeds.TAX_YEARS.map((r) => ({ year: r.year })) };
  }
  if (s.includes('inflation_pct FROM tax_year WHERE year')) {
    const y = params?.[0];
    const row = seeds.TAX_YEARS.find((r) => r.year === y);
    return { rows: row ? [{ inflation_pct: String(row.inflation_pct) }] : [] };
  }

  if (s.includes('FROM tax_standard_deduction')) {
    const year = params?.[0];
    const fs = params?.[1];
    if (fs != null) {
      const row = seeds.STANDARD_DEDUCTION.find((r) => r.year === year && r.filing_status === fs);
      return {
        rows: row
          ? [{ amount: String(row.amount), age65_add_on: String(row.age65_add_on), source: 'seeded' }]
          : [],
      };
    }
    return {
      rows: seeds.STANDARD_DEDUCTION.filter((r) => r.year === year).map((r) => ({
        filing_status: r.filing_status,
        amount: String(r.amount),
        age65_add_on: String(r.age65_add_on),
        source: 'seeded',
        modified: null,
      })),
    };
  }

  if (s.includes('FROM tax_bracket')) {
    const year = params?.[0];
    const fs = params?.[1];
    if (fs != null) {
      const rows = seeds.BRACKETS.filter((r) => r.year === year && r.filing_status === fs).map((r) => ({
        ordinal: r.ordinal,
        lower_bound: String(r.lower_bound),
        rate: String(r.rate),
        source: 'seeded',
      }));
      return { rows };
    }
    return {
      rows: seeds.BRACKETS.filter((r) => r.year === year).map((r) => ({
        filing_status: r.filing_status,
        ordinal: r.ordinal,
        lower_bound: String(r.lower_bound),
        rate: String(r.rate),
        source: 'seeded',
        modified: null,
      })),
    };
  }

  if (s.includes('FROM tax_contribution_limit')) {
    const year = params?.[0];
    return {
      rows: seeds.CONTRIBUTION_LIMITS.filter((r) => r.year === year).map((r) => ({
        kind: r.kind,
        base_amount: String(r.base_amount),
        catch_up_amount: String(r.catch_up_amount),
        source: 'seeded',
        modified: null,
      })),
    };
  }

  if (s.includes('FROM tax_medicare_part_b')) {
    const year = params?.[0];
    const row = seeds.MEDICARE_PART_B.find((r) => r.year === year);
    if (s.includes('monthly_premium, source, modified')) {
      return {
        rows: row
          ? [{ monthly_premium: String(row.monthly_premium), source: 'seeded', modified: null }]
          : [],
      };
    }
    return { rows: row ? [{ monthly_premium: String(row.monthly_premium), source: 'seeded' }] : [] };
  }

  if (s.includes('INSERT INTO tax_') || s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
    return { rows: [] };
  }
  if (s.includes('UPDATE tax_standard_deduction') && s.includes('RETURNING')) {
    return { rows: [{ source: 'user_edited' }] };
  }

  return null;
}

module.exports = { taxQueryHandler };
