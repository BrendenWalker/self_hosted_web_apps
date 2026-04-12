import React, { useEffect, useState } from 'react';
import {
  fetchAdminOverview,
  recalcTrend,
  testAdminEmail,
  updateAdminSettings,
  updateAdminUser,
} from '../api/client';

const MAIL_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USE_SSL',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'EMAIL_TO',
  'SUMMARY_DAY',
  'SUMMARY_HOUR',
  'SUMMARY_TZ',
];

export default function AdminPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({});
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const d = await fetchAdminOverview();
    setData(d);
    setSettings({ ...d.settings });
  };

  useEffect(() => {
    load().catch((e) => setError(e.response?.data?.error || e.message));
  }, []);

  const saveSettings = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await updateAdminSettings(settings);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setError('');
    try {
      await testAdminEmail(testTo);
      alert('Test email request sent (check server logs if it fails).');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const runRecalc = async () => {
    if (!window.confirm('Recalculate toilet trend/variance for all rows?')) return;
    setBusy(true);
    setError('');
    try {
      const r = await recalcTrend();
      alert(`Updated ${r.updated ?? 0}, skipped ${r.skipped ?? 0}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return error ? <div className="error-banner">{error}</div> : <p className="muted">Loading…</p>;
  }

  return (
    <div className="page">
      <h1>Admin</h1>
      {error ? <div className="error-banner">{error}</div> : null}
      <section className="card">
        <h2>Users</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Active</th>
              <th>Admin</th>
              <th>Password</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <UserRow key={u.id} user={u} onSaved={load} onError={setError} busy={busy} setBusy={setBusy} />
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Mail &amp; summary settings</h2>
        <form className="stack" onSubmit={saveSettings}>
          {MAIL_KEYS.map((k) => (
            <label key={k}>
              {k}
              <input
                value={settings[k] ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
              />
            </label>
          ))}
          <button type="submit" className="primary" disabled={busy}>
            Save settings
          </button>
        </form>
        <div className="row gap" style={{ marginTop: 12 }}>
          <input
            type="email"
            placeholder="Test recipient"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button type="button" className="secondary" disabled={busy} onClick={sendTest}>
            Send test email
          </button>
        </div>
      </section>
      <section className="card">
        <h2>Maintenance</h2>
        <button type="button" className="secondary" disabled={busy} onClick={runRecalc}>
          Recalculate toilet trends
        </button>
      </section>
    </div>
  );
}

function UserRow({ user, onSaved, onError, busy, setBusy }) {
  const [email, setEmail] = useState(user.email);
  const [isActive, setIsActive] = useState(user.is_active);
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const [password, setPassword] = useState('');

  const save = async () => {
    setBusy(true);
    onError('');
    try {
      const body = { email, is_active: isActive, is_admin: isAdmin };
      if (password) body.password = password;
      await updateAdminUser(user.id, body);
      setPassword('');
      await onSaved();
    } catch (err) {
      onError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </td>
      <td>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      </td>
      <td>
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
      </td>
      <td>
        <input
          type="password"
          placeholder="(unchanged)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </td>
      <td>
        <button type="button" className="secondary" disabled={busy} onClick={save}>
          Save
        </button>
      </td>
    </tr>
  );
}
