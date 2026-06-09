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
  Legend,
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
import { downloadManyScenariosCompareCsv } from '../utils/csvExport';
import { scenarioChartKey } from '../utils/incomeBreakdown';
import {
  mergeComparisonDrivers,
  pickBaselineScenario,
} from '../utils/scenarioCompare';

const NET_WORTH_LINE_COLORS = ['#0d5c4a', '#c45c5c', '#4a6fa5', '#a67c52', '#6b4a8a', '#8a6b4a'];
const TAX_DELTA_LINE_COLORS = ['#c45c5c', '#4a6fa5', '#a67c52', '#6b4a8a', '#8a6b4a', '#2d8a6e'];

function buildScenarioSeries(summaryRows, ids, yearlyById) {
  const baseline = pickBaselineScenario(summaryRows, ids);
  const orderedIds = [
    ...(baseline ? [baseline.scenario_id] : []),
    ...ids.filter((id) => id !== baseline?.scenario_id),
  ];
  return orderedIds
    .map((id, index) => {
      const summary = summaryRows.find((row) => row.scenario_id === id);
      if (!summary) return null;
      return {
        id,
        name: summary.scenario_name || `Scenario ${id}`,
        years: yearlyById[id] || [],
        key: `${scenarioChartKey(summary.scenario_name, `scenario_${index + 1}`)}_${id}`,
        isBaseline: id === baseline?.scenario_id,
      };
    })
    .filter(Boolean);
}

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
  const [comparisons, setComparisons] = useState([]);
  const [scenarioSeries, setScenarioSeries] = useState([]);
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

        const compareRes = await compareScenarios(ids, { recompute: !!recompute });
        const scenarioRows = compareRes.data?.scenarios || [];
        setRows(scenarioRows);

        const explainRes = await explainScenarioComparison(ids, { recompute: !!recompute });
        setComparisons(explainRes.data?.comparisons || []);

        const yearlyResults = await Promise.all(
          ids.map((id) => getScenarioYearly(id, { recompute: !!recompute }))
        );
        const yearlyById = {};
        ids.forEach((id, index) => {
          yearlyById[id] = yearlyResults[index].data?.by_year || [];
        });

        setScenarioSeries(buildScenarioSeries(scenarioRows, ids, yearlyById));
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

  const baselineScenario = useMemo(
    () => scenarioSeries.find((scenario) => scenario.isBaseline) || scenarioSeries[0] || null,
    [scenarioSeries]
  );

  const mergedDrivers = useMemo(() => mergeComparisonDrivers(comparisons), [comparisons]);

  const netWorthChartData = useMemo(() => {
    const years = [
      ...new Set(scenarioSeries.flatMap((scenario) => scenario.years.map((row) => row.year))),
    ].sort((a, b) => a - b);
    return years.map((year) => {
      const point = { year };
      for (const scenario of scenarioSeries) {
        const row = scenario.years.find((entry) => entry.year === year);
        point[scenario.key] = row?.net_worth ?? null;
      }
      return point;
    });
  }, [scenarioSeries]);

  const taxDeltaChartData = useMemo(() => {
    if (!comparisons.length) return [];
    const years = [
      ...new Set(comparisons.flatMap((comparison) => (comparison.yearly_deltas || []).map((d) => d.year))),
    ].sort((a, b) => a - b);
    return years.map((year) => {
      const point = { year };
      comparisons.forEach((comparison, index) => {
        const delta = comparison.yearly_deltas?.find((entry) => entry.year === year);
        const key = scenarioChartKey(comparison.vs, `alt_${index + 1}`);
        point[key] = delta?.federal_tax_delta ?? null;
      });
      return point;
    });
  }, [comparisons]);

  const drawerScenarios = useMemo(() => {
    if (selectedYear == null) return [];
    return scenarioSeries.map((scenario) => ({
      name: scenario.name,
      row: scenario.years.find((entry) => entry.year === selectedYear) || null,
      isBaseline: scenario.isBaseline,
    }));
  }, [scenarioSeries, selectedYear]);

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
        {!loading && scenarioSeries.length >= 2 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              downloadManyScenariosCompareCsv(
                scenarioSeries.map((scenario) => ({ name: scenario.name, years: scenario.years }))
              )
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
          <ScenarioCompareGrid
            rows={rows}
            drivers={mergedDrivers}
            warnings={[...new Set(comparisons.flatMap((comparison) => comparison.warnings || []))]}
          />

          {netWorthChartData.length > 0 && (
            <div className="card projections-chart-card">
              <h2>Net worth by year</h2>
              <p className="projections-chart-intro">
                All selected scenarios. Click a row in the income table below for year detail.
              </p>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={netWorthChartData} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Legend />
                    {scenarioSeries.map((scenario, index) => (
                      <Line
                        key={scenario.key}
                        type="monotone"
                        dataKey={scenario.key}
                        name={scenario.name}
                        stroke={NET_WORTH_LINE_COLORS[index % NET_WORTH_LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <ScenarioIncomeBreakdown scenarios={scenarioSeries} onYearSelect={setSelectedYear} />

          {taxDeltaChartData.length > 0 && baselineScenario && (
            <div className="card projections-chart-card">
              <h2>Year-by-year federal tax delta</h2>
              <p className="projections-chart-intro">
                Each line is a scenario minus {baselineScenario.name}. Click a row in the table below for detail.
              </p>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={taxDeltaChartData} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Legend />
                    {comparisons.map((comparison, index) => {
                      const key = scenarioChartKey(comparison.vs, `alt_${index + 1}`);
                      return (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={`${comparison.vs} vs ${baselineScenario.name}`}
                          stroke={TAX_DELTA_LINE_COLORS[index % TAX_DELTA_LINE_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {comparisons.some((comparison) => comparison.yearly_deltas?.length) && (
            <div className="card">
              <h2>Year-by-year deltas vs {baselineScenario?.name || 'baseline'}</h2>
              {comparisons.map((comparison) => (
                <div key={comparison.vs} style={{ marginBottom: '1.25rem' }}>
                  <h3>{comparison.vs}</h3>
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
                        {(comparison.yearly_deltas || []).map((delta) => (
                          <tr
                            key={`${comparison.vs}-${delta.year}`}
                            className={Math.abs(delta.federal_tax_delta) >= 500 ? 'scenario-diff-highlight' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedYear(delta.year)}
                          >
                            <td>{delta.year}</td>
                            <td className="num">{formatCurrency(delta.federal_tax_delta)}</td>
                            <td className="num">{formatCurrency(delta.net_worth_delta)}</td>
                            <td className="num">{formatCurrency(delta.rmd_delta)}</td>
                            <td className="num">{formatCurrency(delta.roth_conversion_delta)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          <ScenarioYearDiffDrawer
            year={selectedYear}
            scenarios={drawerScenarios}
            onClose={() => setSelectedYear(null)}
          />
        </>
      )}
    </div>
  );
}
