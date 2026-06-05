import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
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
  Area,
  AreaChart,
} from 'recharts';
import {
  getProjections,
  getScenarios,
} from '../api/api';
import PrecisionBadge from '../components/PrecisionBadge';
import AssumptionsPanel from '../components/AssumptionsPanel';
import AccountBalanceChart from '../components/charts/AccountBalanceChart';
import TaxableIncomeChart from '../components/charts/TaxableIncomeChart';
import FederalTaxChart from '../components/charts/FederalTaxChart';
import SpendingSourceChart from '../components/charts/SpendingSourceChart';
import YearDetailDrawer from '../components/YearDetailDrawer';
import { formatCurrency } from '../utils/formatCurrency';
import { yearsToCsv } from '../utils/csvExport';

const PROJECTION_CHART_TABS = [
  { id: 'balances', label: 'Balances' },
  { id: 'taxable', label: 'Taxable Income' },
  { id: 'federal', label: 'Federal Tax' },
  { id: 'spending', label: 'Spending Sources' },
];

export function downloadProjectionsCsv(years) {
  const blob = new Blob([yearsToCsv(years)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `retirementhub-projection-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ProjectionDetailCharts({ years, activeTab, onTabChange, onYearClick }) {
  if (!years?.length) return null;
  return (
    <div className="card projections-chart-card">
      <h2>Year-by-year detail charts</h2>
      <p className="projections-chart-intro">
        Click a year on any chart to open a side panel with full income, tax, spending, and balance detail for that year.
      </p>
      <div className="projection-chart-tabs" role="tablist" aria-label="Projection detail charts">
        {PROJECTION_CHART_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`projection-chart-tab${activeTab === tab.id ? ' projection-chart-tab-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {activeTab === 'balances' && <AccountBalanceChart years={years} onYearClick={onYearClick} />}
        {activeTab === 'taxable' && <TaxableIncomeChart years={years} onYearClick={onYearClick} />}
        {activeTab === 'federal' && <FederalTaxChart years={years} onYearClick={onYearClick} />}
        {activeTab === 'spending' && <SpendingSourceChart years={years} onYearClick={onYearClick} />}
      </div>
    </div>
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

function SavingsAssetsProjectionsChart({ data, target25x }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="card projections-chart-card">
      <h2>Projections</h2>
      <p className="projections-chart-intro">
        <strong>Savings</strong> is all non-asset accounts (retirement, taxable, cash, etc.); <strong>Assets</strong> is balances
        entered as the asset type on the Accounts page. The stack height is net worth—watch the green band shrink as accounts
        fund spending; assets only change by depreciation here, so a thin green band signals you may need to liquidate or borrow against hard assets.
      </p>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} interval={0} minTickGap={16} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 12 }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload;
                const fin = row?.financial_balance ?? 0;
                const hard = row?.hard_asset_balance ?? 0;
                const total = row?.net_worth ?? fin + hard;
                return (
                  <div className="chart-tooltip">
                    <strong>Year {label}</strong>
                    <div>Savings: {formatCurrency(fin)}</div>
                    <div>Assets: {formatCurrency(hard)}</div>
                    <div>Total net worth: {formatCurrency(total)}</div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="financial_balance"
              name="Savings"
              stackId="nw"
              stroke="#0d5c4a"
              fill="#0d5c4a"
              fillOpacity={0.82}
            />
            <Area
              type="monotone"
              dataKey="hard_asset_balance"
              name="Assets"
              stackId="nw"
              stroke="#7a6238"
              fill="#c4a35a"
              fillOpacity={0.88}
            />
            {target25x != null && target25x > 0 && (
              <ReferenceLine y={target25x} stroke="#0d5c4a" strokeDasharray="5 5" label={{ value: '25× target', position: 'right', fontSize: 11 }} />
            )}
            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TaxValueCell({ amount, provenance }) {
  if (amount == null || Number.isNaN(amount)) return '—';
  const p = provenance;
  return (
    <span className="tax-value-with-badge">
      <span>{formatCurrency(amount)}</span>
      {p && (
        <PrecisionBadge
          source={p.source}
          yearUsed={p.year_used}
          inflationApplied={p.inflation_applied}
          modified={p.modified}
        />
      )}
    </span>
  );
}

export function latestPublishedYearFromRows(rows) {
  if (!rows?.length) return null;
  let max = null;
  for (const row of rows) {
    const prov = row.tax_param_provenance;
    if (!prov) continue;
    for (const key of ['standard_deduction', 'brackets', 'medicare_part_b']) {
      const entry = prov[key];
      if (entry && entry.inflation_applied === false && entry.year_used != null) {
        max = max == null ? entry.year_used : Math.max(max, entry.year_used);
      }
    }
  }
  return max;
}

function HorizonPastPublishedBanner({ data }) {
  const latest = latestPublishedYearFromRows(data?.by_year);
  const endYear = data?.end_year;
  if (latest == null || endYear == null || endYear <= latest) return null;
  return (
    <div className="banner banner-info">
      Beyond {latest} this projection uses inflation-adjusted estimates.
      <Link to="/tax-details">Add or edit values on Tax details</Link> to override.
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

function ProjectionsTaxDetailTable({ rows, projectionMeta, household, onYearSelect }) {
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
              <th scope="col" className="num">Medicare Part B (mo.)</th>
              <th scope="col" className="num">Effective rate</th>
              <th scope="col" className="bracket-col">Marginal tax by bracket</th>
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
                <td className="num">{row.p1_age_eoy ?? '—'}</td>
                <td className="num">{row.p2_age_eoy ?? '—'}</td>
                <td className="num">
                  <TaxValueCell
                    amount={row.standard_deduction_estimate}
                    provenance={row.tax_param_provenance?.standard_deduction}
                  />
                </td>
                <td className="num">{formatCurrency(row.taxable_income_before_deduction ?? row.taxable_income_estimate)}</td>
                <td className="num">{formatCurrency(row.taxable_income_after_standard_deduction)}</td>
                <td className="num">{formatCurrency(row.taxable_ss_plus_rmd)}</td>
                <td className="num">{formatCurrency(row.taxable_ss_rmd_minus_std_ded)}</td>
                <td className="num">
                  <TaxValueCell
                    amount={row.federal_tax_ordinary_estimate}
                    provenance={row.tax_param_provenance?.brackets}
                  />
                </td>
                <td className="num">
                  <TaxValueCell
                    amount={row.medicare_part_b_monthly_estimate}
                    provenance={row.tax_param_provenance?.medicare_part_b}
                  />
                </td>
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

function ProjectionsYearDetailTable({ rows, household, projectionMeta, onYearSelect }) {
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

function PlanningInsightsCard({ meta }) {
  const scores = meta?.planning_scores;
  const ss = meta?.ss_comparison;
  if (!scores && !ss) return null;
  return (
    <div className="card projections-summary-card">
      <h2>Planning insights</h2>
      {scores && (
        <div className="projections-summary-grid">
          <div>
            <span className="summary-label">Lifetime federal tax</span>
            <span className="summary-value">{formatCurrency(scores.lifetime_total_tax)}</span>
          </div>
          <div>
            <span className="summary-label">RMD risk</span>
            <span className="summary-value">{scores.rmd_risk}</span>
          </div>
          <div>
            <span className="summary-label">Flexibility score</span>
            <span className="summary-value">{scores.flexibility_score}/100</span>
          </div>
          <div>
            <span className="summary-label">Peak RMD</span>
            <span className="summary-value">
              {scores.peak_rmd_year != null
                ? `${formatCurrency(scores.peak_rmd)} (${scores.peak_rmd_year})`
                : '—'}
            </span>
          </div>
        </div>
      )}
      {scores?.insights?.length > 0 && (
        <ul className="projections-insights-list">
          {scores.insights.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
      {ss && (
        <p className="projections-summary-note" style={{ marginTop: '0.75rem' }}>
          SS lifetime (est.): P1 {formatCurrency(ss.p1?.lifetime_benefits)} (claim {ss.p1?.claim_age}, breakeven vs 62:{' '}
          {ss.p1?.breakeven_age_vs_62 ?? '—'}) · P2 {formatCurrency(ss.p2?.lifetime_benefits)} (claim {ss.p2?.claim_age})
        </p>
      )}
    </div>
  );
}

function IncomeVsExpensesChart({ data, household, projectionMeta, onYearSelect }) {
  if (!data || data.length === 0) return null;
  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  return (
    <div className="card projections-chart-card">
      <h2>Income vs expenses by year</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} interval={0} minTickGap={16} />
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
                    <strong>Year {label}</strong>
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
                    <div>Income minus expenses: {formatCurrency(p.savings)}</div>
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
      <div className="projections-export-row">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => downloadProjectionsCsv(data)}
        >
          Export CSV
        </button>
      </div>
      <ProjectionsYearDetailTable
        rows={data}
        household={household}
        projectionMeta={projectionMeta}
        onYearSelect={onYearSelect}
      />
      <ProjectionsTaxDetailTable
        rows={data}
        projectionMeta={projectionMeta}
        household={household}
        onYearSelect={onYearSelect}
      />
    </div>
  );
}

export default function ProjectionsPage() {
  const [data, setData] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [detailChartTab, setDetailChartTab] = useState('balances');

  const loadScenarios = async () => {
    try {
      const res = await getScenarios();
      const list = res.data || [];
      setScenarios(list);
      const def = list.find((s) => s.is_default) || list[0];
      if (def) {
        setSelectedScenarioId(def.id);
        return def.id;
      }
    } catch {
      setScenarios([]);
    }
    return null;
  };

  const load = async (scenarioId = selectedScenarioId) => {
    try {
      setLoading(true);
      setMessage(null);
      const params = {};
      if (scenarioId != null) params.scenario_id = scenarioId;
      const res = await getProjections(params);
      setData(res.data);
      if (res.data?.scenario?.id) setSelectedScenarioId(res.data.scenario.id);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to load projections');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const sid = await loadScenarios();
      await load(sid);
    })();
  }, []);

  const handleScenarioChange = async (id) => {
    const sid = parseInt(id, 10);
    setSelectedScenarioId(sid);
    await load(sid);
  };

  const compareLink =
    scenarios.length >= 2
      ? `/scenarios/compare?ids=${scenarios.map((s) => s.id).join(',')}`
      : null;

  const chartData = data?.by_year?.map((row) => {
    const b = row.balances_by_bucket || {};
    const src = row.spending_sources || {};
    return {
      ...row,
      year: row.year,
      net_worth: row.net_worth,
      financial_balance: row.financial_balance ?? 0,
      hard_asset_balance: row.hard_asset_balance ?? 0,
      bucket_pre_tax: b.pre_tax ?? 0,
      bucket_roth: b.roth ?? 0,
      bucket_taxable: b.taxable ?? 0,
      bucket_cash: b.cash ?? 0,
      bucket_hsa: b.hsa ?? 0,
      spending_ss: src.social_security ?? 0,
      spending_traditional: src.traditional_ira ?? 0,
      spending_taxable: src.taxable ?? 0,
      spending_roth: src.roth ?? 0,
      spending_cash: src.cash ?? 0,
      federal_tax_total: row.federal_tax_total ?? row.federal_tax_ordinary_estimate ?? 0,
      roth_conversion: row.roth_conversion ?? 0,
      rmd: row.rmd ?? 0,
      income_from_savings_draw: row.income_from_savings_draw ?? 0,
      retirement_funding_shortfall: row.retirement_funding_shortfall ?? 0,
    };
  }) ?? [];

  const byYear = data?.by_year ?? [];
  const selectedRow = selectedYear != null ? byYear.find((y) => y.year === selectedYear) : null;

  return (
    <div className="page-scroll">
      <h1 className="page-title">Projections</h1>
      <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.95rem' }}>
        Charts and tables for the selected planning scenario. Edit assumptions on the{' '}
        <Link to="/scenarios">Scenarios</Link> page. Set retirement dates on Household and 401(k) on Income for accurate savings.
      </p>

      <div className="card projections-controls-card">
        <h2>Active scenario</h2>
        {scenarios.length > 0 ? (
          <div className="form-row" style={{ marginBottom: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="scenario-select">Scenario</label>
              <select
                id="scenario-select"
                value={selectedScenarioId ?? ''}
                onChange={(e) => handleScenarioChange(e.target.value)}
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.is_default ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <Link to="/scenarios" className="btn btn-secondary">Manage scenarios</Link>
            </div>
            {selectedScenarioId != null && (
              <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                <Link to={`/scenarios/${selectedScenarioId}/edit`} className="btn btn-secondary">Edit scenario</Link>
              </div>
            )}
          </div>
        ) : (
          <p>
            No scenarios yet. <Link to="/scenarios/new">Create a scenario</Link> to customize projections.
          </p>
        )}
        {compareLink && (
          <p className="projections-summary-note">
            <Link to={compareLink}>Compare {scenarios.length} scenarios →</Link>
          </p>
        )}
      </div>

      {message && <div className="error-message">{message}</div>}
      {loading && !data && <p className="loading-message">Loading projections…</p>}

      {data && (
        <>
          {data.scenario && (
            <p className="projections-summary-note" style={{ marginBottom: '0.5rem' }}>
              Active scenario: <strong>{data.scenario.name}</strong>
            </p>
          )}
          <HorizonPastPublishedBanner data={data} />
          <ProjectionsSummary data={data} />
          <PlanningInsightsCard meta={data.projection_meta} />
          <SavingsAssetsProjectionsChart data={chartData} target25x={data.target_25x_retirement} />
          <ProjectionDetailCharts
            years={byYear}
            activeTab={detailChartTab}
            onTabChange={setDetailChartTab}
            onYearClick={setSelectedYear}
          />
          <IncomeVsExpensesChart
            data={chartData}
            household={data.household}
            projectionMeta={data.projection_meta}
            onYearSelect={setSelectedYear}
          />
          <AssumptionsPanel />
          <YearDetailDrawer
            year={selectedYear}
            row={selectedRow}
            household={data.household}
            onClose={() => setSelectedYear(null)}
          />
        </>
      )}
    </div>
  );
}
