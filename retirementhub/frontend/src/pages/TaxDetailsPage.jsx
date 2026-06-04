import React, { useState, useEffect, useCallback } from 'react';
import { taxParameters } from '../api/api';

function apiErrorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

function SourceBadge({ source, modified }) {
  const edited = source === 'user_edited';
  return (
    <span className={`tax-source-badge ${edited ? 'tax-source-edited' : 'tax-source-seeded'}`}>
      {edited ? `Edited${modified ? ` · ${new Date(modified).toLocaleDateString()}` : ''}` : 'Seeded'}
    </span>
  );
}

function StandardDeductionCard({ rows, year, onSave }) {
  const [drafts, setDrafts] = useState({});
  return (
    <div className="card">
      <h3>Standard Deduction</h3>
      {rows.map((row) => {
        const key = row.filing_status;
        const d = drafts[key] || { amount: row.amount, age65_add_on: row.age65_add_on };
        return (
          <div key={key} className="tax-param-row">
            <strong>{row.filing_status.replace(/_/g, ' ')}</strong>
            <label>
              Amount{' '}
              <input
                type="number"
                value={d.amount}
                onChange={(e) => setDrafts({ ...drafts, [key]: { ...d, amount: e.target.value } })}
              />
            </label>
            <label>
              Age 65+ add-on{' '}
              <input
                type="number"
                value={d.age65_add_on}
                onChange={(e) =>
                  setDrafts({ ...drafts, [key]: { ...d, age65_add_on: e.target.value } })
                }
              />
            </label>
            <SourceBadge source={row.source} modified={row.modified} />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                onSave('standard-deduction', key, {
                  amount: parseFloat(d.amount),
                  age65_add_on: parseFloat(d.age65_add_on),
                })
              }
            >
              Save
            </button>
          </div>
        );
      })}
    </div>
  );
}

function BracketsCard({ rows, year, onSave }) {
  const [drafts, setDrafts] = useState({});
  const byStatus = rows.reduce((acc, r) => {
    if (!acc[r.filing_status]) acc[r.filing_status] = [];
    acc[r.filing_status].push(r);
    return acc;
  }, {});
  return (
    <div className="card">
      <h3>Tax Brackets</h3>
      {Object.entries(byStatus).map(([fs, brackets]) => (
        <div key={fs}>
          <h4>{fs.replace(/_/g, ' ')}</h4>
          {brackets.map((row) => {
            const key = `${fs}-${row.ordinal}`;
            const d = drafts[key] || { lower_bound: row.lower_bound, rate: row.rate };
            return (
              <div key={key} className="tax-param-row">
                <span>#{row.ordinal}</span>
                <label>
                  Lower bound{' '}
                  <input
                    type="number"
                    value={d.lower_bound}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [key]: { ...d, lower_bound: e.target.value } })
                    }
                  />
                </label>
                <label>
                  Rate{' '}
                  <input
                    type="number"
                    step="0.0001"
                    value={d.rate}
                    onChange={(e) => setDrafts({ ...drafts, [key]: { ...d, rate: e.target.value } })}
                  />
                </label>
                <SourceBadge source={row.source} modified={row.modified} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    onSave('bracket', fs, row.ordinal, {
                      lower_bound: parseFloat(d.lower_bound),
                      rate: parseFloat(d.rate),
                    })
                  }
                >
                  Save
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ContributionLimitsCard({ rows, year, onSave }) {
  const [drafts, setDrafts] = useState({});
  return (
    <div className="card">
      <h3>Contribution Limits</h3>
      {rows.map((row) => {
        const key = row.kind;
        const d = drafts[key] || { base_amount: row.base_amount, catch_up_amount: row.catch_up_amount };
        return (
          <div key={key} className="tax-param-row">
            <strong>{row.kind}</strong>
            <label>
              Base{' '}
              <input
                type="number"
                value={d.base_amount}
                onChange={(e) =>
                  setDrafts({ ...drafts, [key]: { ...d, base_amount: e.target.value } })
                }
              />
            </label>
            <label>
              Catch-up{' '}
              <input
                type="number"
                value={d.catch_up_amount}
                onChange={(e) =>
                  setDrafts({ ...drafts, [key]: { ...d, catch_up_amount: e.target.value } })
                }
              />
            </label>
            <SourceBadge source={row.source} modified={row.modified} />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                onSave('contribution-limit', key, {
                  base_amount: parseFloat(d.base_amount),
                  catch_up_amount: parseFloat(d.catch_up_amount),
                })
              }
            >
              Save
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MedicarePartBCard({ row, year, onSave }) {
  const [premium, setPremium] = useState(row?.monthly_premium ?? '');
  useEffect(() => {
    setPremium(row?.monthly_premium ?? '');
  }, [row]);
  if (!row) return null;
  return (
    <div className="card">
      <h3>Medicare Part B</h3>
      <div className="tax-param-row">
        <label>
          Monthly premium{' '}
          <input type="number" step="0.01" value={premium} onChange={(e) => setPremium(e.target.value)} />
        </label>
        <SourceBadge source={row.source} modified={row.modified} />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onSave('medicare-part-b', { monthly_premium: parseFloat(premium) })}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default function TaxDetailsPage() {
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(2026);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYear, setNewYear] = useState('');
  const [cloneFromYear, setCloneFromYear] = useState('');
  const [newYearStatus, setNewYearStatus] = useState('projected');
  const [addingYear, setAddingYear] = useState(false);

  const selectedYearMeta = years.find((y) => Number(y.year) === Number(year));
  const canResetToIrsSeed = selectedYearMeta?.has_irs_seed === true;
  const maxYear = years.length
    ? Math.max(...years.map((y) => Number(y.year)))
    : new Date().getFullYear();

  const loadYears = useCallback(async () => {
    try {
      const res = await taxParameters.listYears();
      const list = res.years || [];
      setYears(list);
      if (list.length && !list.some((y) => Number(y.year) === Number(year))) {
        setYear(list[list.length - 1].year);
      }
      if (!newYear && list.length) {
        setNewYear(String(Math.max(...list.map((y) => Number(y.year))) + 1));
      }
      if (!cloneFromYear && list.length) {
        setCloneFromYear(String(list[list.length - 1].year));
      }
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to load years'));
    }
  }, [year]);

  const loadYear = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await taxParameters.getYear(year);
      setData(res);
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to load tax parameters'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadYears();
  }, [loadYears]);

  useEffect(() => {
    if (year) loadYear();
  }, [year, loadYear]);

  const handleSave = async (kind, ...args) => {
    try {
      if (kind === 'standard-deduction') {
        const [fs, body] = args;
        await taxParameters.updateStandardDeduction(year, fs, body);
      } else if (kind === 'bracket') {
        const [fs, ordinal, body] = args;
        await taxParameters.updateBracket(year, fs, ordinal, body);
      } else if (kind === 'contribution-limit') {
        const [limitKind, body] = args;
        await taxParameters.updateContributionLimit(year, limitKind, body);
      } else if (kind === 'medicare-part-b') {
        const [body] = args;
        await taxParameters.updateMedicarePartB(year, body);
      }
      await loadYear();
    } catch (e) {
      setError(apiErrorMessage(e, 'Save failed'));
    }
  };

  const handleAddYear = async (e) => {
    e.preventDefault();
    const y = parseInt(String(newYear).trim(), 10);
    if (!Number.isInteger(y) || y < 2020 || y > 2100) {
      setError('Enter a valid year (2020–2100).');
      return;
    }
    setAddingYear(true);
    setError(null);
    try {
      const created = await taxParameters.createYear({
        year: y,
        clone_from_year: cloneFromYear ? parseInt(cloneFromYear, 10) : undefined,
        status: newYearStatus,
      });
      setShowAddYear(false);
      await loadYears();
      setYear(created.year);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to add year'));
    } finally {
      setAddingYear(false);
    }
  };

  const handleReset = async () => {
    if (
      !window.confirm(
        `Reset all tax parameters for ${year} to seeded IRS defaults? Your edits for this year will be overwritten.`
      )
    ) {
      return;
    }
    try {
      setError(null);
      await taxParameters.resetYear(Number(year));
      await loadYear();
    } catch (e) {
      setError(apiErrorMessage(e, 'Reset failed'));
    }
  };

  return (
    <div className="page tax-details-page page-scroll">
      <h1>Tax Details</h1>
      <p className="muted">
        IRS standard deduction, brackets, contribution limits, and Medicare Part B premiums used in
        projections. Add a new calendar year anytime (clone from an existing year, then edit).
        Built-in 2024–2026 values ship with the app; you do not need a software upgrade for new tax
        years.
      </p>

      <div className="tax-details-toolbar">
        <label htmlFor="tax-year-select">
          Year{' '}
          <select
            id="tax-year-select"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
          >
            {years.map((y) => (
              <option key={y.year} value={y.year}>
                {y.year} ({y.status})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={!canResetToIrsSeed}
          title={
            canResetToIrsSeed
              ? 'Restore IRS values shipped with the app for this year'
              : 'Only available for built-in IRS seed years (2024–2026). Edit values manually or re-add the year.'
          }
        >
          Reset year to IRS defaults
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setShowAddYear((v) => !v);
            if (!newYear) setNewYear(String(maxYear + 1));
            if (!cloneFromYear && years.length) setCloneFromYear(String(year));
          }}
        >
          {showAddYear ? 'Cancel' : 'Add year'}
        </button>
      </div>

      {showAddYear && (
        <form className="card tax-add-year-form" onSubmit={handleAddYear}>
          <h3>Add tax year</h3>
          <p className="muted">
            Creates a new year by copying all parameters from the selected source. Adjust amounts
            after IRS publishes updates — no app upgrade required.
          </p>
          <div className="tax-add-year-fields">
            <label>
              New year{' '}
              <input
                type="number"
                min={2020}
                max={2100}
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                required
              />
            </label>
            <label>
              Clone from{' '}
              <select
                value={cloneFromYear}
                onChange={(e) => setCloneFromYear(e.target.value)}
                required
              >
                {years.map((y) => (
                  <option key={y.year} value={y.year}>
                    {y.year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status{' '}
              <select
                value={newYearStatus}
                onChange={(e) => setNewYearStatus(e.target.value)}
              >
                <option value="projected">projected</option>
                <option value="published">published</option>
              </select>
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={addingYear || years.length === 0}>
            {addingYear ? 'Adding…' : 'Create year'}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
      {loading && <p>Loading…</p>}

      {!loading && data && (
        <>
          <StandardDeductionCard
            rows={data.standard_deduction || []}
            year={year}
            onSave={handleSave}
          />
          <BracketsCard rows={data.brackets || []} year={year} onSave={handleSave} />
          <ContributionLimitsCard
            rows={data.contribution_limits || []}
            year={year}
            onSave={handleSave}
          />
          <MedicarePartBCard row={data.medicare_part_b} year={year} onSave={handleSave} />
        </>
      )}
    </div>
  );
}
