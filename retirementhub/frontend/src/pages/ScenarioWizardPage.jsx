import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getScenario,
  getHousehold,
  createScenario,
  updateScenario,
  updateHousehold,
  updateScenarioAssumptions,
  deleteScenario,
  computeScenario,
} from '../api/api';
import WithdrawalOrderEditor from '../components/scenarios/WithdrawalOrderEditor';
import {
  CLAIM_AGES,
  WITHDRAWAL_STRATEGIES,
  ROTH_STRATEGIES,
  WIZARD_STEPS,
  DEFAULT_CONSERVATIVE_ORDER,
  labelForStrategy,
} from '../constants/scenarioOptions';

const emptyForm = () => ({
  name: '',
  description: '',
  notes: '',
  retirementAgeP1: '',
  retirementAgeP2: '',
  ssClaimP1: '67',
  ssClaimP2: '67',
  years: 30,
  growthPct: 5,
  expenseGrowthPct: 2.5,
  ssiGrowthPct: 2.5,
  annualSpending: '',
  requiredMonthly: '',
  withdrawalStrategy: 'conservative',
  withdrawalOrder: [...DEFAULT_CONSERVATIVE_ORDER],
  rothStrategy: 'none',
  rothFixedAmount: '',
  rothTargetBracket: '22',
  rothMaxIncome: '',
});

export default function ScenarioWizardPage() {
  const { id: idParam } = useParams();
  const isNew = !idParam || idParam === 'new';
  const navigate = useNavigate();
  const allowZeroRates = import.meta.env.VITE_DEBUG != null && String(import.meta.env.VITE_DEBUG).trim() !== '';
  const minGrowth = allowZeroRates ? 0 : 0.01;
  const minIndexPct = allowZeroRates ? 0 : 0.01;

  const [step, setStep] = useState(1);
  const [scenarioId, setScenarioId] = useState(isNew ? null : parseInt(idParam, 10));
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    (async () => {
      if (isNew) {
        try {
          const hh = await getHousehold();
          const h = hh.data;
          setForm((f) => ({
            ...f,
            years: h.projection_horizon_years ?? 30,
            growthPct: h.projection_growth_pct ?? 5,
            expenseGrowthPct: h.projection_expense_growth_pct ?? 2.5,
            ssiGrowthPct: h.projection_ssi_growth_pct ?? 2.5,
            requiredMonthly:
              h.required_monthly_income_retirement > 0 ? String(h.required_monthly_income_retirement) : '',
          }));
        } catch {
          /* household defaults optional */
        }
        return;
      }
      try {
        setLoading(true);
        const [scenarioRes, hhRes] = await Promise.all([
          getScenario(parseInt(idParam, 10)),
          getHousehold(),
        ]);
        const s = scenarioRes.data;
        const h = hhRes.data;
        const a = s.assumptions || {};
        const rp = s.roth_plan || {};
        setScenarioId(s.id);
        setForm({
          name: s.name || '',
          description: s.description || '',
          notes: a.notes || '',
          retirementAgeP1: a.retirement_age_p1 != null ? String(a.retirement_age_p1) : '',
          retirementAgeP2: a.retirement_age_p2 != null ? String(a.retirement_age_p2) : '',
          ssClaimP1: String(a.social_security_claim_age_p1 ?? 67),
          ssClaimP2: String(a.social_security_claim_age_p2 ?? 67),
          years: h.projection_horizon_years ?? 30,
          growthPct: a.portfolio_return_rate ?? h.projection_growth_pct ?? 5,
          expenseGrowthPct: a.inflation_rate ?? h.projection_expense_growth_pct ?? 2.5,
          ssiGrowthPct: h.projection_ssi_growth_pct ?? 2.5,
          annualSpending: a.annual_spending_target > 0 ? String(a.annual_spending_target) : '',
          requiredMonthly:
            a.annual_spending_target > 0 ? String(Math.round(a.annual_spending_target / 12)) : '',
          withdrawalStrategy: a.withdrawal_strategy || 'conservative',
          withdrawalOrder: a.withdrawal_order_custom?.length
            ? a.withdrawal_order_custom
            : [...DEFAULT_CONSERVATIVE_ORDER],
          rothStrategy: a.roth_conversion_strategy || rp.strategy_type || 'none',
          rothFixedAmount: rp.annual_fixed_amount != null ? String(rp.annual_fixed_amount) : '',
          rothTargetBracket: String(rp.target_tax_bracket ?? 22),
          rothMaxIncome: rp.max_taxable_income != null ? String(rp.max_taxable_income) : '',
        });
      } catch (err) {
        setMessage(err.response?.data?.error || 'Failed to load scenario');
      } finally {
        setLoading(false);
      }
    })();
  }, [idParam, isNew]);

  const buildAssumptionsPayload = () => {
    const trimmed = form.requiredMonthly.trim();
    let rmi = null;
    if (trimmed !== '') {
      const n = parseFloat(trimmed);
      if (Number.isFinite(n) && n >= 0) rmi = n > 0 ? n : null;
    }
    const annual =
      form.annualSpending.trim() !== '' && Number.isFinite(parseFloat(form.annualSpending))
        ? parseFloat(form.annualSpending)
        : rmi != null
          ? rmi * 12
          : null;
    return {
      retirement_age_p1: form.retirementAgeP1 !== '' ? parseInt(form.retirementAgeP1, 10) : null,
      retirement_age_p2: form.retirementAgeP2 !== '' ? parseInt(form.retirementAgeP2, 10) : null,
      social_security_claim_age_p1: parseInt(form.ssClaimP1, 10),
      social_security_claim_age_p2: parseInt(form.ssClaimP2, 10),
      annual_spending_target: annual,
      inflation_rate: form.expenseGrowthPct,
      portfolio_return_rate: form.growthPct,
      withdrawal_strategy: form.withdrawalStrategy,
      withdrawal_order_custom: form.withdrawalStrategy === 'custom' ? form.withdrawalOrder : null,
      roth_conversion_strategy: form.rothStrategy,
      notes: form.notes || null,
      roth_plan: {
        strategy_type: form.rothStrategy,
        annual_fixed_amount: form.rothFixedAmount.trim() !== '' ? parseFloat(form.rothFixedAmount) : null,
        target_tax_bracket: parseInt(form.rothTargetBracket, 10),
        max_taxable_income: form.rothMaxIncome.trim() !== '' ? parseFloat(form.rothMaxIncome) : null,
      },
    };
  };

  const ensureScenarioExists = async () => {
    if (scenarioId != null) {
      await updateScenario(scenarioId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
      });
      return scenarioId;
    }
    const res = await createScenario({
      name: form.name.trim(),
      description: form.description.trim() || null,
      assumptions: buildAssumptionsPayload(),
    });
    const newId = res.data.id;
    setScenarioId(newId);
    navigate(`/scenarios/${newId}/edit`, { replace: true });
    return newId;
  };

  const saveDraft = async () => {
    const sid = await ensureScenarioExists();
    await updateScenarioAssumptions(sid, buildAssumptionsPayload());
  };

  const validateStep = () => {
    if (step === 1 && !form.name.trim()) {
      setMessage('Scenario name is required.');
      return false;
    }
    setMessage(null);
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    try {
      setSaving(true);
      if (step === 1) await ensureScenarioExists();
      else if (scenarioId != null) await saveDraft();
      setStep((s) => Math.min(7, s + 1));
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const buildHouseholdPayload = () => {
    const trimmed = form.requiredMonthly.trim();
    let rmi = null;
    if (trimmed !== '') {
      const n = parseFloat(trimmed);
      if (Number.isFinite(n) && n >= 0) rmi = n > 0 ? n : null;
    }
    return {
      projection_horizon_years: form.years,
      projection_growth_pct: form.growthPct,
      projection_expense_growth_pct: form.expenseGrowthPct,
      projection_ssi_growth_pct: form.ssiGrowthPct,
      required_monthly_income_retirement: rmi,
    };
  };

  const handleFinish = async () => {
    if (!validateStep()) return;
    try {
      setSaving(true);
      setMessage(null);
      const sid = scenarioId ?? (await ensureScenarioExists());
      await updateHousehold(buildHouseholdPayload());
      await updateScenarioAssumptions(sid, buildAssumptionsPayload());
      await computeScenario(sid);
      navigate('/scenarios');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save and compute');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (scenarioId == null) return;
    if (!window.confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    try {
      setSaving(true);
      await deleteScenario(scenarioId);
      navigate('/scenarios');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to delete scenario');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-scroll">
        <p className="loading-message">Loading scenario…</p>
      </div>
    );
  }

  return (
    <div className="page-scroll">
      <div className="scenario-wizard-header">
        <div>
          <h1 className="page-title">{isNew && !scenarioId ? 'New scenario' : `Edit: ${form.name || 'Scenario'}`}</h1>
          <Link to="/scenarios" className="scenario-back-link">← All scenarios</Link>
        </div>
        {scenarioId != null && (
          <button type="button" className="btn btn-secondary scenario-delete-btn" onClick={handleDelete} disabled={saving}>
            Delete scenario
          </button>
        )}
      </div>

      <nav className="scenario-wizard-steps" aria-label="Wizard steps">
        {WIZARD_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`scenario-wizard-step${step === s.id ? ' scenario-wizard-step-active' : ''}${step > s.id ? ' scenario-wizard-step-done' : ''}`}
            onClick={() => s.id < step && setStep(s.id)}
            disabled={s.id > step}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </nav>

      {message && <div className="error-message">{message}</div>}

      <div className="card scenario-wizard-panel">
        {step === 1 && (
          <>
            <h2>Basics</h2>
            <div className="form-group">
              <label htmlFor="scenario-name">Name *</label>
              <input
                id="scenario-name"
                type="text"
                maxLength={120}
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="scenario-desc">Description</label>
              <input
                id="scenario-desc"
                type="text"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="scenario-notes">Notes</label>
              <textarea
                id="scenario-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Retirement timing</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ret-age-p1">P1 retirement age</label>
                <input
                  id="ret-age-p1"
                  type="number"
                  min={50}
                  max={90}
                  value={form.retirementAgeP1}
                  onChange={(e) => setField('retirementAgeP1', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ret-age-p2">P2 retirement age</label>
                <input
                  id="ret-age-p2"
                  type="number"
                  min={50}
                  max={90}
                  value={form.retirementAgeP2}
                  onChange={(e) => setField('retirementAgeP2', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="projections-years">Years to project</label>
                <input
                  id="projections-years"
                  type="number"
                  min={5}
                  max={50}
                  value={form.years}
                  onChange={(e) => setField('years', parseInt(e.target.value, 10) || 30)}
                />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Social Security claiming</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ss-p1">P1 SS claim age</label>
                <select id="ss-p1" value={form.ssClaimP1} onChange={(e) => setField('ssClaimP1', e.target.value)}>
                  {CLAIM_AGES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="ss-p2">P2 SS claim age</label>
                <select id="ss-p2" value={form.ssClaimP2} onChange={(e) => setField('ssClaimP2', e.target.value)}>
                  {CLAIM_AGES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2>Spending &amp; growth</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="annual-spending">Annual spending target</label>
                <input
                  id="annual-spending"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.annualSpending}
                  onChange={(e) => setField('annualSpending', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="required-monthly">Required monthly income (retirement)</label>
                <input
                  id="required-monthly"
                  type="number"
                  min={0}
                  step={100}
                  value={form.requiredMonthly}
                  onChange={(e) => setField('requiredMonthly', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="growth-pct">Portfolio growth (%/yr)</label>
                <input
                  id="growth-pct"
                  type="number"
                  min={minGrowth}
                  max={20}
                  step="any"
                  value={form.growthPct}
                  onChange={(e) => setField('growthPct', parseFloat(e.target.value) || minGrowth)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="expense-growth">Expense growth (%/yr)</label>
                <input
                  id="expense-growth"
                  type="number"
                  min={minIndexPct}
                  max={10}
                  step="any"
                  value={form.expenseGrowthPct}
                  onChange={(e) => setField('expenseGrowthPct', parseFloat(e.target.value) || minIndexPct)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ssi-growth">SSI growth (%/yr)</label>
                <input
                  id="ssi-growth"
                  type="number"
                  min={minIndexPct}
                  max={10}
                  step="any"
                  value={form.ssiGrowthPct}
                  onChange={(e) => setField('ssiGrowthPct', parseFloat(e.target.value) || minIndexPct)}
                />
              </div>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h2>Withdrawal strategy</h2>
            <div className="form-group">
              <label htmlFor="withdrawal-strategy">Strategy</label>
              <select
                id="withdrawal-strategy"
                value={form.withdrawalStrategy}
                onChange={(e) => setField('withdrawalStrategy', e.target.value)}
              >
                {WITHDRAWAL_STRATEGIES.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
            {form.withdrawalStrategy === 'custom' && (
              <WithdrawalOrderEditor
                order={form.withdrawalOrder}
                onChange={(order) => setField('withdrawalOrder', order)}
              />
            )}
          </>
        )}

        {step === 6 && (
          <>
            <h2>Roth conversions</h2>
            <div className="form-group">
              <label htmlFor="roth-strategy">Strategy</label>
              <select
                id="roth-strategy"
                value={form.rothStrategy}
                onChange={(e) => setField('rothStrategy', e.target.value)}
              >
                {ROTH_STRATEGIES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            {form.rothStrategy === 'fixed' && (
              <div className="form-group">
                <label htmlFor="roth-fixed">Annual conversion $</label>
                <input
                  id="roth-fixed"
                  type="number"
                  min={0}
                  value={form.rothFixedAmount}
                  onChange={(e) => setField('rothFixedAmount', e.target.value)}
                />
              </div>
            )}
            {form.rothStrategy === 'fill_bracket' && (
              <div className="form-group">
                <label htmlFor="roth-bracket">Target bracket %</label>
                <select
                  id="roth-bracket"
                  value={form.rothTargetBracket}
                  onChange={(e) => setField('rothTargetBracket', e.target.value)}
                >
                  {[10, 12, 22, 24, 32].map((b) => (
                    <option key={b} value={b}>{b}%</option>
                  ))}
                </select>
              </div>
            )}
            {(form.rothStrategy === 'fill_income' || form.rothStrategy === 'irmaa_aware') && (
              <div className="form-group">
                <label htmlFor="roth-max-inc">Max taxable income</label>
                <input
                  id="roth-max-inc"
                  type="number"
                  min={0}
                  value={form.rothMaxIncome}
                  onChange={(e) => setField('rothMaxIncome', e.target.value)}
                />
              </div>
            )}
          </>
        )}

        {step === 7 && (
          <>
            <h2>Review</h2>
            <p className="scenario-review-name">
              Scenario: <strong>{form.name}</strong>
            </p>
            <ul className="scenario-review-list">
              <li>P1/P2 retirement age: {form.retirementAgeP1 || '—'} / {form.retirementAgeP2 || '—'}</li>
              <li>SS claim ages: {form.ssClaimP1} / {form.ssClaimP2}</li>
              <li>Horizon: {form.years} years · Growth {form.growthPct}% · Expense {form.expenseGrowthPct}%</li>
              <li>Withdrawal: {labelForStrategy(form.withdrawalStrategy, WITHDRAWAL_STRATEGIES)}</li>
              <li>Roth: {labelForStrategy(form.rothStrategy, ROTH_STRATEGIES)}</li>
            </ul>
          </>
        )}

        <div className="scenario-wizard-nav">
          <button type="button" className="btn btn-secondary" onClick={handleBack} disabled={step === 1 || saving}>
            Back
          </button>
          {step < 7 ? (
            <button type="button" className="btn btn-primary" onClick={handleNext} disabled={saving}>
              {saving ? 'Saving…' : 'Next'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleFinish} disabled={saving}>
              {saving ? 'Computing…' : 'Save & compute'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
