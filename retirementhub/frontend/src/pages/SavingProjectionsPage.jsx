import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getHousehold, getProjections, getScenarios } from '../api/api';
import { formatCurrency } from '../utils/formatCurrency';
import {
  accumulationSummary,
  buildChartRowsWithBeginning,
  chartYearDomain,
  accumulationEndYearFromRetirement,
  filterAccumulationYears,
  savingsAddedForYear,
  SAVINGS_CATEGORIES,
} from '../utils/savingProjections';

function SavingSummary({ summary, projection, household }) {
  if (!summary || !projection) return null;
  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  const meta = projection.projection_meta;
  return (
    <div className="card projections-summary-card">
      <h2>Accumulation summary</h2>
      <div className="projections-summary-grid">
        <div>
          <span className="summary-label">Projection period</span>
          <span className="summary-value">
            {summary.startYear != null
              ? `${summary.startYear} – ${summary.endYear}${
                  projection.retirement_year != null
                    ? ` (before retirement ${projection.retirement_year})`
                    : ''
                }`
              : '—'}
          </span>
        </div>
        <div>
          <span className="summary-label">Retirement year</span>
          <span className="summary-value">{projection.retirement_year ?? 'Not set'}</span>
        </div>
        <div>
          <span className="summary-label">Investment growth</span>
          <span className="summary-value">
            {projection.savings_projection_mode ? 'None (contributions only)' : `${projection.growth_pct}% / year`}
          </span>
        </div>
        <div>
          <span className="summary-label">Beginning balance (Accounts)</span>
          <span className="summary-value">{formatCurrency(summary.startingFinancialBalance)}</span>
        </div>
        <div>
          <span className="summary-label">Projected at retirement</span>
          <span className="summary-value">{formatCurrency(summary.endingFinancialBalance)}</span>
        </div>
        <div>
          <span className="summary-label">Net worth at retirement</span>
          <span className="summary-value">{formatCurrency(summary.endingNetWorth)}</span>
        </div>
        <div>
          <span className="summary-label">Total savings added</span>
          <span className="summary-value">{formatCurrency(summary.totalSavingsAdded)}</span>
        </div>
        <div>
          <span className="summary-label">Total 401(k) contributions</span>
          <span className="summary-value">{formatCurrency(summary.totalContributions401k)}</span>
        </div>
        <div>
          <span className="summary-label">Total surplus savings</span>
          <span className="summary-value">{formatCurrency(summary.totalSurplusSavings)}</span>
        </div>
        <div>
          <span className="summary-label">25× retirement target</span>
          <span className="summary-value">{formatCurrency(projection.target_25x_retirement)}</span>
        </div>
        <div>
          <span className="summary-label">Gap to target</span>
          <span className="summary-value">
            {summary.gapToTarget != null
              ? summary.gapToTarget <= 0
                ? 'Target reached'
                : formatCurrency(summary.gapToTarget)
              : '—'}
          </span>
        </div>
      </div>
      <p className="projections-summary-note">
        Beginning balances come from your Accounts page. Each year adds planned contributions and surplus to taxable
        savings from Income. Investment growth is not included in these projections.
      </p>
      {summary.startingByCategory?.length > 0 && (
        <div className="projections-summary-grid" style={{ marginTop: '0.75rem' }}>
          {summary.startingByCategory.map(({ key, label, value }) => (
            <div key={key}>
              <span className="summary-label">Beginning · {label}</span>
              <span className="summary-value">{formatCurrency(value)}</span>
            </div>
          ))}
        </div>
      )}
      {meta && (
        <p className="projections-summary-note" style={{ marginTop: '0.5rem' }}>
          {p1Name} retires {meta.p1_retirement_year ?? '—'} · {p2Name} retires {meta.p2_retirement_year ?? '—'}
          {summary.yearReachesTarget != null && (
            <>
              {' '}
              · Target reached in {summary.yearReachesTarget}
              {summary.reachesTargetBeforeRetirement ? ' (before retirement)' : ''}
            </>
          )}
        </p>
      )}
      {summary.endingByCategory?.length > 0 && (
        <div className="projections-summary-grid" style={{ marginTop: '0.75rem' }}>
          {summary.endingByCategory.map(({ key, label, value }) => (
            <div key={key}>
              <span className="summary-label">At retirement · {label}</span>
              <span className="summary-value">{formatCurrency(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SavingsByCategoryChart({ projection, rows, accumulationEndYear, target25x }) {
  const data = useMemo(
    () => buildChartRowsWithBeginning(projection, rows, accumulationEndYear),
    [projection, rows, accumulationEndYear]
  );
  const xDomain = useMemo(() => chartYearDomain(data), [data]);
  if (!data.length) return null;
  return (
    <div className="card projections-chart-card">
      <h2>Savings by account type</h2>
      <p className="projections-chart-intro">
        Balances by 401(k), HSA, Traditional IRA, Roth IRA, and Taxable (includes checking and savings accounts).
        The first point is your current account balances; later points add annual savings only (no investment growth).
      </p>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" type="number" domain={xDomain} allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(l) => `Year ${l}`} />
            <Legend />
            {SAVINGS_CATEGORIES.map((cat) => (
              <Area
                key={cat.key}
                type="monotone"
                dataKey={cat.key}
                name={cat.label}
                stackId="savings"
                fill={cat.fill}
                stroke={cat.fill}
              />
            ))}
            {target25x != null && target25x > 0 && (
              <ReferenceLine
                y={target25x}
                stroke="#a67c52"
                strokeDasharray="6 4"
                label={{ value: '25× target', position: 'right', fontSize: 11 }}
                ifOverflow="hidden"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SavingsGrowthChart({ projection, rows, accumulationEndYear, target25x }) {
  const chartData = useMemo(() => {
    const data = buildChartRowsWithBeginning(projection, rows, accumulationEndYear);
    return data.map((row) => ({
      ...row,
      total: SAVINGS_CATEGORIES.reduce((sum, cat) => sum + (row[cat.key] ?? 0), 0),
    }));
  }, [projection, rows, accumulationEndYear]);
  const xDomain = useMemo(() => chartYearDomain(chartData), [chartData]);
  if (!chartData.length) return null;
  return (
    <div className="card projections-chart-card">
      <h2>Total savings (contributions only)</h2>
      <p className="projections-chart-intro">
        Combined financial balances from current Accounts plus annual savings. Investment growth is not applied.
      </p>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" type="number" domain={xDomain} allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              labelFormatter={(l) => `Year ${l}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="total"
              name="Total savings"
              stroke="#2d8a6e"
              fill="#2d8a6e"
              fillOpacity={0.35}
            />
            {target25x != null && target25x > 0 && (
              <ReferenceLine
                y={target25x}
                stroke="#a67c52"
                strokeDasharray="6 4"
                label={{ value: '25× target', position: 'right', fontSize: 11 }}
                ifOverflow="hidden"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ContributionsChart({ rows, accumulationEndYear }) {
  const data = useMemo(() => {
    const capped =
      accumulationEndYear != null
        ? rows.filter((row) => Number(row.year) <= accumulationEndYear)
        : rows;
    return capped.map((row) => ({
        year: row.year,
        contributions_401k: row.contributions_401k ?? 0,
        contributions_ira_traditional: row.contributions_ira_traditional ?? 0,
        contributions_ira_roth: row.contributions_ira_roth ?? 0,
        contributions_hsa: row.contributions_hsa ?? 0,
        contributions_taxable:
          (row.contributions_taxable ?? 0) + (row.surplus_to_taxable ?? 0),
        discretionary_spending: row.discretionary_spending ?? 0,
        other_savings: 0,
      }));
  }, [rows, accumulationEndYear]);
  const xDomain = useMemo(() => chartYearDomain(data), [data]);
  if (!data.length) return null;
  return (
    <div className="card projections-chart-card">
      <h2>Annual savings</h2>
      <p className="projections-chart-intro">
        Planned contributions from Income (401(k), IRA, HSA, taxable), capped at IRS limits. Surplus after expenses
        may flow to taxable savings or be shown as discretionary spending when that option is unchecked on Income.
      </p>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eeec" />
            <XAxis dataKey="year" type="number" domain={xDomain} allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(l) => `Year ${l}`} />
            <Legend />
            <Bar dataKey="contributions_401k" name="401(k)" stackId="sav" fill="#4a6fa5" />
            <Bar dataKey="contributions_ira_traditional" name="Trad. IRA" stackId="sav" fill="#6b8cae" />
            <Bar dataKey="contributions_ira_roth" name="Roth IRA" stackId="sav" fill="#2d8a6e" />
            <Bar dataKey="contributions_hsa" name="HSA" stackId="sav" fill="#c9b87a" />
            <Bar dataKey="contributions_taxable" name="Taxable (planned + surplus)" stackId="sav" fill="#7a9e7e" />
            <Bar dataKey="discretionary_spending" name="Discretionary (not saved)" stackId="sav" fill="#c4a8a8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AccumulationTable({ projection, rows, household }) {
  if (!rows?.length) return null;
  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  const beginning = projection?.starting_balances_by_savings_category;
  const beginningYear = projection?.start_year != null ? projection.start_year - 1 : null;
  return (
    <div className="card projections-chart-card">
      <h2>Year-by-year detail</h2>
      <div className="table-responsive">
        <table className="projections-detail-table">
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col" className="num">{p1Name} age</th>
              <th scope="col" className="num">{p2Name} age</th>
              {SAVINGS_CATEGORIES.map((cat) => (
                <th key={cat.key} scope="col" className="num">{cat.label}</th>
              ))}
              <th scope="col" className="num">Total</th>
              <th scope="col" className="num">Savings added</th>
              <th scope="col" className="num">401(k) contrib.</th>
            </tr>
          </thead>
          <tbody>
            {beginning && (
              <tr className="beginning-balance-row">
                <td>{beginningYear ?? 'Beginning'}</td>
                <td className="num">—</td>
                <td className="num">—</td>
                {SAVINGS_CATEGORIES.map((cat) => (
                  <td key={cat.key} className="num">{formatCurrency(beginning[cat.key])}</td>
                ))}
                <td className="num">
                  {formatCurrency(
                    SAVINGS_CATEGORIES.reduce((sum, cat) => sum + (beginning[cat.key] ?? 0), 0)
                  )}
                </td>
                <td className="num">—</td>
                <td className="num">—</td>
              </tr>
            )}
            {rows.map((row) => {
              const c = row.balances_by_savings_category || {};
              const total = SAVINGS_CATEGORIES.reduce((sum, cat) => sum + (c[cat.key] ?? 0), 0);
              return (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td className="num">{row.p1_age_eoy ?? '—'}</td>
                  <td className="num">{row.p2_age_eoy ?? '—'}</td>
                  {SAVINGS_CATEGORIES.map((cat) => (
                    <td key={cat.key} className="num">{formatCurrency(c[cat.key])}</td>
                  ))}
                  <td className="num">{formatCurrency(total)}</td>
                  <td className="num">{formatCurrency(savingsAddedForYear(row))}</td>
                  <td className="num">{formatCurrency(row.contributions_401k)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SavingProjectionsPage() {
  const [household, setHousehold] = useState(null);
  const [projection, setProjection] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const loadHousehold = async () => {
    const res = await getHousehold();
    setHousehold(res.data);
  };

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

  const loadProjection = async (scenarioId) => {
    try {
      setLoading(true);
      setMessage(null);
      const params = { savings_projection: 1 };
      if (scenarioId != null) params.scenario_id = scenarioId;
      const res = await getProjections(params);
      setProjection(res.data);
      if (res.data?.scenario?.id) setSelectedScenarioId(res.data.scenario.id);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to load saving projections');
      setProjection(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadHousehold();
      await loadScenarios();
    })();
  }, []);

  useEffect(() => {
    if (household == null) return undefined;
    const timer = setTimeout(() => {
      loadProjection(selectedScenarioId);
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedScenarioId, household]);

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId]
  );

  const effectiveRetirementYear = projection?.retirement_year ?? null;

  const accumulationEndYear = useMemo(
    () =>
      projection?.accumulation_end_year ?? accumulationEndYearFromRetirement(effectiveRetirementYear),
    [projection?.accumulation_end_year, effectiveRetirementYear]
  );

  const accumulationRows = useMemo(() => {
    if (!projection?.by_year?.length || effectiveRetirementYear == null) return [];
    return filterAccumulationYears(projection.by_year, effectiveRetirementYear, accumulationEndYear);
  }, [projection, effectiveRetirementYear, accumulationEndYear]);

  const summary = useMemo(
    () => accumulationSummary(accumulationRows, projection),
    [accumulationRows, projection]
  );

  const handleScenarioChange = (id) => {
    setSelectedScenarioId(parseInt(id, 10));
  };

  const p1Name = household?.p1_display_name || 'P1';
  const p2Name = household?.p2_display_name || 'P2';
  const formatAge = (age) => (age != null && age !== '' ? String(age) : '—');

  return (
    <div className="page-scroll">
      <h1 className="page-title">Saving projections</h1>
      <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.95rem' }}>
        Project how savings accumulate from your current account balances until retirement, using wages, expenses,
        planned contributions, and surplus settings from{' '}
        <Link to="/income">Income</Link>, <Link to="/expenses">Expenses</Link>, and{' '}
        <Link to="/accounts">Accounts</Link>. Retirement ages come from the selected scenario. These projections add
        savings each year only — investment growth is not included. Edit assumptions on the{' '}
        <Link to="/scenarios">Scenarios</Link> page.
      </p>

      <div className="savings-projection-notice" role="note">
        <strong>No investment growth.</strong> Balances start from your Accounts and increase by planned contributions
        and surplus to taxable savings each year. Portfolio returns are not modeled on this page.
      </div>

      {message && <div className="error-message">{message}</div>}

      <div className="card">
        <h2>Scenario</h2>
        {scenarios.length > 0 ? (
          <>
            <div className="form-group" style={{ maxWidth: '20rem' }}>
              <label htmlFor="scenario_id">Scenario</label>
              <select
                id="scenario_id"
                value={selectedScenarioId ?? ''}
                onChange={(e) => handleScenarioChange(e.target.value)}
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.is_default ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {selectedScenario && (
              <div className="scenario-retirement-lines">
                <p>
                  {p1Name} Retired {formatAge(selectedScenario.retirement_age_p1)} Collect SSI{' '}
                  {formatAge(selectedScenario.social_security_claim_age_p1)}
                </p>
                <p>
                  {p2Name} Retired {formatAge(selectedScenario.retirement_age_p2)} Collect SSI{' '}
                  {formatAge(selectedScenario.social_security_claim_age_p2)}
                </p>
              </div>
            )}
            <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
              Retirement and Social Security claim ages are taken from the scenario. Household birth years are required
              to convert retirement ages into calendar years.
            </p>
          </>
        ) : (
          <p className="muted">
            No scenarios yet. Create one on the <Link to="/scenarios">Scenarios</Link> page to set retirement and
            Social Security claim ages.
          </p>
        )}
      </div>

      {loading && !projection && <p className="loading-message">Loading saving projections…</p>}

      {!loading && projection && accumulationRows.length === 0 && (
        <div className="card">
          <p className="muted">
            This scenario does not produce accumulation years — set retirement ages on the scenario (and birth years
            on Household) to project savings through retirement.
          </p>
        </div>
      )}

      {projection && accumulationRows.length > 0 && (
        <>
          <SavingSummary summary={summary} projection={projection} household={household} />
          <SavingsByCategoryChart
            projection={projection}
            rows={accumulationRows}
            accumulationEndYear={accumulationEndYear}
            target25x={projection.target_25x_retirement}
          />
          <SavingsGrowthChart
            projection={projection}
            rows={accumulationRows}
            accumulationEndYear={accumulationEndYear}
            target25x={projection.target_25x_retirement}
          />
          <ContributionsChart rows={accumulationRows} accumulationEndYear={accumulationEndYear} />
          <AccumulationTable projection={projection} rows={accumulationRows} household={household} />
        </>
      )}
    </div>
  );
}
