import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getScenarios,
  deleteScenario,
  updateScenario,
  createScenario,
} from '../api/api';
import { labelForStrategy, WITHDRAWAL_STRATEGIES, ROTH_STRATEGIES } from '../constants/scenarioOptions';

function formatDate(iso) {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ScenariosPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const res = await getScenarios();
      setScenarios(res.data || []);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    try {
      await deleteScenario(s.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(s.id);
        return next;
      });
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to delete scenario');
    }
  };

  const handleSetDefault = async (s) => {
    try {
      await updateScenario(s.id, { is_default: true });
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to set default');
    }
  };

  const handleDuplicate = async (s) => {
    const name = window.prompt('Name for duplicated scenario', `Copy of ${s.name}`);
    if (!name?.trim()) return;
    try {
      await createScenario({
        name: name.trim(),
        assumptions: {
          retirement_age_p1: s.retirement_age_p1,
          retirement_age_p2: s.retirement_age_p2,
          social_security_claim_age_p1: s.social_security_claim_age_p1,
          social_security_claim_age_p2: s.social_security_claim_age_p2,
          annual_spending_target: s.annual_spending_target,
          inflation_rate: s.inflation_rate,
          portfolio_return_rate: s.portfolio_return_rate,
          withdrawal_strategy: s.withdrawal_strategy,
          roth_conversion_strategy: s.roth_conversion_strategy,
        },
      });
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to duplicate scenario');
    }
  };

  const compareSelected = () => {
    const ids = [...selected];
    if (ids.length < 2) {
      setMessage('Select at least two scenarios to compare.');
      return;
    }
    navigate(`/scenarios/compare?ids=${ids.join(',')}`);
  };

  return (
    <div className="page-scroll">
      <h1 className="page-title">Scenarios</h1>
      <p className="page-intro">
        Create named what-if plans with different retirement timing, spending, withdrawal strategy, and Roth conversions.
        Projections charts use the scenario you select on the{' '}
        <Link to="/projections">Projections</Link> page.
      </p>

      <div className="scenario-toolbar">
        <Link to="/scenarios/new" className="btn btn-primary">New scenario</Link>
        <button type="button" className="btn btn-secondary" disabled={selected.size < 2} onClick={compareSelected}>
          Compare selected ({selected.size})
        </button>
      </div>

      {message && <div className="error-message">{message}</div>}
      {loading && <p className="loading-message">Loading scenarios…</p>}

      {!loading && scenarios.length === 0 && (
        <div className="card">
          <p>No scenarios yet. Create one to get started.</p>
        </div>
      )}

      {!loading && scenarios.length > 0 && (
        <div className="card">
          <div className="projections-detail-table-wrap">
            <table className="projections-detail-table">
              <thead>
                <tr>
                  <th aria-label="Select" />
                  <th>Name</th>
                  <th>Assumptions</th>
                  <th className="num">Lifetime tax</th>
                  <th>Last computed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        aria-label={`Select ${s.name}`}
                      />
                    </td>
                    <td>
                      <Link to={`/scenarios/${s.id}/edit`}>{s.name}</Link>
                      {s.is_default && <span className="scenario-badge">Default</span>}
                    </td>
                    <td className="scenario-assumption-summary">
                      Retire P1/P2: {s.retirement_age_p1 ?? '—'}/{s.retirement_age_p2 ?? '—'}
                      {' · '}
                      SS: {s.social_security_claim_age_p1 ?? '—'}/{s.social_security_claim_age_p2 ?? '—'}
                      {' · '}
                      {labelForStrategy(s.withdrawal_strategy, WITHDRAWAL_STRATEGIES)}
                      {' · '}
                      {labelForStrategy(s.roth_conversion_strategy, ROTH_STRATEGIES)}
                    </td>
                    <td className="num">—</td>
                    <td>{formatDate(s.last_computed_at)}</td>
                    <td className="scenario-actions">
                      <Link to={`/scenarios/${s.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDuplicate(s)}>
                        Duplicate
                      </button>
                      {!s.is_default && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSetDefault(s)}>
                          Set default
                        </button>
                      )}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDelete(s)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
