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
  updateHousehold,
  getScenarios,
  updateScenarioAssumptions,
  createScenario,
  compareScenarios,
} from '../api/api';
import PrecisionBadge from '../components/PrecisionBadge';
import AssumptionsPanel from '../components/AssumptionsPanel';

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
              <th scope="col" className="num">Medicare Part B (mo.)</th>
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

function BucketBalancesChart({ data }) {
  if (!data?.length) return null;
  return (
    <div className="card projections-chart-card">
      <h2>Balances by tax bucket</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Area type="monotone" dataKey="bucket_pre_tax" name="Traditional" stackId="b" fill="#4a6fa5" stroke="#4a6fa5" />
            <Area type="monotone" dataKey="bucket_roth" name="Roth" stackId="b" fill="#2d8a6e" stroke="#2d8a6e" />
            <Area type="monotone" dataKey="bucket_taxable" name="Taxable" stackId="b" fill="#7a9e7e" stroke="#7a9e7e" />
            <Area type="monotone" dataKey="bucket_cash" name="Cash" stackId="b" fill="#a8c4b8" stroke="#a8c4b8" />
            <Area type="monotone" dataKey="bucket_hsa" name="HSA" stackId="b" fill="#c9b87a" stroke="#c9b87a" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SpendingSourcesChart({ data }) {
  if (!data?.length) return null;
  const hasSources = data.some((r) => (r.spending_ss ?? 0) > 0 || (r.spending_traditional ?? 0) > 0);
  if (!hasSources) return null;
  return (
    <div className="card projections-chart-card">
      <h2>Retirement spending sources</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Area type="monotone" dataKey="spending_ss" name="Social Security" stackId="s" fill="#3d6b8a" />
            <Area type="monotone" dataKey="spending_traditional" name="Traditional / RMD" stackId="s" fill="#a67c52" />
            <Area type="monotone" dataKey="spending_taxable" name="Taxable" stackId="s" fill="#6b8f71" />
            <Area type="monotone" dataKey="spending_roth" name="Roth" stackId="s" fill="#0d5c4a" />
            <Area type="monotone" dataKey="spending_cash" name="Cash" stackId="s" fill="#9ab5a8" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TaxesAndRmdChart({ data }) {
  if (!data?.length) return null;
  return (
    <div className="card projections-chart-card">
      <h2>Taxes and RMDs</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="federal_tax_total" name="Federal tax" fill="#5a6b64" radius={[2, 2, 0, 0]} />
            <Line type="monotone" dataKey="rmd" name="RMD" stroke="#a67c52" strokeWidth={2} />
            <Line type="monotone" dataKey="roth_conversion" name="Roth conversion" stroke="#2d6a4f" strokeWidth={2} strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ScenarioCompareGrid({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className="card">
      <h2>Scenario comparison</h2>
      <div className="projections-detail-table-wrap">
        <table className="projections-detail-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th className="num">P1 retire yr</th>
              <th className="num">SS claim P1/P2</th>
              <th className="num">Roth strategy</th>
              <th className="num">Lifetime tax</th>
              <th className="num">Ending net worth</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.scenario_id}>
                <td>{r.scenario_name}</td>
                <td className="num">{r.p1_retirement_year ?? '—'}</td>
                <td className="num">
                  {r.p1_ss_claim_age ?? '—'} / {r.p2_ss_claim_age ?? '—'}
                </td>
                <td className="num">{r.roth_strategy ?? '—'}</td>
                <td className="num">{formatCurrency(r.lifetime_total_tax)}</td>
                <td className="num">{formatCurrency(r.ending_net_worth)}</td>
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

function IncomeVsExpensesChart({ data, household, projectionMeta }) {
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
      <ProjectionsYearDetailTable rows={data} household={household} projectionMeta={projectionMeta} />
      <ProjectionsTaxDetailTable rows={data} projectionMeta={projectionMeta} household={household} />
    </div>
  );
}

const CLAIM_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70];
const WITHDRAWAL_STRATEGIES = [
  { value: 'conservative', label: 'Conservative (cash → taxable → trad → Roth)' },
  { value: 'tax_aware', label: 'Tax-aware' },
  { value: 'custom', label: 'Custom order' },
];
const ROTH_STRATEGIES = [
  { value: 'none', label: 'None' },
  { value: 'fixed', label: 'Fixed annual amount' },
  { value: 'fill_bracket', label: 'Fill tax bracket' },
  { value: 'fill_income', label: 'Fill to income target' },
  { value: 'irmaa_aware', label: 'IRMAA-aware cap' },
];

export default function ProjectionsPage() {
  const allowZeroRates = import.meta.env.VITE_DEBUG != null && String(import.meta.env.VITE_DEBUG).trim() !== '';
  const minGrowth = allowZeroRates ? 0 : 0.01;
  const minIndexPct = allowZeroRates ? 0 : 0.01;

  const [data, setData] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [compareRows, setCompareRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [years, setYears] = useState(30);
  const [growthPct, setGrowthPct] = useState(5);
  const [expenseGrowthPct, setExpenseGrowthPct] = useState(2.5);
  const [ssiGrowthPct, setSsiGrowthPct] = useState(2.5);
  const [requiredMonthly, setRequiredMonthly] = useState('');
  const [retirementAgeP1, setRetirementAgeP1] = useState('');
  const [retirementAgeP2, setRetirementAgeP2] = useState('');
  const [ssClaimP1, setSsClaimP1] = useState('67');
  const [ssClaimP2, setSsClaimP2] = useState('67');
  const [annualSpending, setAnnualSpending] = useState('');
  const [withdrawalStrategy, setWithdrawalStrategy] = useState('conservative');
  const [rothStrategy, setRothStrategy] = useState('none');
  const [rothFixedAmount, setRothFixedAmount] = useState('');
  const [rothTargetBracket, setRothTargetBracket] = useState('22');
  const [rothMaxIncome, setRothMaxIncome] = useState('');

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

  const syncScenarioForm = (scenarioRow) => {
    if (!scenarioRow) return;
    if (scenarioRow.retirement_age_p1 != null) setRetirementAgeP1(String(scenarioRow.retirement_age_p1));
    if (scenarioRow.retirement_age_p2 != null) setRetirementAgeP2(String(scenarioRow.retirement_age_p2));
    if (scenarioRow.social_security_claim_age_p1 != null) setSsClaimP1(String(scenarioRow.social_security_claim_age_p1));
    if (scenarioRow.social_security_claim_age_p2 != null) setSsClaimP2(String(scenarioRow.social_security_claim_age_p2));
    if (scenarioRow.annual_spending_target != null && scenarioRow.annual_spending_target > 0) {
      setAnnualSpending(String(scenarioRow.annual_spending_target));
      setRequiredMonthly(String(Math.round(scenarioRow.annual_spending_target / 12)));
    }
    if (scenarioRow.portfolio_return_rate != null) setGrowthPct(Number(scenarioRow.portfolio_return_rate));
    if (scenarioRow.inflation_rate != null) setExpenseGrowthPct(Number(scenarioRow.inflation_rate));
    if (scenarioRow.withdrawal_strategy) setWithdrawalStrategy(scenarioRow.withdrawal_strategy);
    if (scenarioRow.roth_conversion_strategy) setRothStrategy(scenarioRow.roth_conversion_strategy);
  };

  const loadScenarios = async () => {
    try {
      const res = await getScenarios();
      const list = res.data || [];
      setScenarios(list);
      const def = list.find((s) => s.is_default) || list[0];
      if (def) {
        setSelectedScenarioId(def.id);
        syncScenarioForm(def);
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
      syncFormFromProjectionResponse(res.data);
      if (res.data?.scenario?.id) setSelectedScenarioId(res.data.scenario.id);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to load projections');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadCompare = async () => {
    if (scenarios.length < 2) return;
    try {
      const ids = scenarios.map((s) => s.id);
      const res = await compareScenarios(ids);
      setCompareRows(res.data?.scenarios || []);
    } catch {
      setCompareRows([]);
    }
  };

  useEffect(() => {
    (async () => {
      const sid = await loadScenarios();
      await load(sid);
    })();
  }, []);

  useEffect(() => {
    if (scenarios.length >= 2) loadCompare();
  }, [scenarios, data]);

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
    const annual =
      annualSpending.trim() !== '' && Number.isFinite(parseFloat(annualSpending))
        ? parseFloat(annualSpending)
        : rmiPayload != null
          ? rmiPayload * 12
          : null;
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
      const scenarioId = selectedScenarioId;
      if (scenarioId != null) {
        await updateScenarioAssumptions(scenarioId, {
          retirement_age_p1: retirementAgeP1 !== '' ? parseInt(retirementAgeP1, 10) : null,
          retirement_age_p2: retirementAgeP2 !== '' ? parseInt(retirementAgeP2, 10) : null,
          social_security_claim_age_p1: parseInt(ssClaimP1, 10),
          social_security_claim_age_p2: parseInt(ssClaimP2, 10),
          annual_spending_target: annual,
          inflation_rate: expenseGrowthPct,
          portfolio_return_rate: growthPct,
          withdrawal_strategy: withdrawalStrategy,
          roth_conversion_strategy: rothStrategy,
          roth_plan: {
            strategy_type: rothStrategy,
            annual_fixed_amount:
              rothFixedAmount.trim() !== '' ? parseFloat(rothFixedAmount) : null,
            target_tax_bracket: parseInt(rothTargetBracket, 10),
            max_taxable_income: rothMaxIncome.trim() !== '' ? parseFloat(rothMaxIncome) : null,
          },
        });
      }
      await load(scenarioId);
      await loadScenarios();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update or load projections');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleScenarioChange = async (id) => {
    const sid = parseInt(id, 10);
    setSelectedScenarioId(sid);
    const row = scenarios.find((s) => s.id === sid);
    syncScenarioForm(row);
    await load(sid);
  };

  const handleDuplicateScenario = async () => {
    const name = window.prompt('Name for new scenario', 'Copy of ' + (data?.scenario?.name || 'Baseline'));
    if (!name?.trim()) return;
    try {
      setLoading(true);
      await createScenario({
        name: name.trim(),
        assumptions: {
          retirement_age_p1: retirementAgeP1 !== '' ? parseInt(retirementAgeP1, 10) : null,
          retirement_age_p2: retirementAgeP2 !== '' ? parseInt(retirementAgeP2, 10) : null,
          social_security_claim_age_p1: parseInt(ssClaimP1, 10),
          social_security_claim_age_p2: parseInt(ssClaimP2, 10),
          annual_spending_target: annualSpending !== '' ? parseFloat(annualSpending) : null,
          inflation_rate: expenseGrowthPct,
          portfolio_return_rate: growthPct,
          withdrawal_strategy: withdrawalStrategy,
          roth_conversion_strategy: rothStrategy,
        },
      });
      await loadScenarios();
      setMessage('Scenario created. Select it from the list.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to create scenario');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="page-scroll">
      <h1 className="page-title">Projections</h1>
      <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.95rem' }}>
        The <strong>Projections</strong> chart stacks savings (investment accounts) and hard assets so you can see savings drawdown vs. assets over time. Income vs expenses uses current account balances, income, and expense settings. Set retirement dates on Household and 401(k) on Income for accurate savings. Optional <strong>Required monthly income</strong> sets retirement spending and funds it in order: Social Security, RMDs, wages/bonus (if still working), then withdrawals from non-RMD savings. Leave it blank to use retirement expense categories plus mortgage instead. Below the income chart, annual tables list cash-flow detail, then estimated federal taxable income (after standard deduction) and marginal federal tax by bracket. Portfolio growth applies each year to non-asset accounts; asset-type accounts use expected depreciation from the Accounts page (balance × (1 − depreciation%) each year). Traditional IRA and traditional 401(k) balances drive projected RMDs (IRS Uniform Lifetime Table; included in income). <strong>Expense growth</strong> inflates required income, category expenses, and the P2 pre-Medicare bridge each year. <strong>SSI growth</strong> compounds projected Social Security only after each person retires. Use <strong>Save &amp; refresh</strong> to store these assumptions (and required monthly income) in the database.
      </p>

      <div className="card projections-controls-card">
        <h2>Planning scenario</h2>
        {scenarios.length > 0 && (
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
              <button type="button" className="btn btn-secondary" onClick={handleDuplicateScenario}>
                Duplicate as new scenario
              </button>
            </div>
          </div>
        )}
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Assumptions</h3>
        {allowZeroRates && (
          <p style={{ fontSize: '0.85rem', color: '#6b7c75', marginBottom: '0.5rem' }}>DEBUG: 0% portfolio growth and 0% expense/SSI growth allowed for testing.</p>
        )}
        <form onSubmit={handleApply} className="projections-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ret-age-p1">P1 retirement age</label>
              <input id="ret-age-p1" type="number" min={50} max={90} value={retirementAgeP1} onChange={(e) => setRetirementAgeP1(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="ret-age-p2">P2 retirement age</label>
              <input id="ret-age-p2" type="number" min={50} max={90} value={retirementAgeP2} onChange={(e) => setRetirementAgeP2(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="ss-p1">P1 SS claim age</label>
              <select id="ss-p1" value={ssClaimP1} onChange={(e) => setSsClaimP1(e.target.value)}>
                {CLAIM_AGES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="ss-p2">P2 SS claim age</label>
              <select id="ss-p2" value={ssClaimP2} onChange={(e) => setSsClaimP2(e.target.value)}>
                {CLAIM_AGES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
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
              <label htmlFor="annual-spending">Annual spending target</label>
              <input
                id="annual-spending"
                type="number"
                min={0}
                step={1000}
                placeholder="Or use monthly below"
                value={annualSpending}
                onChange={(e) => setAnnualSpending(e.target.value)}
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
              />
            </div>
            <div className="form-group">
              <label htmlFor="withdrawal-strategy">Withdrawal strategy</label>
              <select id="withdrawal-strategy" value={withdrawalStrategy} onChange={(e) => setWithdrawalStrategy(e.target.value)}>
                {WITHDRAWAL_STRATEGIES.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="roth-strategy">Roth conversion</label>
              <select id="roth-strategy" value={rothStrategy} onChange={(e) => setRothStrategy(e.target.value)}>
                {ROTH_STRATEGIES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            {rothStrategy === 'fixed' && (
              <div className="form-group">
                <label htmlFor="roth-fixed">Annual conversion $</label>
                <input id="roth-fixed" type="number" min={0} value={rothFixedAmount} onChange={(e) => setRothFixedAmount(e.target.value)} />
              </div>
            )}
            {rothStrategy === 'fill_bracket' && (
              <div className="form-group">
                <label htmlFor="roth-bracket">Target bracket %</label>
                <select id="roth-bracket" value={rothTargetBracket} onChange={(e) => setRothTargetBracket(e.target.value)}>
                  {[10, 12, 22, 24, 32].map((b) => (
                    <option key={b} value={b}>{b}%</option>
                  ))}
                </select>
              </div>
            )}
            {(rothStrategy === 'fill_income' || rothStrategy === 'irmaa_aware') && (
              <div className="form-group">
                <label htmlFor="roth-max-inc">Max taxable income</label>
                <input id="roth-max-inc" type="number" min={0} value={rothMaxIncome} onChange={(e) => setRothMaxIncome(e.target.value)} />
              </div>
            )}
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
          {data.scenario && (
            <p className="projections-summary-note" style={{ marginBottom: '0.5rem' }}>
              Active scenario: <strong>{data.scenario.name}</strong>
            </p>
          )}
          <HorizonPastPublishedBanner data={data} />
          <ProjectionsSummary data={data} />
          <PlanningInsightsCard meta={data.projection_meta} />
          {compareRows.length >= 2 && <ScenarioCompareGrid rows={compareRows} />}
          <SavingsAssetsProjectionsChart data={chartData} target25x={data.target_25x_retirement} />
          <BucketBalancesChart data={chartData} />
          <IncomeVsExpensesChart data={chartData} household={data.household} projectionMeta={data.projection_meta} />
          <SpendingSourcesChart data={chartData} />
          <TaxesAndRmdChart data={chartData} />
          <AssumptionsPanel />
        </>
      )}
    </div>
  );
}
