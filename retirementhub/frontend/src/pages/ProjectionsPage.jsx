import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  ComposedChart,
} from 'recharts';
import { getProjections } from '../api/api';

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function ProjectionsSummary({ data }) {
  if (!data) return null;
  const {
    start_year,
    end_year,
    growth_pct,
    expense_cola_pct,
    target_25x_retirement,
    retirement_year,
    starting_net_worth,
    year_reaches_target,
    current_annual,
    retirement_annual,
    projection_meta,
    household,
  } = data;
  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  return (
    <div className="card projections-summary-card">
      <h2>Projection summary</h2>
      <div className="projections-summary-grid">
        <div>
          <span className="summary-label">Horizon</span>
          <span className="summary-value">{start_year} – {end_year}</span>
        </div>
        <div>
          <span className="summary-label">Portfolio growth</span>
          <span className="summary-value">{growth_pct}% / year</span>
        </div>
        <div>
          <span className="summary-label">Expense growth (COLA)</span>
          <span className="summary-value">{expense_cola_pct != null ? `${expense_cola_pct}% / year` : '—'}</span>
        </div>
        <div>
          <span className="summary-label">Starting net worth</span>
          <span className="summary-value">{formatCurrency(starting_net_worth)}</span>
        </div>
        <div>
          <span className="summary-label">25× retirement target</span>
          <span className="summary-value">{formatCurrency(target_25x_retirement)}</span>
        </div>
        <div>
          <span className="summary-label">Retirement year</span>
          <span className="summary-value">{retirement_year ?? 'Not set'}</span>
        </div>
        <div>
          <span className="summary-label">Year reaching target</span>
          <span className="summary-value">{year_reaches_target != null ? year_reaches_target : '—'}</span>
        </div>
      </div>
      <p className="projections-summary-note">
        Current annual expenses: {formatCurrency(current_annual)} · Retirement annual: {formatCurrency(retirement_annual)}
      </p>
      {projection_meta && (
        <p className="projections-summary-note" style={{ marginTop: '0.5rem' }}>
          SS in projections: {p1Name} {formatCurrency(projection_meta.p1_ss_monthly_used)}/mo (ret. {projection_meta.p1_retirement_year ?? '—'})
          {' · '}{p2Name} {projection_meta.p2_uses_spousal ? '50% of ' + p1Name : formatCurrency(projection_meta.p2_ss_monthly_used) + '/mo'} (ret. {projection_meta.p2_retirement_year ?? '—'})
          {projection_meta.expense_retirement_year != null && (
            <> · Expenses use retirement amounts from {projection_meta.expense_retirement_year}</>
          )}
        </p>
      )}
    </div>
  );
}

function NetWorthChart({ data, target25x }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="card projections-chart-card">
      <h2>Net worth projection</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [formatCurrency(value), 'Net worth']}
              labelFormatter={(label) => `Year ${label}`}
            />
            {target25x != null && target25x > 0 && (
              <ReferenceLine y={target25x} stroke="#0d5c4a" strokeDasharray="5 5" label={{ value: '25× target', position: 'right', fontSize: 11 }} />
            )}
            <Line type="monotone" dataKey="net_worth" name="Net worth" stroke="#0d5c4a" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function IncomeVsExpensesChart({ data, household }) {
  if (!data || data.length === 0) return null;
  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  return (
    <div className="card projections-chart-card">
      <h2>Income vs expenses by year</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [formatCurrency(value)]}
              labelFormatter={(label) => `Year ${label}`}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length || !payload[0]) return null;
                const p = payload[0].payload;
                const p1Ret = p.p1_retired;
                const p2Ret = p.p2_retired;
                let retirementLabel = null;
                if (p1Ret && p2Ret) retirementLabel = `Both ${p1Name} & ${p2Name} retired`;
                else if (p1Ret) retirementLabel = `${p1Name} retired`;
                else if (p2Ret) retirementLabel = `${p2Name} retired`;
                return (
                  <div className="chart-tooltip">
                    <strong>Year {label}</strong>
                    <div>Income: {formatCurrency(p.income)}</div>
                    <div>Expenses: {formatCurrency(p.expenses)}</div>
                    <div>Savings: {formatCurrency(p.savings)}</div>
                    {(p.income_ss_p1 > 0 || p.income_ss_p2 > 0) && (
                      <div className="tooltip-ss">
                        {p.income_ss_p1 > 0 && <span>SS {p1Name}: {formatCurrency(p.income_ss_p1)}</span>}
                        {p.income_ss_p1 > 0 && p.income_ss_p2 > 0 && ' · '}
                        {p.income_ss_p2 > 0 && <span>SS {p2Name}: {formatCurrency(p.income_ss_p2)}</span>}
                      </div>
                    )}
                    {retirementLabel && <div className="tooltip-retired">{retirementLabel}</div>}
                  </div>
                );
              }}
            />
            <Legend />
            <Bar dataKey="income" name="Income" fill="#0d5c4a" radius={[2, 2, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#5a6b64" radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function ProjectionsPage() {
  const allowZeroRates = import.meta.env.VITE_DEBUG != null && String(import.meta.env.VITE_DEBUG).trim() !== '';
  const minGrowth = allowZeroRates ? 0 : 0.01;
  const minCola = allowZeroRates ? 0 : 0.01;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [years, setYears] = useState(30);
  const [growthPct, setGrowthPct] = useState(5);
  const [expenseColaPct, setExpenseColaPct] = useState(2.5);

  const load = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const res = await getProjections(years, growthPct, expenseColaPct);
      setData(res.data);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to load projections');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApply = (e) => {
    e.preventDefault();
    load();
  };

  const chartData = data?.by_year?.map((row) => ({
    ...row,
    year: row.year,
    net_worth: row.net_worth,
    income: row.income,
    expenses: row.expenses,
    savings: row.savings,
    p1_retired: row.p1_retired,
    p2_retired: row.p2_retired,
    income_ss_p1: row.income_ss_p1,
    income_ss_p2: row.income_ss_p2,
  })) ?? [];

  return (
    <div className="page-scroll">
      <h1 className="page-title">Projections</h1>
      <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.95rem' }}>
        Net worth and income vs expenses over time. Uses current account balances, income, and expense settings. Set retirement dates on Household and 401(k) on Income for accurate savings. Portfolio growth applies each year; expense growth (COLA) inflates both expenses and Social Security benefits by that % per year.
      </p>

      <div className="card projections-controls-card">
        <h2>Assumptions</h2>
        {allowZeroRates && (
          <p style={{ fontSize: '0.85rem', color: '#6b7c75', marginBottom: '0.5rem' }}>DEBUG: 0% growth and 0% COLA allowed for testing.</p>
        )}
        <form onSubmit={handleApply} className="projections-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="projections-years">Years to project</label>
              <input
                id="projections-years"
                type="number"
                min={5}
                max={50}
                value={years}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  const clamped = Number.isFinite(v) ? Math.min(50, Math.max(5, v)) : 30;
                  setYears(clamped);
                }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="projections-growth">Growth rate (% per year)</label>
              <input
                id="projections-growth"
                type="number"
                min={minGrowth}
                max={20}
                step={allowZeroRates ? 0.1 : 0.5}
                value={growthPct}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  const fallback = 5;
                  const clamped = Number.isFinite(v) ? Math.min(20, Math.max(minGrowth, v)) : fallback;
                  setGrowthPct(clamped);
                }}
                title={allowZeroRates ? 'DEBUG: 0% allowed for testing' : undefined}
              />
            </div>
            <div className="form-group">
              <label htmlFor="projections-cola">Expense growth / COLA (% per year)</label>
              <input
                id="projections-cola"
                type="number"
                min={minCola}
                max={10}
                step={allowZeroRates ? 0.1 : 0.25}
                value={expenseColaPct}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  const fallback = 2.5;
                  const clamped = Number.isFinite(v) ? Math.min(10, Math.max(minCola, v)) : fallback;
                  setExpenseColaPct(clamped);
                }}
                title={allowZeroRates ? 'DEBUG: 0% allowed for testing. Expenses and Social Security benefits increase each year by this %.' : 'Expenses and Social Security benefits increase each year by this % (SS COLA–style, default ~2.5%)'}
              />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">Update</button>
            </div>
          </div>
        </form>
      </div>

      {message && <div className="error-message">{message}</div>}
      {loading && !data && <p className="loading-message">Loading projections…</p>}

      {data && (
        <>
          <ProjectionsSummary data={data} />
          <NetWorthChart data={chartData} target25x={data.target_25x_retirement} />
          <IncomeVsExpensesChart data={chartData} household={data.household} />
        </>
      )}
    </div>
  );
}
