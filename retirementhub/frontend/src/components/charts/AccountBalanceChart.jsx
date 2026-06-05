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

const BUCKETS = [
  { key: 'pre_tax', name: 'Traditional', fill: '#4a6fa5' },
  { key: 'roth', name: 'Roth', fill: '#2d8a6e' },
  { key: 'taxable', name: 'Taxable', fill: '#7a9e7e' },
  { key: 'cash', name: 'Cash', fill: '#a8c4b8' },
  { key: 'hsa', name: 'HSA', fill: '#c9b87a' },
  { key: 'asset', name: 'Hard assets', fill: '#c4a35a' },
];

function mapRow(row) {
  const b = row.balances_by_bucket || row.account_balance_by_bucket || {};
  return {
    year: row.year,
    pre_tax: b.pre_tax ?? 0,
    roth: b.roth ?? 0,
    taxable: b.taxable ?? 0,
    cash: b.cash ?? 0,
    hsa: b.hsa ?? 0,
    asset: b.asset ?? row.hard_asset_balance ?? 0,
  };
}

export default function AccountBalanceChart({ years = [], onYearClick }) {
  const data = useMemo(() => years.map(mapRow), [years]);
  if (!data.length) return null;

  const handleClick = (e) => {
    const y = chartClickToYear(e);
    if (y != null && onYearClick) onYearClick(y);
  };

  return (
    <div className="projection-chart-panel">
      <h3 className="projection-chart-title">Account balances by bucket</h3>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
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
            {BUCKETS.map((b) => (
              <Area
                key={b.key}
                type="monotone"
                dataKey={b.key}
                name={b.name}
                stackId="bal"
                fill={b.fill}
                stroke={b.fill}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
