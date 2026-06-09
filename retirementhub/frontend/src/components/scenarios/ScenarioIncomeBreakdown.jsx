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
  mergeMultiScenarioIncomeBreakdown,
  scenarioChartKey,
} from '../../utils/incomeBreakdown';

const STACK_SERIES = [
  { suffix: 'wages', name: 'Wages / bonus', fill: '#4a6fa5' },
  { suffix: 'ss', name: 'Social Security', fill: '#3d6b8a' },
  { suffix: 'rmd', name: 'RMD', fill: '#a67c52' },
  { suffix: 'savings', name: 'Savings draw', fill: '#2d8a6e' },
];

const EXPENSE_LINE_COLORS = ['#5a6b64', '#c45c5c', '#4a6fa5', '#a67c52', '#6b4a8a', '#8a6b4a'];

function BreakdownTooltip({ active, payload, label, scenarios }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="chart-tooltip">
      <strong>Year {label}</strong>
      {(scenarios || []).map((scenario) => {
        const breakdown = row.scenarios?.[scenario.key];
        if (!breakdown) return null;
        return (
          <div key={scenario.key} style={{ marginTop: '0.35rem' }}>
            <div><strong>{scenario.name}</strong></div>
            <div>Income: {formatCurrency(breakdown.total)}</div>
            <div>Expenses: {formatCurrency(breakdown.expenses)}</div>
            {breakdown.shortfall > 0 && (
              <div className="tooltip-rmd">Shortfall: {formatCurrency(breakdown.shortfall)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {{ scenarios: { id?: number, name: string, years: Record<string, unknown>[], key?: string }[], onYearSelect?: (year: number) => void }} props
 */
export default function ScenarioIncomeBreakdown({ scenarios = [], onYearSelect }) {
  const normalized = useMemo(
    () =>
      (scenarios || []).map((scenario, index) => ({
        ...scenario,
        key: scenario.key || `${scenarioChartKey(scenario.name, `scenario_${index + 1}`)}_${scenario.id ?? index}`,
      })),
    [scenarios]
  );

  const rows = useMemo(
    () => mergeMultiScenarioIncomeBreakdown(normalized),
    [normalized]
  );

  if (!rows.length || !normalized.length) return null;

  const hasIncome = rows.some((row) =>
    normalized.some((scenario) => (row.scenarios?.[scenario.key]?.total ?? 0) > 0)
  );
  if (!hasIncome) return null;

  const chartSeries = normalized.flatMap((scenario) =>
    STACK_SERIES.map((s) => ({
      ...s,
      dataKey: `${scenario.key}_${s.suffix}`,
      stackId: scenario.key,
      legendName: `${scenario.name} — ${s.name}`,
    }))
  );

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
            <Tooltip content={<BreakdownTooltip scenarios={normalized} />} />
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
            {normalized.map((scenario, index) => (
              <Line
                key={`${scenario.key}_expenses`}
                type="monotone"
                dataKey={`${scenario.key}_expenses`}
                name={`${scenario.name} — expenses`}
                stroke={EXPENSE_LINE_COLORS[index % EXPENSE_LINE_COLORS.length]}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 2 }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="projections-detail-table-wrap scenario-income-breakdown-table-wrap">
        <table className="projections-detail-table scenario-income-breakdown-table">
          <thead>
            <tr>
              <th rowSpan={2} scope="col">Year</th>
              {normalized.map((scenario) => (
                <th key={scenario.key} colSpan={6} scope="colgroup" className="scenario-compare-group-header">
                  {scenario.name}
                </th>
              ))}
            </tr>
            <tr>
              {normalized.flatMap((scenario) => [
                <th key={`${scenario.key}-wages`} scope="col" className="num">Wages</th>,
                <th key={`${scenario.key}-ssi`} scope="col" className="num">SSI</th>,
                <th key={`${scenario.key}-rmd`} scope="col" className="num">RMD</th>,
                <th key={`${scenario.key}-savings`} scope="col" className="num">Savings</th>,
                <th key={`${scenario.key}-income`} scope="col" className="num">Income</th>,
                <th key={`${scenario.key}-expenses`} scope="col" className="num">Expenses</th>,
              ])}
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
                {normalized.map((scenario) => {
                  const breakdown = row.scenarios?.[scenario.key] || {
                    wages: 0,
                    bonus: 0,
                    ss: 0,
                    rmd: 0,
                    savings: 0,
                    total: 0,
                    expenses: 0,
                    shortfall: 0,
                  };
                  return (
                    <React.Fragment key={scenario.key}>
                      <td className="num">{formatCurrency(breakdown.wages + breakdown.bonus)}</td>
                      <td className="num">{formatCurrency(breakdown.ss)}</td>
                      <td className="num">{formatCurrency(breakdown.rmd)}</td>
                      <td className="num">{formatCurrency(breakdown.savings)}</td>
                      <td className="num">
                        {formatCurrency(breakdown.total)}
                        {breakdown.shortfall > 0 && (
                          <span className="scenario-income-shortfall" title="Funding shortfall">
                            {' '}({formatCurrency(breakdown.shortfall)} gap)
                          </span>
                        )}
                      </td>
                      <td className="num">{formatCurrency(breakdown.expenses)}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
