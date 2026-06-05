import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartClickToYear } from '../../utils/chartClick';
import { formatCurrency } from '../../utils/formatCurrency';

const BRACKET_RATES = [10, 12, 22, 24, 32, 35, 37];

const BRACKET_COLORS = {
  10: '#c6dbef',
  12: '#9ecae1',
  22: '#6baed6',
  24: '#4292c6',
  32: '#f4a582',
  35: '#e6550d',
  37: '#a63603',
};

function mapRow(row) {
  const out = { year: row.year, _brackets: row.federal_tax_brackets || [] };
  for (const rate of BRACKET_RATES) {
    out[`rate_${rate}`] = 0;
  }
  for (const b of row.federal_tax_brackets || []) {
    const rate = b.rate_pct;
    if (rate != null) out[`rate_${rate}`] = b.tax ?? 0;
  }
  return out;
}

function FederalTaxTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const brackets = row?._brackets || [];
  return (
    <div className="chart-tooltip">
      <strong>Year {label}</strong>
      {brackets.length === 0 && <div>No federal tax in this bracket breakdown</div>}
      {brackets.map((b, i) => (
        <div key={i}>
          {b.rate_pct}%: {formatCurrency(b.tax)} on {formatCurrency(b.income_in_band)}
        </div>
      ))}
    </div>
  );
}

export default function FederalTaxChart({ years = [], onYearClick }) {
  const data = useMemo(() => years.map(mapRow), [years]);
  if (!data.length) return null;

  const handleClick = (e) => {
    const y = chartClickToYear(e);
    if (y != null && onYearClick) onYearClick(y);
  };

  const activeRates = BRACKET_RATES.filter((rate) =>
    data.some((row) => (row[`rate_${rate}`] ?? 0) > 0.005)
  );

  return (
    <div className="projection-chart-panel">
      <h3 className="projection-chart-title">Federal tax by bracket</h3>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 16, left: 8, bottom: 28 }}
            onClick={handleClick}
            style={{ cursor: onYearClick ? 'pointer' : undefined }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip content={<FederalTaxTooltip />} />
            <Legend />
            {activeRates.map((rate) => (
              <Bar
                key={rate}
                dataKey={`rate_${rate}`}
                name={`${rate}%`}
                stackId="tax"
                fill={BRACKET_COLORS[rate] || '#888'}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
