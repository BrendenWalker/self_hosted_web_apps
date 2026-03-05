import React, { useState, useEffect } from 'react';
import { getHousehold, updateHousehold } from '../api/api';

const FILING_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married_filing_jointly', label: 'Married filing jointly' },
  { value: 'married_filing_separately', label: 'Married filing separately' },
  { value: 'head_of_household', label: 'Head of household' },
];

// SSA-style factors for FRA 67: 62 ≈ 70%, 67 = 100%, 70 ≈ 124%
function ssFactorAtAge(age) {
  if (age <= 62) return 0.70;
  if (age >= 70) return 1.24;
  if (age <= 67) return 0.70 + (age - 62) * (0.30 / 5);
  return 1.0 + (age - 67) * (0.24 / 3);
}

function ssMonthlyAtAge(atFraMonthly, age) {
  if (atFraMonthly == null || !Number.isFinite(Number(atFraMonthly)) || Number(atFraMonthly) <= 0) return null;
  const n = Number(atFraMonthly);
  const a = Math.min(70, Math.max(62, age));
  return Math.round(n * ssFactorAtAge(a) * 100) / 100;
}

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
    p1_ss_at_fra: '',
    p2_ss_at_fra: '',
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
        p1_ss_at_fra: h.p1_ss_at_fra != null && h.p1_ss_at_fra !== '' ? String(h.p1_ss_at_fra) : '',
        p2_ss_at_fra: h.p2_ss_at_fra != null && h.p2_ss_at_fra !== '' ? String(h.p2_ss_at_fra) : '',
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
    let next = value;
    if (name === 'p1_birth_year' || name === 'p2_birth_year') {
      if (value !== '') {
        const v = parseInt(value, 10);
        if (Number.isFinite(v)) next = String(Math.min(2100, Math.max(1900, v)));
      }
    } else if (name === 'p1_ss_at_fra' || name === 'p2_ss_at_fra') {
      if (value !== '') {
        const v = parseFloat(value);
        if (Number.isFinite(v) && v < 0) next = '0';
      }
    }
    setForm((prev) => ({ ...prev, [name]: next }));
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
        p1_ss_at_fra: form.p1_ss_at_fra !== '' ? form.p1_ss_at_fra : undefined,
        p2_ss_at_fra: form.p2_ss_at_fra !== '' ? form.p2_ss_at_fra : undefined,
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
          Retirement dates define when wage income stops and Social Security begins in Projections.
          Enter each party’s expected monthly benefit at full retirement age (67); we derive early (62), normal (67), and late (70) and use your retirement age to set the starting benefit in Projections. P2: leave blank for spousal benefit (calculated from P1’s at-FRA amount and P2’s age at retirement).
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
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="p1_ss_at_fra">P1 SS at full retirement age (67) $/mo</label>
              <input
                id="p1_ss_at_fra"
                name="p1_ss_at_fra"
                type="number"
                min="0"
                step="0.01"
                value={form.p1_ss_at_fra}
                onChange={handleChange}
                placeholder="e.g. 3000"
                title="Monthly benefit at age 67. We derive early (62), normal (67), and late (70) and use your retirement age for Projections."
              />
            </div>
            <div className="form-group">
              <label htmlFor="p2_ss_at_fra">P2 SS at full retirement age (67) $/mo</label>
              <input
                id="p2_ss_at_fra"
                name="p2_ss_at_fra"
                type="number"
                min="0"
                step="0.01"
                value={form.p2_ss_at_fra}
                onChange={handleChange}
                placeholder="Leave blank for spousal"
                title="P2's own benefit at 67, or leave blank for spousal (calculated from P1's amount and P2's age at retirement)."
              />
            </div>
          </div>
          {(() => {
            const p1AtFra = form.p1_ss_at_fra !== '' ? parseFloat(form.p1_ss_at_fra) : null;
            const p2AtFra = form.p2_ss_at_fra !== '' ? parseFloat(form.p2_ss_at_fra) : null;
            const p1By = form.p1_birth_year ? parseInt(form.p1_birth_year, 10) : null;
            const p2By = form.p2_birth_year ? parseInt(form.p2_birth_year, 10) : null;
            const p1RetYear = form.p1_retirement_date ? parseInt(String(form.p1_retirement_date).slice(0, 4), 10) : null;
            const p2RetYear = form.p2_retirement_date ? parseInt(String(form.p2_retirement_date).slice(0, 4), 10) : null;
            const p1Age = p1By != null && p1RetYear != null ? p1RetYear - p1By : null;
            const p2Age = p2By != null && p2RetYear != null ? p2RetYear - p2By : null;
            const hasAnyAtFra = Number.isFinite(p1AtFra) || Number.isFinite(p2AtFra);
            const p2SpousalAtAge = (Number.isFinite(p1AtFra) && p1AtFra > 0 && !Number.isFinite(p2AtFra) && p2Age != null && p2Age >= 62 && p2Age <= 70)
              ? Math.round(0.5 * p1AtFra * ssFactorAtAge(p2Age) * 100) / 100
              : null;
            if (!hasAnyAtFra && p2SpousalAtAge == null) return null;
            return (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f5f7f6', borderRadius: 6, fontSize: '0.9rem' }}>
                <strong>From SS at age 67:</strong> Early (62) ≈ 70% · Normal (67) = 100% · Late (70) ≈ 124%
                {(Number.isFinite(p1AtFra) && p1AtFra > 0) && (
                  <div style={{ marginTop: '0.5rem' }}>
                    P1: 62 → ${ssMonthlyAtAge(p1AtFra, 62)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo · 67 → ${ssMonthlyAtAge(p1AtFra, 67)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo · 70 → ${ssMonthlyAtAge(p1AtFra, 70)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo
                    {p1Age != null && p1Age >= 62 && p1Age <= 70 && (
                      <span style={{ marginLeft: '0.5rem' }}> · At your retirement age ({p1Age}): ${ssMonthlyAtAge(p1AtFra, p1Age)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo</span>
                    )}
                  </div>
                )}
                {(Number.isFinite(p2AtFra) && p2AtFra > 0) && (
                  <div style={{ marginTop: '0.25rem' }}>
                    P2: 62 → ${ssMonthlyAtAge(p2AtFra, 62)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo · 67 → ${ssMonthlyAtAge(p2AtFra, 67)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo · 70 → ${ssMonthlyAtAge(p2AtFra, 70)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo
                    {p2Age != null && p2Age >= 62 && p2Age <= 70 && (
                      <span style={{ marginLeft: '0.5rem' }}> · At your retirement age ({p2Age}): ${ssMonthlyAtAge(p2AtFra, p2Age)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo</span>
                    )}
                  </div>
                )}
                {p2SpousalAtAge != null && (
                  <div style={{ marginTop: '0.25rem' }}>
                    P2 (spousal, at age {p2Age}): ${p2SpousalAtAge.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo
                  </div>
                )}
              </div>
            );
          })()}
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
