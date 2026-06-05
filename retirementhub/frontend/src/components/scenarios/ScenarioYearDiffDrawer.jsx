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

export default function ScenarioYearDiffDrawer({ year, baselineRow, altRow, baselineName, altName, onClose }) {
  useEffect(() => {
    if (year == null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [year, onClose]);

  if (year == null || !baselineRow || !altRow) return null;

  const taxDelta = (altRow.federal_tax_total ?? 0) - (baselineRow.federal_tax_total ?? 0);
  const nwDelta = (altRow.net_worth ?? 0) - (baselineRow.net_worth ?? 0);
  const rmdDelta = (altRow.rmd ?? 0) - (baselineRow.rmd ?? 0);
  const rothDelta = (altRow.roth_conversion ?? 0) - (baselineRow.roth_conversion ?? 0);

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
        <section className="year-drawer-section">
          <h3>Deltas ({altName} vs {baselineName})</h3>
          <DeltaRow label="Federal tax" delta={taxDelta} />
          <DeltaRow label="Net worth" delta={nwDelta} />
          <DeltaRow label="RMD" delta={rmdDelta} />
          <DeltaRow label="Roth conversion" delta={rothDelta} />
        </section>
        <div className="scenario-year-diff-columns">
          <section className="year-drawer-section">
            <h3>{baselineName}</h3>
            <div className="year-drawer-row">
              <span className="year-drawer-label">Federal tax</span>
              <span className="year-drawer-value">{formatCurrency(baselineRow.federal_tax_total)}</span>
            </div>
            <div className="year-drawer-row">
              <span className="year-drawer-label">Net worth</span>
              <span className="year-drawer-value">{formatCurrency(baselineRow.net_worth)}</span>
            </div>
            <div className="year-drawer-row">
              <span className="year-drawer-label">RMD</span>
              <span className="year-drawer-value">{formatCurrency(baselineRow.rmd)}</span>
            </div>
          </section>
          <section className="year-drawer-section">
            <h3>{altName}</h3>
            <div className="year-drawer-row">
              <span className="year-drawer-label">Federal tax</span>
              <span className="year-drawer-value">{formatCurrency(altRow.federal_tax_total)}</span>
            </div>
            <div className="year-drawer-row">
              <span className="year-drawer-label">Net worth</span>
              <span className="year-drawer-value">{formatCurrency(altRow.net_worth)}</span>
            </div>
            <div className="year-drawer-row">
              <span className="year-drawer-label">RMD</span>
              <span className="year-drawer-value">{formatCurrency(altRow.rmd)}</span>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
