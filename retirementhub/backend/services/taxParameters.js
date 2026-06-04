'use strict';

async function getLatestPublishedYear(pool) {
  const r = await pool.query(
    "SELECT year FROM tax_year WHERE status='published' ORDER BY year DESC LIMIT 1"
  );
  return r.rows[0]?.year ?? null;
}

async function getInflationPct(pool, year) {
  const r = await pool.query('SELECT inflation_pct FROM tax_year WHERE year = $1', [year]);
  return r.rows[0] ? parseFloat(r.rows[0].inflation_pct) : 2.0;
}

function inflationFactor(baseYear, targetYear, pct) {
  const delta = Math.max(0, targetYear - baseYear);
  return Math.pow(1 + pct / 100, delta);
}

function normalizeFilingStatus(filingStatus) {
  const fs = filingStatus || 'married_filing_jointly';
  if (fs === 'married' || fs === 'married_filing_jointly') return 'married_filing_jointly';
  if (fs === 'head_of_household') return 'head_of_household';
  if (fs === 'married_filing_separately') return 'married_filing_separately';
  return 'single';
}

async function getStandardDeduction(pool, year, filingStatus, p1Age, p2Age) {
  const fs = normalizeFilingStatus(filingStatus);
  let row = (
    await pool.query(
      'SELECT amount, age65_add_on FROM tax_standard_deduction WHERE year = $1 AND filing_status = $2',
      [year, fs]
    )
  ).rows[0];

  let amount;
  let addOn;
  if (row) {
    amount = parseFloat(row.amount);
    addOn = parseFloat(row.age65_add_on);
  } else {
    const base = await getLatestPublishedYear(pool);
    if (base == null) throw new Error('No published tax year available');
    const baseRow = (
      await pool.query(
        'SELECT amount, age65_add_on FROM tax_standard_deduction WHERE year = $1 AND filing_status = $2',
        [base, fs]
      )
    ).rows[0];
    if (!baseRow) throw new Error(`No standard deduction for ${fs} in base year ${base}`);
    const pct = await getInflationPct(pool, base);
    const f = inflationFactor(base, year, pct);
    amount = parseFloat(baseRow.amount) * f;
    addOn = parseFloat(baseRow.age65_add_on) * f;
  }

  let total = amount;
  if (fs === 'married_filing_jointly') {
    if (p1Age != null && p1Age >= 65) total += addOn;
    if (p2Age != null && p2Age >= 65) total += addOn;
  } else if (p1Age != null && p1Age >= 65) {
    total += addOn;
  }
  return Math.round(total * 100) / 100;
}

async function getFederalBrackets(pool, year, filingStatus) {
  const fs = normalizeFilingStatus(filingStatus);
  const direct = await pool.query(
    'SELECT ordinal, lower_bound, rate FROM tax_bracket WHERE year=$1 AND filing_status=$2 ORDER BY ordinal',
    [year, fs]
  );
  if (direct.rows.length) {
    return direct.rows.map((r) => ({
      ordinal: r.ordinal,
      lower_bound: parseFloat(r.lower_bound),
      rate: parseFloat(r.rate),
    }));
  }
  const base = await getLatestPublishedYear(pool);
  if (base == null) throw new Error('No published tax year available');
  const baseRows = await pool.query(
    'SELECT ordinal, lower_bound, rate FROM tax_bracket WHERE year=$1 AND filing_status=$2 ORDER BY ordinal',
    [base, fs]
  );
  const pct = await getInflationPct(pool, base);
  const f = inflationFactor(base, year, pct);
  return baseRows.rows.map((r) => ({
    ordinal: r.ordinal,
    lower_bound: Math.round(parseFloat(r.lower_bound) * f * 100) / 100,
    rate: parseFloat(r.rate),
  }));
}

async function getContributionLimits(pool, year) {
  const direct = await pool.query(
    'SELECT kind, base_amount, catch_up_amount FROM tax_contribution_limit WHERE year=$1',
    [year]
  );
  if (direct.rows.length) {
    return Object.fromEntries(
      direct.rows.map((r) => [
        r.kind,
        { base: parseFloat(r.base_amount), catch_up: parseFloat(r.catch_up_amount) },
      ])
    );
  }
  const base = await getLatestPublishedYear(pool);
  const baseRows = await pool.query(
    'SELECT kind, base_amount, catch_up_amount FROM tax_contribution_limit WHERE year=$1',
    [base]
  );
  const pct = await getInflationPct(pool, base);
  const f = inflationFactor(base, year, pct);
  return Object.fromEntries(
    baseRows.rows.map((r) => [
      r.kind,
      {
        base: Math.round(parseFloat(r.base_amount) * f),
        catch_up: Math.round(parseFloat(r.catch_up_amount) * f),
      },
    ])
  );
}

async function getMedicarePartB(pool, year) {
  const direct = (
    await pool.query('SELECT monthly_premium FROM tax_medicare_part_b WHERE year=$1', [year])
  ).rows[0];
  if (direct) return parseFloat(direct.monthly_premium);
  const base = await getLatestPublishedYear(pool);
  const baseRow = (
    await pool.query('SELECT monthly_premium FROM tax_medicare_part_b WHERE year=$1', [base])
  ).rows[0];
  if (!baseRow) throw new Error('No Medicare Part B baseline');
  return Math.round(parseFloat(baseRow.monthly_premium) * Math.pow(1.05, year - base) * 100) / 100;
}

/** Build { thresholds, rates } for taxEngine bracket math. */
async function getFederalBracketConfig(pool, year, filingStatus) {
  const rows = await getFederalBrackets(pool, year, filingStatus);
  if (!rows.length) {
    throw new Error(`No federal brackets for ${filingStatus} year ${year}`);
  }
  const thresholds = rows.map((r) => r.lower_bound);
  thresholds.push(Infinity);
  const rates = rows.map((r) => r.rate);
  return { thresholds, rates };
}

async function createTaxYear(pool, { year, cloneFromYear, status, inflation_pct, notes }) {
  const targetYear = parseInt(year, 10);
  if (!Number.isInteger(targetYear) || targetYear < 2020 || targetYear > 2100) {
    throw Object.assign(new Error('Year must be between 2020 and 2100'), { statusCode: 400 });
  }

  const exists = await pool.query('SELECT 1 FROM tax_year WHERE year = $1', [targetYear]);
  if (exists.rows.length) {
    throw Object.assign(new Error(`Year ${targetYear} already exists`), { statusCode: 409 });
  }

  let sourceYear =
    cloneFromYear != null && cloneFromYear !== '' ? parseInt(cloneFromYear, 10) : null;
  if (!Number.isInteger(sourceYear)) {
    const latest = await pool.query('SELECT year FROM tax_year ORDER BY year DESC LIMIT 1');
    if (!latest.rows.length) {
      throw Object.assign(new Error('No existing year to clone from'), { statusCode: 400 });
    }
    sourceYear = parseInt(latest.rows[0].year, 10);
  }

  const srcMeta = await pool.query(
    'SELECT year, status, inflation_pct, notes FROM tax_year WHERE year = $1',
    [sourceYear]
  );
  if (!srcMeta.rows.length) {
    throw Object.assign(new Error(`Clone source year ${sourceYear} not found`), { statusCode: 404 });
  }

  const srcRow = srcMeta.rows[0];
  const st = status === 'published' || status === 'projected' ? status : 'projected';
  const infl =
    inflation_pct != null && inflation_pct !== ''
      ? parseFloat(inflation_pct)
      : parseFloat(srcRow.inflation_pct) || 2.0;
  const yearNotes =
    notes != null && String(notes).trim() !== ''
      ? String(notes).trim()
      : `Cloned from ${sourceYear}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO tax_year (year, status, inflation_pct, notes) VALUES ($1, $2, $3, $4)',
      [targetYear, st, infl, yearNotes]
    );
    await client.query(
      `INSERT INTO tax_standard_deduction (year, filing_status, amount, age65_add_on, source)
       SELECT $1, filing_status, amount, age65_add_on, 'seeded'
       FROM tax_standard_deduction WHERE year = $2`,
      [targetYear, sourceYear]
    );
    await client.query(
      `INSERT INTO tax_bracket (year, filing_status, ordinal, lower_bound, rate, source)
       SELECT $1, filing_status, ordinal, lower_bound, rate, 'seeded'
       FROM tax_bracket WHERE year = $2`,
      [targetYear, sourceYear]
    );
    await client.query(
      `INSERT INTO tax_contribution_limit (year, kind, base_amount, catch_up_amount, source)
       SELECT $1, kind, base_amount, catch_up_amount, 'seeded'
       FROM tax_contribution_limit WHERE year = $2`,
      [targetYear, sourceYear]
    );
    await client.query(
      `INSERT INTO tax_medicare_part_b (year, monthly_premium, source)
       SELECT $1, monthly_premium, 'seeded'
       FROM tax_medicare_part_b WHERE year = $2`,
      [targetYear, sourceYear]
    );
    await client.query('COMMIT');
    return {
      year: targetYear,
      clone_from_year: sourceYear,
      status: st,
      inflation_pct: infl,
      notes: yearNotes,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  getStandardDeduction,
  getFederalBrackets,
  getFederalBracketConfig,
  getContributionLimits,
  getMedicarePartB,
  getLatestPublishedYear,
  createTaxYear,
  inflationFactor,
  normalizeFilingStatus,
};
