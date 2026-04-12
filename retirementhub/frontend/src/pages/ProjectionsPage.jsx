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
  Bar,
  ComposedChart,
} from 'recharts';
import { getProjections, updateHousehold } from '../api/api';

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Recharts X-axis tick: calendar year + P1/P2 ages (end of year). */
function YearAgeAxisTick({ x, y, payload, household, data }) {
  const raw = payload?.value ?? payload;
  const year = typeof raw === 'object' && raw !== null && 'value' in raw ? raw.value : raw;
  const row = data.find((d) => d.year === year);
  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  const a1 = row?.p1_age_eoy ?? '—';
  const a2 = row?.p2_age_eoy ?? '—';
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="end" fill="#5a6b64" className="projections-axis-year-age" transform="rotate(-38)">
        <tspan x={0} dy={10} fontSize={11}>{year}</tspan>
        <tspan x={0} dy={11} fontSize={9}>{p1Name} {a1} · {p2Name} {a2}</tspan>
      </text>
    </g>
  );
}


function ProjectionsSummary({ data }) {
  if (!data) return null;
  const {
    start_year,
    end_year,
    growth_pct,
    expense_growth_pct,
    ssi_growth_pct,
    target_25x_retirement,
    retirement_year,
    starting_net_worth,
    year_reaches_target,
    current_annual,
    retirement_annual,
    required_monthly_income_retirement,
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
          <span className="summary-label">Expense growth</span>
          <span className="summary-value">{expense_growth_pct != null ? `${expense_growth_pct}% / year` : '—'}</span>
        </div>
        <div>
          <span className="summary-label">SSI growth (Social Security)</span>
          <span className="summary-value">{ssi_growth_pct != null ? `${ssi_growth_pct}% / year` : '—'}</span>
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
        Current annual expenses: {formatCurrency(current_annual)}
        {' · '}
        {required_monthly_income_retirement != null && required_monthly_income_retirement > 0 ? (
          <>
            Required monthly income (ret.): {formatCurrency(required_monthly_income_retirement)}/mo (
            {formatCurrency(required_monthly_income_retirement * 12)}/yr before expense growth)
          </>
        ) : (
          <>Retirement annual (from expense categories + mortgage): {formatCurrency(retirement_annual)}</>
        )}
      </p>
      {projection_meta && (
        <p className="projections-summary-note" style={{ marginTop: '0.5rem' }}>
          SS in projections: {p1Name} {formatCurrency(projection_meta.p1_ss_monthly_used)}/mo (ret. {projection_meta.p1_retirement_year ?? '—'})
          {' · '}{p2Name} {projection_meta.p2_uses_spousal ? '50% of ' + p1Name : formatCurrency(projection_meta.p2_ss_monthly_used) + '/mo'} (ret. {projection_meta.p2_retirement_year ?? '—'})
          {projection_meta.expense_retirement_year != null && (
            <>
              {' '}
              · Expenses use retirement amounts from {projection_meta.expense_retirement_year}
              {projection_meta.use_required_monthly_income
                ? ' (required monthly income + expense growth; P2 pre-Medicare bridge added when applicable)'
                : ''}
            </>
          )}
        </p>
      )}
      {projection_meta?.use_required_monthly_income && projection_meta?.required_monthly_income_note && (
        <p className="projections-summary-note" style={{ marginTop: '0.5rem' }}>
          {projection_meta.required_monthly_income_note}
        </p>
      )}
      {projection_meta != null && (projection_meta.p1_rmd_start_age != null || projection_meta.p2_rmd_start_age != null) && (
        <p className="projections-summary-note" style={{ marginTop: '0.5rem' }}>
          First RMD age (by birth year): {p1Name} age {projection_meta.p1_rmd_start_age ?? '—'} · {p2Name} age {projection_meta.p2_rmd_start_age ?? '—'}.
          {' '}
          {projection_meta.rmd_note}
        </p>
      )}
    </div>
  );
}

function NetWorthChart({ data, target25x, household }) {
  if (!data || data.length === 0) return null;
  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  return (
    <div className="card projections-chart-card">
      <h2>Net worth projection</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 52 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis
              dataKey="year"
              height={52}
              interval={0}
              minTickGap={18}
              tick={(props) => <YearAgeAxisTick {...props} household={household} data={data} />}
            />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [formatCurrency(value), 'Net worth']}
              labelFormatter={(label, payloadItems) => {
                const row = payloadItems?.[0]?.payload;
                const a1 = row?.p1_age_eoy ?? '—';
                const a2 = row?.p2_age_eoy ?? '—';
                return `Year ${label} · ${p1Name} age ${a1} · ${p2Name} age ${a2}`;
              }}
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

function filingStatusLabel(fs) {
  const map = {
    married_filing_jointly: 'Married filing jointly',
    married_filing_separately: 'Married filing separately',
    single: 'Single',
    head_of_household: 'Head of household',
  };
  return map[fs] || fs || '—';
}

function FederalBracketLines({ brackets }) {
  if (!brackets || brackets.length === 0) return '—';
  const lines = brackets.filter((b) => b.tax > 0.005);
  if (lines.length === 0) return '—';
  return (
    <ul className="federal-tax-brackets">
      {lines.map((b, i) => (
        <li key={i}>
          {b.rate_pct}%: {formatCurrency(b.tax)} on {formatCurrency(b.income_in_band)}
        </li>
      ))}
    </ul>
  );
}

function ProjectionsTaxDetailTable({ rows, projectionMeta, household }) {
  if (!rows || rows.length === 0) return null;
  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  return (
    <div className="projections-detail-grid projections-tax-grid">
      <h3 className="projections-detail-title">Federal tax estimate (ordinary income)</h3>
      <p className="projections-detail-intro">
        <strong>Taxable income (after standard deduction)</strong> is ordinary income before deduction minus an inflated 2025-style standard deduction (with age 65+ add-ons when applicable).
        <strong> Federal tax</strong> applies marginal rates to that amount.
        <strong> Taxable SS + RMD</strong> is the retirement-only portion; <strong>SS+RMD − std ded</strong> is informational (your real return uses one deduction against all income).
        {projectionMeta?.tax_model_note && (
          <span className="projections-detail-meta"> {projectionMeta.tax_model_note}</span>
        )}
      </p>
      <div className="projections-detail-table-wrap">
        <table className="projections-detail-table projections-tax-table">
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col" className="num">{p1Name} age</th>
              <th scope="col" className="num">{p2Name} age</th>
              <th scope="col" className="num">Std ded (est.)</th>
              <th scope="col" className="num">Ordinary income (before ded.)</th>
              <th scope="col" className="num">Taxable income (after ded.)</th>
              <th scope="col" className="num">Taxable SS + RMD</th>
              <th scope="col" className="num">SS + RMD − std ded (info)</th>
              <th scope="col" className="num">Federal tax (est.)</th>
              <th scope="col" className="num">Effective rate</th>
              <th scope="col" className="bracket-col">Marginal tax by bracket</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td className="num">{row.p1_age_eoy ?? '—'}</td>
                <td className="num">{row.p2_age_eoy ?? '—'}</td>
                <td className="num">{formatCurrency(row.standard_deduction_estimate)}</td>
                <td className="num">{formatCurrency(row.taxable_income_before_deduction ?? row.taxable_income_estimate)}</td>
                <td className="num">{formatCurrency(row.taxable_income_after_standard_deduction)}</td>
                <td className="num">{formatCurrency(row.taxable_ss_plus_rmd)}</td>
                <td className="num">{formatCurrency(row.taxable_ss_rmd_minus_std_ded)}</td>
                <td className="num">{formatCurrency(row.federal_tax_ordinary_estimate)}</td>
                <td className="num">
                  {row.federal_effective_rate_pct != null && row.federal_effective_rate_pct > 0
                    ? `${row.federal_effective_rate_pct}%`
                    : '—'}
                </td>
                <td className="bracket-cell"><FederalBracketLines brackets={row.federal_tax_brackets} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectionsYearDetailTable({ rows, household, projectionMeta }) {
  if (!rows || rows.length === 0) return null;
  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  const fsLabel = filingStatusLabel(household?.filing_status);
  const useRmi = projectionMeta?.use_required_monthly_income;
  return (
    <div className="projections-detail-grid">
      <h3 className="projections-detail-title">Annual detail (cash flow and taxable income)</h3>
      <p className="projections-detail-intro">
        Aligns with the chart above; <strong>Net worth</strong> matches the net worth chart. <strong>Ordinary income (before ded.)</strong> is wages + bonus + RMD + savings draws (ordinary) + estimated taxable Social Security (Pub. 915–style; filing: {fsLabel}). See the federal tax table below for standard deduction, taxable income after deduction, and estimated federal liability. Not tax advice.
        {useRmi && (
          <> In required-income mode, retirement spending is your required monthly amount (with expense growth); income is funded Social Security → RMD → wages/bonus → withdrawals from non-RMD savings.</>
        )}
      </p>
      <div className="projections-detail-table-wrap">
        <table className="projections-detail-table">
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col" className="num">{p1Name} age</th>
              <th scope="col" className="num">{p2Name} age</th>
              <th scope="col" className="num">Net worth</th>
              <th scope="col" className="num">Income</th>
              <th scope="col" className="num">{p1Name} wages</th>
              <th scope="col" className="num">{p2Name} wages</th>
              <th scope="col" className="num">Bonus</th>
              <th scope="col" className="num">SS {p1Name}</th>
              <th scope="col" className="num">SS {p2Name}</th>
              <th scope="col" className="num">SS total</th>
              <th scope="col" className="num">Taxable SS (est.)</th>
              <th scope="col" className="num">RMD</th>
              <th scope="col" className="num">RMD {p1Name}</th>
              <th scope="col" className="num">RMD {p2Name}</th>
              {useRmi && <th scope="col" className="num">From savings</th>}
              {useRmi && <th scope="col" className="num">Funding shortfall</th>}
              <th scope="col" className="num">Ordinary income (before ded.)</th>
              <th scope="col" className="num">Expenses</th>
              <th scope="col" className="num">Savings</th>
              <th scope="col" className="num">401(k) contrib.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td className="num">{row.p1_age_eoy ?? '—'}</td>
                <td className="num">{row.p2_age_eoy ?? '—'}</td>
                <td className="num">{formatCurrency(row.net_worth)}</td>
                <td className="num">{formatCurrency(row.income)}</td>
                <td className="num">{formatCurrency(row.income_wage_p1)}</td>
                <td className="num">{formatCurrency(row.income_wage_p2)}</td>
                <td className="num">{formatCurrency(row.income_bonus)}</td>
                <td className="num">{formatCurrency(row.income_ss_p1)}</td>
                <td className="num">{formatCurrency(row.income_ss_p2)}</td>
                <td className="num">{formatCurrency(row.income_ss_total)}</td>
                <td className="num">{formatCurrency(row.taxable_ss_estimate)}</td>
                <td className="num">{formatCurrency(row.rmd)}</td>
                <td className="num">{formatCurrency(row.rmd_p1)}</td>
                <td className="num">{formatCurrency(row.rmd_p2)}</td>
                {useRmi && <td className="num">{formatCurrency(row.income_from_savings_draw)}</td>}
                {useRmi && (
                  <td className="num">
                    {(row.retirement_funding_shortfall ?? 0) > 0 ? formatCurrency(row.retirement_funding_shortfall) : '—'}
                  </td>
                )}
                <td className="num">{formatCurrency(row.taxable_income_before_deduction ?? row.taxable_income_estimate)}</td>
                <td className="num">{formatCurrency(row.expenses)}</td>
                <td className="num">{formatCurrency(row.savings)}</td>
                <td className="num">{formatCurrency(row.contributions_401k)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncomeVsExpensesChart({ data, household, projectionMeta }) {
  if (!data || data.length === 0) return null;
  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  return (
    <div className="card projections-chart-card">
      <h2>Income vs expenses by year</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 52 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis
              dataKey="year"
              height={52}
              interval={0}
              minTickGap={18}
              tick={(props) => <YearAgeAxisTick {...props} household={household} data={data} />}
            />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [formatCurrency(value)]}
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
                    <strong>
                      Year {label} · {p1Name} age {p.p1_age_eoy ?? '—'} · {p2Name} age {p.p2_age_eoy ?? '—'}
                    </strong>
                    <div>Income: {formatCurrency(p.income)}</div>
                    {(p.rmd ?? 0) > 0 && (
                      <div className="tooltip-rmd">
                        RMD (total): {formatCurrency(p.rmd)}
                        {(p.rmd_p1 ?? 0) > 0 && ` · ${p1Name}: ${formatCurrency(p.rmd_p1)}`}
                        {(p.rmd_p2 ?? 0) > 0 && ` · ${p2Name}: ${formatCurrency(p.rmd_p2)}`}
                      </div>
                    )}
                    <div>Expenses: {formatCurrency(p.expenses)}</div>
                    {(p.income_from_savings_draw ?? 0) > 0 && (
                      <div>From savings (draw): {formatCurrency(p.income_from_savings_draw)}</div>
                    )}
                    {(p.retirement_funding_shortfall ?? 0) > 0 && (
                      <div className="tooltip-rmd">Funding shortfall: {formatCurrency(p.retirement_funding_shortfall)}</div>
                    )}
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
            <Bar dataKey="income" name="Income (incl. RMD)" fill="#0d5c4a" radius={[2, 2, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#5a6b64" radius={[2, 2, 0, 0]} />
            <Line type="monotone" dataKey="rmd" name="RMD" stroke="#a67c52" strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ProjectionsYearDetailTable rows={data} household={household} projectionMeta={projectionMeta} />
      <ProjectionsTaxDetailTable rows={data} projectionMeta={projectionMeta} household={household} />
    </div>
  );
}

export default function ProjectionsPage() {
  const allowZeroRates = import.meta.env.VITE_DEBUG != null && String(import.meta.env.VITE_DEBUG).trim() !== '';
  const minGrowth = allowZeroRates ? 0 : 0.01;
  const minIndexPct = allowZeroRates ? 0 : 0.01;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [years, setYears] = useState(30);
  const [growthPct, setGrowthPct] = useState(5);
  const [expenseGrowthPct, setExpenseGrowthPct] = useState(2.5);
  const [ssiGrowthPct, setSsiGrowthPct] = useState(2.5);
  const [requiredMonthly, setRequiredMonthly] = useState('');

  const syncFormFromProjectionResponse = (payload) => {
    if (!payload) return;
    const y = payload.projection_horizon_years;
    if (y != null && Number.isFinite(Number(y))) {
      const n = parseInt(String(y), 10);
      if (Number.isFinite(n)) setYears(Math.min(50, Math.max(5, n)));
    }
    const g = payload.growth_pct;
    if (g != null && Number.isFinite(Number(g))) setGrowthPct(Math.min(20, Math.max(minGrowth, Number(g))));
    const eg = payload.expense_growth_pct;
    if (eg != null && Number.isFinite(Number(eg))) {
      setExpenseGrowthPct(Math.min(10, Math.max(minIndexPct, Number(eg))));
    }
    const sg = payload.ssi_growth_pct;
    if (sg != null && Number.isFinite(Number(sg))) {
      setSsiGrowthPct(Math.min(10, Math.max(minIndexPct, Number(sg))));
    }
    const rmi = payload.required_monthly_income_retirement;
    if (rmi != null && rmi > 0) setRequiredMonthly(String(rmi));
    else setRequiredMonthly('');
  };

  const load = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const res = await getProjections();
      setData(res.data);
      syncFormFromProjectionResponse(res.data);
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

  const handleApply = async (e) => {
    e.preventDefault();
    const trimmed = requiredMonthly.trim();
    let rmiPayload = null;
    if (trimmed !== '') {
      const n = parseFloat(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        setMessage('Required monthly income must be empty or a non-negative number.');
        return;
      }
      if (n > 0) rmiPayload = n;
    }
    try {
      setLoading(true);
      setMessage(null);
      await updateHousehold({
        required_monthly_income_retirement: rmiPayload,
        projection_horizon_years: years,
        projection_growth_pct: growthPct,
        projection_expense_growth_pct: expenseGrowthPct,
        projection_ssi_growth_pct: ssiGrowthPct,
      });
      const res = await getProjections();
      setData(res.data);
      syncFormFromProjectionResponse(res.data);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update or load projections');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const chartData = data?.by_year?.map((row) => ({
    ...row,
    year: row.year,
    net_worth: row.net_worth,
    income: row.income,
    expenses: row.expenses,
    savings: row.savings,
    rmd: row.rmd ?? 0,
    rmd_p1: row.rmd_p1 ?? 0,
    rmd_p2: row.rmd_p2 ?? 0,
    income_wage_p1: row.income_wage_p1 ?? 0,
    income_wage_p2: row.income_wage_p2 ?? 0,
    income_bonus: row.income_bonus ?? 0,
    income_ss_total: row.income_ss_total ?? 0,
    taxable_ss_estimate: row.taxable_ss_estimate ?? 0,
    taxable_income_estimate: row.taxable_income_estimate ?? 0,
    taxable_income_before_deduction: row.taxable_income_before_deduction ?? row.taxable_income_estimate ?? 0,
    taxable_ss_plus_rmd: row.taxable_ss_plus_rmd ?? 0,
    standard_deduction_estimate: row.standard_deduction_estimate ?? 0,
    taxable_income_after_standard_deduction: row.taxable_income_after_standard_deduction ?? 0,
    taxable_ss_rmd_minus_std_ded: row.taxable_ss_rmd_minus_std_ded ?? 0,
    federal_tax_ordinary_estimate: row.federal_tax_ordinary_estimate ?? 0,
    federal_tax_brackets: row.federal_tax_brackets ?? [],
    federal_effective_rate_pct: row.federal_effective_rate_pct ?? 0,
    p1_age_eoy: row.p1_age_eoy,
    p2_age_eoy: row.p2_age_eoy,
    contributions_401k: row.contributions_401k ?? 0,
    p1_retired: row.p1_retired,
    p2_retired: row.p2_retired,
    income_ss_p1: row.income_ss_p1,
    income_ss_p2: row.income_ss_p2,
    income_from_savings_draw: row.income_from_savings_draw ?? 0,
    retirement_funding_shortfall: row.retirement_funding_shortfall ?? 0,
  })) ?? [];

  return (
    <div className="page-scroll">
      <h1 className="page-title">Projections</h1>
      <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.95rem' }}>
        Net worth and income vs expenses over time. Uses current account balances, income, and expense settings. Set retirement dates on Household and 401(k) on Income for accurate savings. Optional <strong>Required monthly income</strong> sets retirement spending and funds it in order: Social Security, RMDs, wages/bonus (if still working), then withdrawals from non-RMD savings. Leave it blank to use retirement expense categories plus mortgage instead. Below the income chart, annual tables list cash-flow detail, then estimated federal taxable income (after standard deduction) and marginal federal tax by bracket. Portfolio growth applies each year to non-asset accounts; asset-type accounts use expected depreciation from the Accounts page (balance × (1 − depreciation%) each year). Traditional IRA and traditional 401(k) balances drive projected RMDs (IRS Uniform Lifetime Table; included in income). <strong>Expense growth</strong> inflates required income, category expenses, and the P2 pre-Medicare bridge each year. <strong>SSI growth</strong> compounds projected Social Security only after each person retires. Use <strong>Save &amp; refresh</strong> to store these assumptions (and required monthly income) in the database.
      </p>

      <div className="card projections-controls-card">
        <h2>Assumptions</h2>
        {allowZeroRates && (
          <p style={{ fontSize: '0.85rem', color: '#6b7c75', marginBottom: '0.5rem' }}>DEBUG: 0% portfolio growth and 0% expense/SSI growth allowed for testing.</p>
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
                inputMode="decimal"
                min={minGrowth}
                max={20}
                step="any"
                value={growthPct}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '' || raw === '-') return;
                  const v = parseFloat(raw);
                  if (!Number.isFinite(v)) return;
                  setGrowthPct(Math.min(20, Math.max(minGrowth, v)));
                }}
                title={allowZeroRates ? 'DEBUG: 0% allowed for testing' : 'Portfolio growth on non-asset accounts; any percentage from 0.01 to 20.'}
              />
            </div>
            <div className="form-group">
              <label htmlFor="projections-expense-growth">Expense growth (% per year)</label>
              <input
                id="projections-expense-growth"
                type="number"
                inputMode="decimal"
                min={minIndexPct}
                max={10}
                step="any"
                value={expenseGrowthPct}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '' || raw === '-') return;
                  const v = parseFloat(raw);
                  if (!Number.isFinite(v)) return;
                  setExpenseGrowthPct(Math.min(10, Math.max(minIndexPct, v)));
                }}
                title={allowZeroRates ? 'DEBUG: 0% allowed. Inflates expenses, required monthly income in retirement, and P2 pre-Medicare bridge.' : 'Inflates expenses, required monthly income in retirement, and P2 pre-Medicare bridge (default ~2.5%). 0.01% to 10%.'}
              />
            </div>
            <div className="form-group">
              <label htmlFor="projections-ssi-growth">SSI growth (% per year)</label>
              <input
                id="projections-ssi-growth"
                type="number"
                inputMode="decimal"
                min={minIndexPct}
                max={10}
                step="any"
                value={ssiGrowthPct}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '' || raw === '-') return;
                  const v = parseFloat(raw);
                  if (!Number.isFinite(v)) return;
                  setSsiGrowthPct(Math.min(10, Math.max(minIndexPct, v)));
                }}
                title={allowZeroRates ? 'DEBUG: 0% allowed. Compounds on projected Social Security after each person’s retirement year.' : 'Annual increase on Social Security benefits after retirement (default ~2.5%). 0.01% to 10%.'}
              />
            </div>
            <div className="form-group">
              <label htmlFor="projections-rmi">Required monthly income (retirement)</label>
              <input
                id="projections-rmi"
                type="number"
                min={0}
                step={100}
                placeholder="Use expense categories instead"
                value={requiredMonthly}
                onChange={(e) => setRequiredMonthly(e.target.value)}
                title="If set, retirement spending uses this monthly amount (with expense growth from the year expenses switch to retirement). Income is funded: Social Security → RMD → wages/bonus → non-RMD savings. Clear to use retirement amounts from the Expenses page plus mortgage."
              />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">Save &amp; refresh</button>
            </div>
          </div>
        </form>
      </div>

      {message && <div className="error-message">{message}</div>}
      {loading && !data && <p className="loading-message">Loading projections…</p>}

      {data && (
        <>
          <ProjectionsSummary data={data} />
          <NetWorthChart data={chartData} target25x={data.target_25x_retirement} household={data.household} />
          <IncomeVsExpensesChart data={chartData} household={data.household} projectionMeta={data.projection_meta} />
        </>
      )}
    </div>
  );
}
