import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartClickToYear } from '../../utils/chartClick';
import { formatCurrency } from '../../utils/formatCurrency';

function mapRow(row) {
  const src = row.spending_source || row.spending_sources || {};
  const ss = src.social_security ?? row.income_ss_total ?? 0;
  const rmd = src.rmd ?? row.rmd ?? 0;
  const wagesBonus =
    src.wages_bonus ??
    ((src.wages ?? 0) + (src.bonus ?? 0) || (row.income_wages ?? 0) + (row.income_bonus ?? 0));
  const savings =
    src.savings_withdrawal ??
    row.income_from_savings_draw ??
    (src.taxable ?? 0) +
      (src.cash ?? 0) +
      (src.roth ?? 0) +
      (src.hsa ?? 0) +
      (src.asset_liquidation ?? 0) +
      Math.max(0, (src.traditional_ira ?? 0) - rmd);
  const p2Bridge = src.p2_health_bridge ?? 0;
  return {
    year: row.year,
    social_security: ss,
    rmd,
    wages_bonus: wagesBonus,
    savings_withdrawal: savings,
    p2_health_bridge: p2Bridge,
  };
}

const SERIES = [
  { key: 'social_security', name: 'Social Security', fill: '#3d6b8a' },
  { key: 'rmd', name: 'RMD', fill: '#a67c52' },
  { key: 'wages_bonus', name: 'Wages / bonus', fill: '#4a6fa5' },
  { key: 'savings_withdrawal', name: 'Savings withdrawal', fill: '#2d8a6e' },
  { key: 'p2_health_bridge', name: 'P2 health bridge', fill: '#9b6b9b' },
];

export default function SpendingSourceChart({ years = [], onYearClick }) {
  const data = useMemo(() => years.map(mapRow), [years]);
  if (!data.length) return null;
  const hasData = data.some((r) =>
    SERIES.some((s) => (r[s.key] ?? 0) > 0)
  );
  if (!hasData) return null;

  const handleClick = (e) => {
    const y = chartClickToYear(e);
    if (y != null && onYearClick) onYearClick(y);
  };

  return (
    <div className="projection-chart-panel">
      <h3 className="projection-chart-title">Spending funded by source</h3>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={data}
            margin={{ top: 8, right: 16, left: 8, bottom: 28 }}
            onClick={handleClick}
            style={{ cursor: onYearClick ? 'pointer' : undefined }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(l) => `Year ${l}`} />
            <Legend />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId="spend"
                fill={s.fill}
                stroke={s.fill}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
