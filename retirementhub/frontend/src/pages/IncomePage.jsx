import React, { useState, useEffect } from 'react';
import { getIncome, updateIncome } from '../api/api';

export default function IncomePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    as_of: '',
    gross_salary: '',
    gross_salary_p2: '',
    expected_raise_pct: '',
    bonus_quarterly: '',
    four_o_one_k_pct: '',
    four_o_one_k_match_pct: '',
  });

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
        gross_salary: i.gross_salary != null ? String(i.gross_salary) : '',
        gross_salary_p2: i.gross_salary_p2 != null ? String(i.gross_salary_p2) : '',
        expected_raise_pct: i.expected_raise_pct != null ? String(i.expected_raise_pct) : '',
        bonus_quarterly: i.bonus_quarterly != null ? String(i.bonus_quarterly) : '',
        four_o_one_k_pct: i.four_o_one_k_pct != null ? String(i.four_o_one_k_pct) : '',
        four_o_one_k_match_pct: i.four_o_one_k_match_pct != null ? String(i.four_o_one_k_match_pct) : '',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load income' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      setSaving(true);
      await updateIncome({
        id: data?.id,
        as_of: form.as_of || undefined,
        gross_salary: form.gross_salary === '' ? undefined : parseFloat(form.gross_salary),
        gross_salary_p2: form.gross_salary_p2 === '' ? undefined : parseFloat(form.gross_salary_p2),
        expected_raise_pct: form.expected_raise_pct === '' ? undefined : parseFloat(form.expected_raise_pct),
        bonus_quarterly: form.bonus_quarterly === '' ? undefined : parseFloat(form.bonus_quarterly),
        four_o_one_k_pct: form.four_o_one_k_pct === '' ? undefined : parseFloat(form.four_o_one_k_pct),
        four_o_one_k_match_pct: form.four_o_one_k_match_pct === '' ? undefined : parseFloat(form.four_o_one_k_match_pct),
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
    <div>
      <h1 className="page-title">Income</h1>
      {message && (
        <div className={message.type === 'error' ? 'error-message' : 'success-message'}>
          {message.text}
        </div>
      )}
      <div className="card">
        <h2>Budget context</h2>
        <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.9rem' }}>
          Gross salary (P1 and optional P2), expected raise, bonus, and 401(k) contribution for planning. Used in later stages for savings and projections. Amounts are stored with an “as of” date so history is kept; the most recent snapshot is used.
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
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="expected_raise_pct">Expected annual raise %</label>
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
            <div className="form-group">
              <label htmlFor="bonus_quarterly">Net quarterly bonus $</label>
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
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
