import React, { useState, useEffect } from 'react';
import { getHousehold, updateHousehold } from '../api/api';

const FILING_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married_filing_jointly', label: 'Married filing jointly' },
  { value: 'married_filing_separately', label: 'Married filing separately' },
  { value: 'head_of_household', label: 'Head of household' },
];

export default function HouseholdPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    p1_display_name: 'P1',
    p2_display_name: 'P2',
    p1_birth_year: '',
    p2_birth_year: '',
    p1_retirement_date: '',
    p2_retirement_date: '',
    filing_status: 'married_filing_jointly',
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getHousehold();
      const h = res.data;
      setData(h);
      setForm({
        p1_display_name: h.p1_display_name ?? 'P1',
        p2_display_name: h.p2_display_name ?? 'P2',
        p1_birth_year: h.p1_birth_year ?? '',
        p2_birth_year: h.p2_birth_year ?? '',
        p1_retirement_date: h.p1_retirement_date ? String(h.p1_retirement_date).slice(0, 10) : '',
        p2_retirement_date: h.p2_retirement_date ? String(h.p2_retirement_date).slice(0, 10) : '',
        filing_status: h.filing_status ?? 'married_filing_jointly',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load household' });
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
      await updateHousehold({
        p1_display_name: form.p1_display_name.trim() || 'P1',
        p2_display_name: form.p2_display_name.trim() || 'P2',
        p1_birth_year: form.p1_birth_year ? parseInt(form.p1_birth_year, 10) : undefined,
        p2_birth_year: form.p2_birth_year ? parseInt(form.p2_birth_year, 10) : undefined,
        p1_retirement_date: form.p1_retirement_date?.trim() || undefined,
        p2_retirement_date: form.p2_retirement_date?.trim() || undefined,
        filing_status: form.filing_status,
      });
      setMessage({ type: 'success', text: 'Household saved.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save household' });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return <p className="loading-message">Loading household…</p>;
  }

  return (
    <div>
      <h1 className="page-title">Household</h1>
      {message && (
        <div className={message.type === 'error' ? 'error-message' : 'success-message'}>
          {message.text}
        </div>
      )}
      <div className="card">
        <h2>P1 & P2</h2>
        <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.9rem' }}>
          Set display names and birth years for both parties. Birth years drive ages in future projections.
          Retirement dates are used when importing expenses: if the import &quot;As of&quot; date is on or after the (later) retirement date, amounts are pre-filled as retirement/mo; otherwise as current/mo.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="p1_display_name">P1 display name</label>
              <input
                id="p1_display_name"
                name="p1_display_name"
                type="text"
                value={form.p1_display_name}
                onChange={handleChange}
                placeholder="P1"
              />
            </div>
            <div className="form-group">
              <label htmlFor="p2_display_name">P2 display name</label>
              <input
                id="p2_display_name"
                name="p2_display_name"
                type="text"
                value={form.p2_display_name}
                onChange={handleChange}
                placeholder="P2"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="p1_birth_year">P1 birth year</label>
              <input
                id="p1_birth_year"
                name="p1_birth_year"
                type="number"
                min="1900"
                max="2100"
                value={form.p1_birth_year}
                onChange={handleChange}
                placeholder="e.g. 1970"
              />
            </div>
            <div className="form-group">
              <label htmlFor="p2_birth_year">P2 birth year</label>
              <input
                id="p2_birth_year"
                name="p2_birth_year"
                type="number"
                min="1900"
                max="2100"
                value={form.p2_birth_year}
                onChange={handleChange}
                placeholder="e.g. 1975"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="p1_retirement_date">P1 retirement date</label>
              <input
                id="p1_retirement_date"
                name="p1_retirement_date"
                type="date"
                value={form.p1_retirement_date}
                onChange={handleChange}
                title="Used with expense import: if As of date is on or after this (or P2's), amounts go to retirement/mo"
              />
            </div>
            <div className="form-group">
              <label htmlFor="p2_retirement_date">P2 retirement date</label>
              <input
                id="p2_retirement_date"
                name="p2_retirement_date"
                type="date"
                value={form.p2_retirement_date}
                onChange={handleChange}
                title="Used with expense import: if As of date is on or after this (or P1's), amounts go to retirement/mo"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="filing_status">Tax filing status</label>
            <select
              id="filing_status"
              name="filing_status"
              value={form.filing_status}
              onChange={handleChange}
            >
              {FILING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
