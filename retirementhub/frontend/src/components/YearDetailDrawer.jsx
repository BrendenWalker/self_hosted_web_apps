import React, { useEffect } from 'react';
import PrecisionBadge from './PrecisionBadge';
import { formatCurrency } from '../utils/formatCurrency';

function DetailRow({ label, value, provenance }) {
  return (
    <div className="year-drawer-row">
      <span className="year-drawer-label">{label}</span>
      <span className="year-drawer-value">
        {typeof value === 'string' ? value : formatCurrency(value)}
        {provenance && (
          <PrecisionBadge
            source={provenance.source}
            yearUsed={provenance.year_used}
            inflationApplied={provenance.inflation_applied}
            modified={provenance.modified}
          />
        )}
      </span>
    </div>
  );
}

function spendingBreakdown(row) {
  const src = row?.spending_sources || {};
  return [
    { label: 'Social Security', value: row?.income_ss_total ?? src.social_security },
    { label: 'RMD', value: row?.rmd },
    { label: 'Wages / bonus', value: (row?.income_wages ?? 0) + (row?.income_bonus ?? 0) },
    { label: 'From savings (draw)', value: row?.income_from_savings_draw },
    { label: 'Traditional / pre-tax withdrawals', value: src.traditional_ira },
    { label: 'Taxable withdrawals', value: src.taxable },
    { label: 'Roth withdrawals', value: src.roth },
    { label: 'Cash withdrawals', value: src.cash },
  ].filter((x) => x.value != null && x.value > 0);
}

export default function YearDetailDrawer({ year, row, household, onClose }) {
  useEffect(() => {
    if (year == null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [year, onClose]);

  if (year == null || row == null) return null;

  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  const buckets = row.balances_by_bucket || {};
  const warnings = [];
  if (row.irmaa_warning) warnings.push('IRMAA: Medicare premiums may increase at this income level.');
  if (row.ss_earnings_test_warning_p1) warnings.push(`${p1Name}: Social Security may be reduced by earnings test.`);
  if (row.ss_earnings_test_warning_p2) warnings.push(`${p2Name}: Social Security may be reduced by earnings test.`);
  if ((row.retirement_funding_shortfall ?? 0) > 0) {
    warnings.push(`Funding shortfall: ${formatCurrency(row.retirement_funding_shortfall)} not covered by income/withdrawals.`);
  }

  const spendRows = spendingBreakdown(row);

  return (
    <>
      <button type="button" className="year-drawer-backdrop" aria-label="Close year detail" onClick={onClose} />
      <aside className="year-drawer" role="dialog" aria-labelledby="year-drawer-title">
        <header className="year-drawer-header">
          <h2 id="year-drawer-title">Year {year}</h2>
          <button type="button" className="btn btn-secondary year-drawer-close" onClick={onClose}>
            Close
          </button>
        </header>

        <section className="year-drawer-section">
          <h3>Income</h3>
          <DetailRow label={`${p1Name} wages`} value={row.income_wage_p1} />
          <DetailRow label={`${p2Name} wages`} value={row.income_wage_p2} />
          <DetailRow label="Bonus" value={row.income_bonus} />
          <DetailRow label={`SS ${p1Name} (gross)`} value={row.income_ss_p1} />
          <DetailRow label={`SS ${p2Name} (gross)`} value={row.income_ss_p2} />
          <DetailRow label="Taxable Social Security (est.)" value={row.taxable_ss_estimate} />
          <DetailRow label="RMD (total)" value={row.rmd} />
          <DetailRow label="From savings (draw)" value={row.income_from_savings_draw} />
          <DetailRow label="Roth conversion" value={row.roth_conversion} />
          <DetailRow label="Total income" value={row.income} />
        </section>

        <section className="year-drawer-section">
          <h3>Deductions &amp; taxable income</h3>
          <DetailRow
            label="Standard deduction (est.)"
            value={row.standard_deduction_estimate}
            provenance={row.tax_param_provenance?.standard_deduction}
          />
          <DetailRow
            label="Ordinary income (before deduction)"
            value={row.taxable_income_before_deduction ?? row.taxable_income_estimate}
          />
          <DetailRow label="Taxable income (after deduction)" value={row.taxable_income_after_standard_deduction} />
        </section>

        <section className="year-drawer-section">
          <h3>Federal tax</h3>
          <DetailRow
            label="Federal tax (total est.)"
            value={row.federal_tax_total ?? row.federal_tax_ordinary_estimate}
            provenance={row.tax_param_provenance?.brackets}
          />
          <DetailRow label="Effective rate" value={row.federal_effective_rate_pct != null ? `${row.federal_effective_rate_pct}%` : '—'} />
          {(row.federal_tax_brackets || []).length > 0 && (
            <table className="year-drawer-bracket-table">
              <thead>
                <tr>
                  <th>Rate</th>
                  <th className="num">Income in band</th>
                  <th className="num">Tax</th>
                </tr>
              </thead>
              <tbody>
                {row.federal_tax_brackets
                  .filter((b) => (b.tax ?? 0) > 0.005)
                  .map((b, i) => (
                    <tr key={i}>
                      <td>{b.rate_pct}%</td>
                      <td className="num">{formatCurrency(b.income_in_band)}</td>
                      <td className="num">{formatCurrency(b.tax)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="year-drawer-section">
          <h3>Spending</h3>
          <DetailRow label="Expenses" value={row.expenses} />
          {spendRows.length === 0 ? (
            <p className="year-drawer-muted">No spending-source breakdown for this year.</p>
          ) : (
            spendRows.map((s) => <DetailRow key={s.label} label={s.label} value={s.value} />)
          )}
        </section>

        <section className="year-drawer-section">
          <h3>Ending balances</h3>
          <DetailRow label="Net worth" value={row.net_worth} />
          <DetailRow label="Savings (financial)" value={row.financial_balance} />
          <DetailRow label="Hard assets" value={row.hard_asset_balance} />
          <DetailRow label="Traditional (pre-tax)" value={buckets.pre_tax} />
          <DetailRow label="Roth" value={buckets.roth} />
          <DetailRow label="Taxable" value={buckets.taxable} />
          <DetailRow label="Cash" value={buckets.cash} />
          <DetailRow label="HSA" value={buckets.hsa} />
        </section>

        {warnings.length > 0 && (
          <section className="year-drawer-section year-drawer-warnings">
            <h3>Notes &amp; warnings</h3>
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </>
  );
}
