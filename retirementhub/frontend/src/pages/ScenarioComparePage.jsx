import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  compareScenarios,
  explainScenarioComparison,
  getScenarioYearly,
} from '../api/api';
import ScenarioCompareGrid from '../components/scenarios/ScenarioCompareGrid';
import ScenarioIncomeBreakdown from '../components/scenarios/ScenarioIncomeBreakdown';
import ScenarioYearDiffDrawer from '../components/scenarios/ScenarioYearDiffDrawer';
import { formatCurrency } from '../utils/formatCurrency';
import { downloadScenarioCompareCsv } from '../utils/csvExport';

export default function ScenarioComparePage() {
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  const ids = useMemo(
    () =>
      idsParam
        .split(',')
        .map((x) => parseInt(x.trim(), 10))
        .filter((n) => Number.isFinite(n)),
    [idsParam]
  );

  const [rows, setRows] = useState([]);
  const [explanation, setExplanation] = useState(null);
  const [baselineId, setBaselineId] = useState(null);
  const [altId, setAltId] = useState(null);
  const [baselineYearly, setBaselineYearly] = useState([]);
  const [altYearly, setAltYearly] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const load = useCallback(
    async (recompute = false) => {
      if (ids.length < 2) {
        setMessage('Select at least two scenarios to compare.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setMessage(null);
        let compareRes;
        let explainRes;
        let baseYearly;
        let altYearlyRes;

        if (recompute) {
          compareRes = await compareScenarios(ids, { recompute: true });
          const scenarioRows = compareRes.data?.scenarios || [];
          setRows(scenarioRows);

          const base = scenarioRows.find((r) => r.scenario_name === 'Baseline') || scenarioRows[0];
          const alt = scenarioRows.find((r) => r.scenario_id !== base?.scenario_id) || scenarioRows[1];
          setBaselineId(base?.scenario_id ?? ids[0]);
          setAltId(alt?.scenario_id ?? ids[1]);

          [explainRes, baseYearly, altYearlyRes] = await Promise.all([
            explainScenarioComparison(ids, { recompute: false }),
            getScenarioYearly(base?.scenario_id ?? ids[0], { recompute: false }),
            getScenarioYearly(alt?.scenario_id ?? ids[1], { recompute: false }),
          ]);
        } else {
          [compareRes, explainRes] = await Promise.all([
            compareScenarios(ids, { recompute: false }),
            explainScenarioComparison(ids, { recompute: false }),
          ]);
          const scenarioRows = compareRes.data?.scenarios || [];
          setRows(scenarioRows);

          const base = scenarioRows.find((r) => r.scenario_name === 'Baseline') || scenarioRows[0];
          const alt = scenarioRows.find((r) => r.scenario_id !== base?.scenario_id) || scenarioRows[1];
          setBaselineId(base?.scenario_id ?? ids[0]);
          setAltId(alt?.scenario_id ?? ids[1]);

          [baseYearly, altYearlyRes] = await Promise.all([
            getScenarioYearly(base?.scenario_id ?? ids[0], { recompute: false }),
            getScenarioYearly(alt?.scenario_id ?? ids[1], { recompute: false }),
          ]);
        }

        const firstComparison = explainRes.data?.comparisons?.[0];
        setExplanation(firstComparison || compareRes.data?.explanation || null);
        setBaselineYearly(baseYearly.data?.by_year || []);
        setAltYearly(altYearlyRes.data?.by_year || []);
      } catch (err) {
        setMessage(err.response?.data?.error || 'Failed to load comparison');
      } finally {
        setLoading(false);
      }
    },
    [ids]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const yearlyDeltas = explanation?.yearly_deltas || [];
  const chartData = yearlyDeltas.map((d) => ({
    year: d.year,
    federal_tax_delta: d.federal_tax_delta,
  }));

  const baselineRow = selectedYear != null ? baselineYearly.find((r) => r.year === selectedYear) : null;
  const altRow = selectedYear != null ? altYearly.find((r) => r.year === selectedYear) : null;
  const baselineName = rows.find((r) => r.scenario_id === baselineId)?.scenario_name || 'Baseline';
  const altName = rows.find((r) => r.scenario_id === altId)?.scenario_name || 'Alternative';

  if (ids.length < 2) {
    return (
      <div className="page-scroll">
        <h1 className="page-title">Compare scenarios</h1>
        <p>Select at least two scenarios from the <Link to="/scenarios">Scenarios</Link> list.</p>
      </div>
    );
  }

  return (
    <div className="page-scroll">
      <h1 className="page-title">Compare scenarios</h1>
      <div className="scenario-toolbar">
        <Link to="/scenarios" className="btn btn-secondary">← All scenarios</Link>
        <button type="button" className="btn btn-secondary" onClick={() => load(true)} disabled={loading}>
          Recompute
        </button>
        {!loading && baselineYearly.length > 0 && altYearly.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              downloadScenarioCompareCsv(baselineYearly, altYearly, {
                baselineName,
                altName,
              })
            }
          >
            Export CSV
          </button>
        )}
      </div>

      {message && <div className="error-message">{message}</div>}
      {loading && <p className="loading-message">Loading comparison…</p>}

      {!loading && rows.length >= 2 && (
        <>
          <ScenarioCompareGrid rows={rows} explanation={explanation} />

          <ScenarioIncomeBreakdown
            baselineYears={baselineYearly}
            altYears={altYearly}
            baselineName={baselineName}
            altName={altName}
            onYearSelect={setSelectedYear}
          />

          {chartData.length > 0 && (
            <div className="card projections-chart-card">
              <h2>Year-by-year federal tax delta</h2>
              <p className="projections-chart-intro">
                {altName} minus {baselineName}. Click a row in the table below for side-by-side detail.
              </p>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="federal_tax_delta" name="Tax delta" stroke="#0d5c4a" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {yearlyDeltas.length > 0 && (
            <div className="card">
              <h2>Year-by-year deltas</h2>
              <div className="projections-detail-table-wrap">
                <table className="projections-detail-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th className="num">Tax Δ</th>
                      <th className="num">Net worth Δ</th>
                      <th className="num">RMD Δ</th>
                      <th className="num">Roth conv Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyDeltas.map((d) => (
                      <tr
                        key={d.year}
                        className={Math.abs(d.federal_tax_delta) >= 500 ? 'scenario-diff-highlight' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedYear(d.year)}
                      >
                        <td>{d.year}</td>
                        <td className="num">{formatCurrency(d.federal_tax_delta)}</td>
                        <td className="num">{formatCurrency(d.net_worth_delta)}</td>
                        <td className="num">{formatCurrency(d.rmd_delta)}</td>
                        <td className="num">{formatCurrency(d.roth_conversion_delta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ScenarioYearDiffDrawer
            year={selectedYear}
            baselineRow={baselineRow}
            altRow={altRow}
            baselineName={baselineName}
            altName={altName}
            onClose={() => setSelectedYear(null)}
          />
        </>
      )}
    </div>
  );
}
