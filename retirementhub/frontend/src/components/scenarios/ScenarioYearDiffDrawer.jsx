import React, { useEffect } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';

function DeltaRow({ label, delta }) {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) < 1) return null;
  const sign = delta > 0 ? '+' : '−';
  return (
    <div className="year-drawer-row">
      <span className="year-drawer-label">{label}</span>
      <span className="year-drawer-value">{sign}{formatCurrency(Math.abs(delta))}</span>
    </div>
  );
}

function ScenarioColumn({ name, row }) {
  if (!row) return null;
  return (
    <section className="year-drawer-section">
      <h3>{name}</h3>
      <div className="year-drawer-row">
        <span className="year-drawer-label">Federal tax</span>
        <span className="year-drawer-value">{formatCurrency(row.federal_tax_total)}</span>
      </div>
      <div className="year-drawer-row">
        <span className="year-drawer-label">Net worth</span>
        <span className="year-drawer-value">{formatCurrency(row.net_worth)}</span>
      </div>
      <div className="year-drawer-row">
        <span className="year-drawer-label">RMD</span>
        <span className="year-drawer-value">{formatCurrency(row.rmd)}</span>
      </div>
      <div className="year-drawer-row">
        <span className="year-drawer-label">Roth conversion</span>
        <span className="year-drawer-value">{formatCurrency(row.roth_conversion)}</span>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   year: number|null,
 *   baseline?: { name: string, row: Record<string, unknown>|null },
 *   scenarios?: { name: string, row: Record<string, unknown>|null, isBaseline?: boolean }[],
 *   onClose?: () => void,
 * }} props
 */
export default function ScenarioYearDiffDrawer({ year, baseline, scenarios = [], onClose }) {
  useEffect(() => {
    if (year == null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [year, onClose]);

  const entries = scenarios.length
    ? scenarios
    : baseline?.row
      ? [{ name: baseline.name, row: baseline.row, isBaseline: true }]
      : [];

  if (year == null || !entries.some((entry) => entry.row)) return null;

  const baselineEntry =
    entries.find((entry) => entry.isBaseline) ||
    (baseline?.row ? { name: baseline.name, row: baseline.row, isBaseline: true } : entries[0]);
  const baselineRow = baselineEntry?.row;
  const nonBaseline = entries.filter((entry) => entry.row && entry !== baselineEntry);

  return (
    <>
      <button type="button" className="year-drawer-backdrop" aria-label="Close year diff" onClick={onClose} />
      <aside className="year-drawer scenario-year-diff-drawer" role="dialog" aria-labelledby="year-diff-title">
        <header className="year-drawer-header">
          <h2 id="year-diff-title">Year {year} comparison</h2>
          <button type="button" className="btn btn-secondary year-drawer-close" onClick={onClose}>
            Close
          </button>
        </header>

        {baselineRow && nonBaseline.length > 0 && (
          <section className="year-drawer-section">
            <h3>Deltas vs {baselineEntry.name}</h3>
            {nonBaseline.map((entry) => (
              <div key={entry.name} style={{ marginBottom: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>{entry.name}</h4>
                <DeltaRow
                  label="Federal tax"
                  delta={(entry.row.federal_tax_total ?? 0) - (baselineRow.federal_tax_total ?? 0)}
                />
                <DeltaRow
                  label="Net worth"
                  delta={(entry.row.net_worth ?? 0) - (baselineRow.net_worth ?? 0)}
                />
                <DeltaRow label="RMD" delta={(entry.row.rmd ?? 0) - (baselineRow.rmd ?? 0)} />
                <DeltaRow
                  label="Roth conversion"
                  delta={(entry.row.roth_conversion ?? 0) - (baselineRow.roth_conversion ?? 0)}
                />
              </div>
            ))}
          </section>
        )}

        <div className="scenario-year-diff-columns">
          {entries.map((entry) => (
            <ScenarioColumn key={entry.name} name={entry.name} row={entry.row} />
          ))}
        </div>
      </aside>
    </>
  );
}
