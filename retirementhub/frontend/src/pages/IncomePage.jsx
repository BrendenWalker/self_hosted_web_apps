import React, { useState, useEffect } from 'react';
import { getIncome, updateIncome } from '../api/api';

const EMPTY_FORM = {
  as_of: '',
  gross_salary: '',
  gross_salary_p2: '',
  expected_raise_pct: '',
  bonus_quarterly: '',
  bonus_quarterly_p2: '',
  four_o_one_k_pct: '',
  four_o_one_k_match_pct: '',
  four_o_one_k_pct_p2: '',
  four_o_one_k_match_pct_p2: '',
  ira_traditional_annual_p1: '',
  ira_roth_annual_p1: '',
  hsa_annual_p1: '',
  taxable_savings_annual_p1: '',
  ira_traditional_annual_p2: '',
  ira_roth_annual_p2: '',
  hsa_annual_p2: '',
  taxable_savings_annual_p2: '',
  surplus_to_taxable_p1: true,
  surplus_to_taxable_p2: true,
};

function fieldFromIncome(i, key) {
  return i?.[key] != null ? String(i[key]) : '';
}

function parseSubmitFloat(value) {
  return value === '' ? undefined : parseFloat(value);
}

function AnnualAmountInput({ id, name, label, value, onChange, placeholder }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={onChange}
        placeholder={placeholder || '0'}
      />
    </div>
  );
}

export default function IncomePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getIncome();
      const i = res.data;
      setData(i);
      setForm({
        as_of: i.as_of ? String(i.as_of).slice(0, 10) : '',
        gross_salary: fieldFromIncome(i, 'gross_salary'),
        gross_salary_p2: fieldFromIncome(i, 'gross_salary_p2'),
        expected_raise_pct: fieldFromIncome(i, 'expected_raise_pct'),
        bonus_quarterly: fieldFromIncome(i, 'bonus_quarterly'),
        bonus_quarterly_p2: fieldFromIncome(i, 'bonus_quarterly_p2'),
        four_o_one_k_pct: fieldFromIncome(i, 'four_o_one_k_pct'),
        four_o_one_k_match_pct: fieldFromIncome(i, 'four_o_one_k_match_pct'),
        four_o_one_k_pct_p2: fieldFromIncome(i, 'four_o_one_k_pct_p2'),
        four_o_one_k_match_pct_p2: fieldFromIncome(i, 'four_o_one_k_match_pct_p2'),
        ira_traditional_annual_p1: fieldFromIncome(i, 'ira_traditional_annual_p1'),
        ira_roth_annual_p1: fieldFromIncome(i, 'ira_roth_annual_p1'),
        hsa_annual_p1: fieldFromIncome(i, 'hsa_annual_p1'),
        taxable_savings_annual_p1: fieldFromIncome(i, 'taxable_savings_annual_p1'),
        ira_traditional_annual_p2: fieldFromIncome(i, 'ira_traditional_annual_p2'),
        ira_roth_annual_p2: fieldFromIncome(i, 'ira_roth_annual_p2'),
        hsa_annual_p2: fieldFromIncome(i, 'hsa_annual_p2'),
        taxable_savings_annual_p2: fieldFromIncome(i, 'taxable_savings_annual_p2'),
        surplus_to_taxable_p1: i.surplus_to_taxable_p1 !== false,
        surplus_to_taxable_p2: i.surplus_to_taxable_p2 !== false,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load income' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      setSaving(true);
      await updateIncome({
        id: data?.id,
        as_of: form.as_of || undefined,
        gross_salary: parseSubmitFloat(form.gross_salary),
        gross_salary_p2: parseSubmitFloat(form.gross_salary_p2),
        expected_raise_pct: parseSubmitFloat(form.expected_raise_pct),
        bonus_quarterly: parseSubmitFloat(form.bonus_quarterly),
        bonus_quarterly_p2: parseSubmitFloat(form.bonus_quarterly_p2),
        four_o_one_k_pct: parseSubmitFloat(form.four_o_one_k_pct),
        four_o_one_k_match_pct: parseSubmitFloat(form.four_o_one_k_match_pct),
        four_o_one_k_pct_p2: parseSubmitFloat(form.four_o_one_k_pct_p2),
        four_o_one_k_match_pct_p2: parseSubmitFloat(form.four_o_one_k_match_pct_p2),
        ira_traditional_annual_p1: parseSubmitFloat(form.ira_traditional_annual_p1),
        ira_roth_annual_p1: parseSubmitFloat(form.ira_roth_annual_p1),
        hsa_annual_p1: parseSubmitFloat(form.hsa_annual_p1),
        taxable_savings_annual_p1: parseSubmitFloat(form.taxable_savings_annual_p1),
        ira_traditional_annual_p2: parseSubmitFloat(form.ira_traditional_annual_p2),
        ira_roth_annual_p2: parseSubmitFloat(form.ira_roth_annual_p2),
        hsa_annual_p2: parseSubmitFloat(form.hsa_annual_p2),
        taxable_savings_annual_p2: parseSubmitFloat(form.taxable_savings_annual_p2),
        surplus_to_taxable_p1: form.surplus_to_taxable_p1,
        surplus_to_taxable_p2: form.surplus_to_taxable_p2,
      });
      setMessage({ type: 'success', text: 'Income saved.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save income' });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return <p className="loading-message">Loading income…</p>;
  }

  return (
    <div className="page-scroll">
      <h1 className="page-title">Income</h1>
      {message && (
        <div className={message.type === 'error' ? 'error-message' : 'success-message'}>
          {message.text}
        </div>
      )}
      <div className="card">
        <h2>Budget context</h2>
        <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.9rem' }}>
          Gross salary, bonuses, raises, and planned savings for P1 and P2. Projections apply IRS limits to 401(k),
          combined IRA, and HSA contributions each year. Planned taxable savings amounts are treated as net after taxes.
          Surplus income after expenses and planned contributions can flow to taxable savings (with estimated federal tax
          withheld) or be treated as unbudgeted discretionary spending. Amounts are stored with an “as of”
          date; the most recent snapshot is used.
        </p>
        <form onSubmit={handleSubmit}>
          {form.as_of && (
            <div className="form-group">
              <label htmlFor="as_of">As of date</label>
              <input
                id="as_of"
                name="as_of"
                type="date"
                value={form.as_of}
                onChange={handleChange}
              />
            </div>
          )}

          <h3 className="income-party-heading">P1 — wages & bonus</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="gross_salary">Gross salary (P1) $</label>
              <input
                id="gross_salary"
                name="gross_salary"
                type="number"
                step="0.01"
                min="0"
                value={form.gross_salary}
                onChange={handleChange}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label htmlFor="bonus_quarterly">Net quarterly bonus (P1) $</label>
              <input
                id="bonus_quarterly"
                name="bonus_quarterly"
                type="number"
                step="0.01"
                min="0"
                value={form.bonus_quarterly}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>
          </div>

          <h3 className="income-party-heading">P2 — wages & bonus</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="gross_salary_p2">Gross salary (P2) $</label>
              <input
                id="gross_salary_p2"
                name="gross_salary_p2"
                type="number"
                step="0.01"
                min="0"
                value={form.gross_salary_p2}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>
            <div className="form-group">
              <label htmlFor="bonus_quarterly_p2">Net quarterly bonus (P2) $</label>
              <input
                id="bonus_quarterly_p2"
                name="bonus_quarterly_p2"
                type="number"
                step="0.01"
                min="0"
                value={form.bonus_quarterly_p2}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="expected_raise_pct">Expected annual raise % (both)</label>
            <input
              id="expected_raise_pct"
              name="expected_raise_pct"
              type="number"
              step="0.01"
              min="0"
              value={form.expected_raise_pct}
              onChange={handleChange}
              placeholder="e.g. 3"
            />
          </div>

          <h3 className="income-party-heading">P1 — savings</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="four_o_one_k_pct">401(k) contribution %</label>
              <input
                id="four_o_one_k_pct"
                name="four_o_one_k_pct"
                type="number"
                step="0.01"
                min="0"
                value={form.four_o_one_k_pct}
                onChange={handleChange}
                placeholder="e.g. 15"
              />
            </div>
            <div className="form-group">
              <label htmlFor="four_o_one_k_match_pct">401(k) employer match %</label>
              <input
                id="four_o_one_k_match_pct"
                name="four_o_one_k_match_pct"
                type="number"
                step="0.01"
                min="0"
                value={form.four_o_one_k_match_pct}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="form-row">
            <AnnualAmountInput
              id="ira_traditional_annual_p1"
              name="ira_traditional_annual_p1"
              label="Traditional IRA $/yr"
              value={form.ira_traditional_annual_p1}
              onChange={handleChange}
            />
            <AnnualAmountInput
              id="ira_roth_annual_p1"
              name="ira_roth_annual_p1"
              label="Roth IRA $/yr"
              value={form.ira_roth_annual_p1}
              onChange={handleChange}
            />
          </div>
          <div className="form-row">
            <AnnualAmountInput
              id="hsa_annual_p1"
              name="hsa_annual_p1"
              label="HSA $/yr"
              value={form.hsa_annual_p1}
              onChange={handleChange}
            />
            <AnnualAmountInput
              id="taxable_savings_annual_p1"
              name="taxable_savings_annual_p1"
              label="Taxable savings $/yr (net after taxes)"
              value={form.taxable_savings_annual_p1}
              onChange={handleChange}
            />
          </div>
          <div className="form-group checkbox-row">
            <label htmlFor="surplus_to_taxable_p1" className="checkbox-label">
              <input
                id="surplus_to_taxable_p1"
                name="surplus_to_taxable_p1"
                type="checkbox"
                checked={form.surplus_to_taxable_p1}
                onChange={handleChange}
              />
              Surplus income is added to taxable savings (P1)
            </label>
            <span className="muted" style={{ fontSize: '0.85rem', display: 'block', marginTop: '0.35rem' }}>
              When checked, P1&apos;s share of surplus after planned contributions is deposited to taxable savings
              after estimated federal tax is withheld. When unchecked, P1&apos;s share is treated as discretionary
              spending not captured in your expense categories.
            </span>
          </div>

          <h3 className="income-party-heading">P2 — savings</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="four_o_one_k_pct_p2">401(k) contribution %</label>
              <input
                id="four_o_one_k_pct_p2"
                name="four_o_one_k_pct_p2"
                type="number"
                step="0.01"
                min="0"
                value={form.four_o_one_k_pct_p2}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>
            <div className="form-group">
              <label htmlFor="four_o_one_k_match_pct_p2">401(k) employer match %</label>
              <input
                id="four_o_one_k_match_pct_p2"
                name="four_o_one_k_match_pct_p2"
                type="number"
                step="0.01"
                min="0"
                value={form.four_o_one_k_match_pct_p2}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="form-row">
            <AnnualAmountInput
              id="ira_traditional_annual_p2"
              name="ira_traditional_annual_p2"
              label="Traditional IRA $/yr"
              value={form.ira_traditional_annual_p2}
              onChange={handleChange}
            />
            <AnnualAmountInput
              id="ira_roth_annual_p2"
              name="ira_roth_annual_p2"
              label="Roth IRA $/yr"
              value={form.ira_roth_annual_p2}
              onChange={handleChange}
            />
          </div>
          <div className="form-row">
            <AnnualAmountInput
              id="hsa_annual_p2"
              name="hsa_annual_p2"
              label="HSA $/yr"
              value={form.hsa_annual_p2}
              onChange={handleChange}
            />
            <AnnualAmountInput
              id="taxable_savings_annual_p2"
              name="taxable_savings_annual_p2"
              label="Taxable savings $/yr (net after taxes)"
              value={form.taxable_savings_annual_p2}
              onChange={handleChange}
            />
          </div>
          <div className="form-group checkbox-row">
            <label htmlFor="surplus_to_taxable_p2" className="checkbox-label">
              <input
                id="surplus_to_taxable_p2"
                name="surplus_to_taxable_p2"
                type="checkbox"
                checked={form.surplus_to_taxable_p2}
                onChange={handleChange}
              />
              Surplus income is added to taxable savings (P2)
            </label>
            <span className="muted" style={{ fontSize: '0.85rem', display: 'block', marginTop: '0.35rem' }}>
              When checked, P2&apos;s share of surplus after planned contributions is deposited to taxable savings
              after estimated federal tax is withheld. When unchecked, P2&apos;s share is treated as discretionary
              spending not captured in your expense categories.
            </span>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
