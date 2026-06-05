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

function mapRow(row) {
  return {
    year: row.year,
    wages: row.income_wages ?? (row.income_wage_p1 ?? 0) + (row.income_wage_p2 ?? 0),
    bonus: row.income_bonus ?? 0,
    taxable_ss: row.taxable_ss_estimate ?? row.social_security_taxable_portion ?? 0,
    rmd: row.rmd ?? row.rmd_total ?? 0,
  };
}

const SERIES = [
  { key: 'wages', name: 'Wages', fill: '#4a6fa5' },
  { key: 'bonus', name: 'Bonus', fill: '#6b8f71' },
  { key: 'taxable_ss', name: 'Social Security (taxable)', fill: '#3d6b8a' },
  { key: 'rmd', name: 'RMD', fill: '#a67c52' },
];

export default function TaxableIncomeChart({ years = [], onYearClick }) {
  const data = useMemo(() => years.map(mapRow), [years]);
  if (!data.length) return null;

  const handleClick = (e) => {
    const y = chartClickToYear(e);
    if (y != null && onYearClick) onYearClick(y);
  };

  return (
    <div className="projection-chart-panel">
      <h3 className="projection-chart-title">Taxable income by source</h3>
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
            <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(l) => `Year ${l}`} />
            <Legend />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId="inc" fill={s.fill} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
