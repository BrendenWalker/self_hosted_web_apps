const { formatMoney } = require('./scenarioExplanationService');

const NOISE_THRESHOLD = 500;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rowField(row, key) {
  if (!row) return 0;
  return num(row[key]);
}

function computeYearlyDeltas(baselineRows, altRows) {
  const baseByYear = new Map((baselineRows || []).map((r) => [r.year, r]));
  const altByYear = new Map((altRows || []).map((r) => [r.year, r]));
  const years = [...new Set([...baseByYear.keys(), ...altByYear.keys()])].sort((a, b) => a - b);

  return years.map((year) => {
    const b = baseByYear.get(year) || {};
    const a = altByYear.get(year) || {};
    const bW = b.withdrawals || {};
    const aW = a.withdrawals || {};
    return {
      year,
      federal_tax_delta: rowField(a, 'federal_tax_total') - rowField(b, 'federal_tax_total'),
      net_worth_delta: rowField(a, 'net_worth') - rowField(b, 'net_worth'),
      rmd_delta: rowField(a, 'rmd') - rowField(b, 'rmd'),
      roth_conversion_delta: rowField(a, 'roth_conversion') - rowField(b, 'roth_conversion'),
      income_ss_delta: rowField(a, 'income_ss_total') - rowField(b, 'income_ss_total'),
      pre_tax_withdrawal_delta: num(aW.preTaxWithdrawals) - num(bW.preTaxWithdrawals),
      taxable_withdrawal_delta: num(aW.taxableWithdrawals) - num(bW.taxableWithdrawals),
      roth_withdrawal_delta: num(aW.rothWithdrawals) - num(bW.rothWithdrawals),
    };
  });
}

function findPeriods(yearlyDeltas, field, minAbs = NOISE_THRESHOLD) {
  const periods = [];
  let start = null;
  let sum = 0;

  const flush = (endYear) => {
    if (start == null) return;
    if (Math.abs(sum) >= minAbs) {
      periods.push({ year_start: start, year_end: endYear, amount_delta: Math.round(sum * 100) / 100 });
    }
    start = null;
    sum = 0;
  };

  for (const row of yearlyDeltas) {
    const delta = num(row[field]);
    if (Math.abs(delta) >= 1) {
      if (start == null) start = row.year;
      sum += delta;
    } else if (start != null) {
      flush(row.year - 1);
    }
  }
  if (start != null && yearlyDeltas.length) {
    flush(yearlyDeltas[yearlyDeltas.length - 1].year);
  }
  return periods;
}

function sumFieldInRange(yearlyDeltas, field, yearStart, yearEnd) {
  return yearlyDeltas
    .filter((r) => r.year >= yearStart && r.year <= yearEnd)
    .reduce((s, r) => s + num(r[field]), 0);
}

function buildPeriodDrivers(baselineRows, altRows, yearlyDeltas) {
  const drivers = [];
  const baseByYear = new Map((baselineRows || []).map((r) => [r.year, r]));
  const altByYear = new Map((altRows || []).map((r) => [r.year, r]));

  const rothPeriods = findPeriods(yearlyDeltas, 'roth_conversion_delta', 100);
  for (const p of rothPeriods) {
    const taxDelta = sumFieldInRange(yearlyDeltas, 'federal_tax_delta', p.year_start, p.year_end);
    if (Math.abs(p.amount_delta) >= 1000 || Math.abs(taxDelta) >= NOISE_THRESHOLD) {
      drivers.push({
        kind: 'roth_conversion',
        label: `Roth conversions ${p.amount_delta > 0 ? 'added' : 'reduced'} ${formatMoney(Math.abs(p.amount_delta))} (${p.year_start}–${p.year_end})${Math.abs(taxDelta) >= NOISE_THRESHOLD ? `; federal tax ${taxDelta > 0 ? '+' : '−'}${formatMoney(Math.abs(taxDelta))} in that window` : ''}`,
        year_start: p.year_start,
        year_end: p.year_end,
        tax_delta: Math.round(taxDelta),
        amount_delta: p.amount_delta,
      });
    }
  }

  const rmdPeriods = findPeriods(yearlyDeltas, 'rmd_delta', 1000);
  for (const p of rmdPeriods) {
    const taxDelta = sumFieldInRange(yearlyDeltas, 'federal_tax_delta', p.year_start, p.year_end);
    if (Math.abs(p.amount_delta) >= 5000) {
      drivers.push({
        kind: 'rmd_change',
        label: `RMDs ${p.amount_delta > 0 ? 'higher' : 'lower'} by ${formatMoney(Math.abs(p.amount_delta))} total (${p.year_start}–${p.year_end})`,
        year_start: p.year_start,
        year_end: p.year_end,
        tax_delta: Math.round(taxDelta),
        amount_delta: p.amount_delta,
      });
    }
  }

  const ssOnset = (rows, person) => {
    for (const r of rows || []) {
      const key = person === 'p1' ? 'income_ss_p1' : 'income_ss_p2';
      if (rowField(r, key) > 0) return r.year;
    }
    return null;
  };
  const bP1 = ssOnset(baselineRows, 'p1');
  const aP1 = ssOnset(altRows, 'p1');
  const bP2 = ssOnset(baselineRows, 'p2');
  const aP2 = ssOnset(altRows, 'p2');
  if (bP1 != null && aP1 != null && bP1 !== aP1) {
    drivers.push({
      kind: 'ss_timing',
      label: `P1 Social Security starts in ${aP1} vs ${bP1} (claim-age timing)`,
      year_start: Math.min(bP1, aP1),
      year_end: Math.max(bP1, aP1),
    });
  }
  if (bP2 != null && aP2 != null && bP2 !== aP2) {
    drivers.push({
      kind: 'ss_timing',
      label: `P2 Social Security starts in ${aP2} vs ${bP2} (claim-age timing)`,
      year_start: Math.min(bP2, aP2),
      year_end: Math.max(bP2, aP2),
    });
  }

  const withdrawPeriods = findPeriods(yearlyDeltas, 'pre_tax_withdrawal_delta', 5000);
  for (const p of withdrawPeriods) {
    const taxableDelta = sumFieldInRange(yearlyDeltas, 'taxable_withdrawal_delta', p.year_start, p.year_end);
    if (Math.abs(p.amount_delta) >= 5000) {
      drivers.push({
        kind: 'withdrawal_mix',
        label: `Pre-tax withdrawals ${p.amount_delta > 0 ? 'higher' : 'lower'} by ${formatMoney(Math.abs(p.amount_delta))} (${p.year_start}–${p.year_end})${Math.abs(taxableDelta) >= NOISE_THRESHOLD ? `; taxable withdrawals ${taxableDelta > 0 ? '+' : '−'}${formatMoney(Math.abs(taxableDelta))}` : ''}`,
        year_start: p.year_start,
        year_end: p.year_end,
        amount_delta: p.amount_delta,
      });
    }
  }

  for (const row of yearlyDeltas) {
    const b = baseByYear.get(row.year);
    const a = altByYear.get(row.year);
    if (b && a && !!b.is_retired !== !!a.is_retired) {
      drivers.push({
        kind: 'retirement_timing',
        label: `Retirement status differs in ${row.year} (wage vs drawdown transition)`,
        year_start: row.year,
        year_end: row.year,
      });
      break;
    }
  }

  return drivers;
}

function scanIrmaaWarnings(altRows, baselineRows) {
  const warnings = [];
  const baseByYear = new Map((baselineRows || []).map((r) => [r.year, r]));
  for (const r of altRows || []) {
    if (r.irmaa_warning && !baseByYear.get(r.year)?.irmaa_warning) {
      warnings.push(`IRMAA threshold may apply in ${r.year} under the alternative scenario.`);
    }
  }
  return warnings;
}

function explainYearlyDiff(baselineRows, altRows) {
  const yearly_deltas = computeYearlyDeltas(baselineRows, altRows);
  const period_drivers = buildPeriodDrivers(baselineRows, altRows, yearly_deltas);
  const irmaa_warnings = scanIrmaaWarnings(altRows, baselineRows);
  return { yearly_deltas, period_drivers, irmaa_warnings };
}

module.exports = {
  computeYearlyDeltas,
  buildPeriodDrivers,
  explainYearlyDiff,
  NOISE_THRESHOLD,
};
