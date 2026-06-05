import React, { useState } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';

export default function ScenarioCompareGrid({ rows, explanation, showDrivers = true }) {
  const [sortKey, setSortKey] = useState('scenario_name');
  const [sortAsc, setSortAsc] = useState(true);

  if (!rows?.length) return null;

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? av - bv : bv - av;
  });

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === 'scenario_name');
    }
  };

  const sortIndicator = (key) => (sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : '');

  const lowestTax = explanation?.highlights?.lowest_lifetime_tax;
  const highestWorth = explanation?.highlights?.highest_ending_net_worth;
  const lowestRmd = explanation?.highlights?.lowest_peak_rmd;
  const drivers = explanation?.structured_drivers?.length
    ? explanation.structured_drivers
    : (explanation?.drivers || []).map((label) => ({ label }));

  return (
    <div className="card">
      <h2>Scenario comparison</h2>
      {(lowestTax || highestWorth) && (
        <div className="projections-summary-grid" style={{ marginBottom: '1rem' }}>
          {lowestTax && (
            <div>
              <span className="summary-label">Lowest lifetime tax</span>
              <span className="summary-value">
                {lowestTax.scenario_name} ({formatCurrency(lowestTax.lifetime_total_tax)})
              </span>
            </div>
          )}
          {highestWorth && (
            <div>
              <span className="summary-label">Highest ending net worth</span>
              <span className="summary-value">
                {highestWorth.scenario_name} ({formatCurrency(highestWorth.ending_net_worth)})
              </span>
            </div>
          )}
          {lowestRmd && (
            <div>
              <span className="summary-label">Lowest peak RMD</span>
              <span className="summary-value">
                {lowestRmd.scenario_name} ({formatCurrency(lowestRmd.peak_rmd)})
              </span>
            </div>
          )}
        </div>
      )}
      {explanation?.summary && (
        <p className="projections-summary-note" style={{ marginBottom: '0.75rem' }}>{explanation.summary}</p>
      )}
      {showDrivers && drivers.length > 0 && (
        <div className="scenario-drivers-panel">
          <h3>Key drivers</h3>
          <ul className="projections-insights-list">
            {drivers.map((d, i) => (
              <li key={d.kind ? `${d.kind}-${d.year_start}-${i}` : i}>{d.label}</li>
            ))}
          </ul>
        </div>
      )}
      {explanation?.warnings?.length > 0 && (
        <ul className="projections-insights-list">
          {explanation.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      <div className="projections-detail-table-wrap">
        <table className="projections-detail-table">
          <thead>
            <tr>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => handleSort('scenario_name')}>
                  Scenario{sortIndicator('scenario_name')}
                </button>
              </th>
              <th className="num">P1 retire yr</th>
              <th className="num">SS claim P1/P2</th>
              <th className="num">Withdrawal</th>
              <th className="num">Roth strategy</th>
              <th className="num">
                <button type="button" className="table-sort-btn" onClick={() => handleSort('lifetime_total_tax')}>
                  Lifetime tax{sortIndicator('lifetime_total_tax')}
                </button>
              </th>
              <th className="num">
                <button type="button" className="table-sort-btn" onClick={() => handleSort('peak_rmd')}>
                  Peak RMD{sortIndicator('peak_rmd')}
                </button>
              </th>
              <th className="num">
                <button type="button" className="table-sort-btn" onClick={() => handleSort('ending_net_worth')}>
                  Ending net worth{sortIndicator('ending_net_worth')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.scenario_id}>
                <td>{r.scenario_name}</td>
                <td className="num">{r.p1_retirement_year ?? '—'}</td>
                <td className="num">
                  {r.p1_ss_claim_age ?? '—'} / {r.p2_ss_claim_age ?? '—'}
                </td>
                <td className="num">{r.withdrawal_strategy ?? '—'}</td>
                <td className="num">{r.roth_strategy ?? '—'}</td>
                <td className="num">{formatCurrency(r.lifetime_total_tax)}</td>
                <td className="num">
                  {r.peak_rmd != null ? `${formatCurrency(r.peak_rmd)} (${r.peak_rmd_year ?? '—'})` : '—'}
                </td>
                <td className="num">{formatCurrency(r.ending_net_worth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
