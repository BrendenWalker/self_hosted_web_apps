import React, { useMemo } from 'react';
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '../../utils/formatCurrency';
import {
  incomeComponentsTotal,
  mergeScenarioIncomeBreakdown,
  scenarioChartKey,
} from '../../utils/incomeBreakdown';

const STACK_SERIES = [
  { suffix: 'wages', name: 'Wages / bonus', fill: '#4a6fa5' },
  { suffix: 'ss', name: 'Social Security', fill: '#3d6b8a' },
  { suffix: 'rmd', name: 'RMD', fill: '#a67c52' },
  { suffix: 'savings', name: 'Savings draw', fill: '#2d8a6e' },
];

function BreakdownTooltip({ active, payload, label, baselineName, altName }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="chart-tooltip">
      <strong>Year {label}</strong>
      {[['baseline', baselineName], ['alt', altName]].map(([key, name]) => {
        const b = row[key];
        if (!b) return null;
        return (
          <div key={key} style={{ marginTop: '0.35rem' }}>
            <div><strong>{name}</strong></div>
            <div>Income: {formatCurrency(b.total)}</div>
            <div>Expenses: {formatCurrency(b.expenses)}</div>
            {b.shortfall > 0 && (
              <div className="tooltip-rmd">Shortfall: {formatCurrency(b.shortfall)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ScenarioIncomeBreakdown({
  baselineYears = [],
  altYears = [],
  baselineName = 'Baseline',
  altName = 'Alternative',
  onYearSelect,
}) {
  const baselineKey = scenarioChartKey(baselineName, 'baseline');
  const altKey = scenarioChartKey(altName, 'alternative');

  const rows = useMemo(
    () => mergeScenarioIncomeBreakdown(baselineYears, altYears, baselineKey, altKey),
    [baselineYears, altYears, baselineKey, altKey]
  );

  if (!rows.length) return null;

  const hasIncome = rows.some((r) => r.baseline.total > 0 || r.alt.total > 0);
  if (!hasIncome) return null;

  const chartSeries = [
    ...STACK_SERIES.map((s) => ({
      ...s,
      dataKey: `${baselineKey}_${s.suffix}`,
      stackId: baselineKey,
      legendName: `${baselineName} — ${s.name}`,
    })),
    ...STACK_SERIES.map((s) => ({
      ...s,
      dataKey: `${altKey}_${s.suffix}`,
      stackId: altKey,
      legendName: `${altName} — ${s.name}`,
    })),
  ];

  return (
    <div className="card projections-chart-card">
      <h2>Income vs expenses by year</h2>
      <p className="projections-chart-intro">
        Stacked bars show cash income (wages, Social Security, RMDs, savings withdrawals). Dashed lines
        show expenses. When assets can cover the gap, total income matches expenses. Use Recompute if
        numbers look stale.
        {onYearSelect && ' Click a table row for side-by-side detail.'}
      </p>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} tick={{ fontSize: 12 }} />
            <Tooltip content={<BreakdownTooltip baselineName={baselineName} altName={altName} />} />
            <Legend />
            {chartSeries.map((s) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.legendName}
                stackId={s.stackId}
                fill={s.fill}
              />
            ))}
            <Line
              type="monotone"
              dataKey={`${baselineKey}_expenses`}
              name={`${baselineName} — expenses`}
              stroke="#5a6b64"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 2 }}
            />
            <Line
              type="monotone"
              dataKey={`${altKey}_expenses`}
              name={`${altName} — expenses`}
              stroke="#c45c5c"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="projections-detail-table-wrap scenario-income-breakdown-table-wrap">
        <table className="projections-detail-table scenario-income-breakdown-table">
          <thead>
            <tr>
              <th rowSpan={2} scope="col">Year</th>
              <th colSpan={6} scope="colgroup" className="scenario-compare-group-header">
                {baselineName}
              </th>
              <th colSpan={6} scope="colgroup" className="scenario-compare-group-header">
                {altName}
              </th>
            </tr>
            <tr>
              <th scope="col" className="num">Wages</th>
              <th scope="col" className="num">SSI</th>
              <th scope="col" className="num">RMD</th>
              <th scope="col" className="num">Savings</th>
              <th scope="col" className="num">Income</th>
              <th scope="col" className="num">Expenses</th>
              <th scope="col" className="num">Wages</th>
              <th scope="col" className="num">SSI</th>
              <th scope="col" className="num">RMD</th>
              <th scope="col" className="num">Savings</th>
              <th scope="col" className="num">Income</th>
              <th scope="col" className="num">Expenses</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.year}
                className={onYearSelect ? 'projections-year-row-clickable' : undefined}
                onClick={onYearSelect ? () => onYearSelect(row.year) : undefined}
                onKeyDown={
                  onYearSelect
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onYearSelect(row.year);
                        }
                      }
                    : undefined
                }
                tabIndex={onYearSelect ? 0 : undefined}
                role={onYearSelect ? 'button' : undefined}
              >
                <td>{row.year}</td>
                <td className="num">{formatCurrency(row.baseline.wages + row.baseline.bonus)}</td>
                <td className="num">{formatCurrency(row.baseline.ss)}</td>
                <td className="num">{formatCurrency(row.baseline.rmd)}</td>
                <td className="num">{formatCurrency(row.baseline.savings)}</td>
                <td className="num">
                  {formatCurrency(row.baseline.total)}
                  {row.baseline.shortfall > 0 && (
                    <span className="scenario-income-shortfall" title="Funding shortfall">
                      {' '}({formatCurrency(row.baseline.shortfall)} gap)
                    </span>
                  )}
                </td>
                <td className="num">{formatCurrency(row.baseline.expenses)}</td>
                <td className="num">{formatCurrency(row.alt.wages + row.alt.bonus)}</td>
                <td className="num">{formatCurrency(row.alt.ss)}</td>
                <td className="num">{formatCurrency(row.alt.rmd)}</td>
                <td className="num">{formatCurrency(row.alt.savings)}</td>
                <td className="num">
                  {formatCurrency(row.alt.total)}
                  {row.alt.shortfall > 0 && (
                    <span className="scenario-income-shortfall" title="Funding shortfall">
                      {' '}({formatCurrency(row.alt.shortfall)} gap)
                    </span>
                  )}
                </td>
                <td className="num">{formatCurrency(row.alt.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
