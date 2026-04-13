import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOfflineQueue } from '../context/OfflineQueueContext';
import { getOfflineQueueCount } from '../utils/offlineActivityQueue';
import {
  fetchDashboard,
  fetchLatestByType,
  fetchSpeedometer,
  setDefaultPet,
  getDefaultPet,
} from '../api/client';

const DEFAULT_PET_LS = 'pethub_default_pet_id';

function ageLabel(birthStr) {
  if (!birthStr) return '';
  const birth = new Date(birthStr);
  if (Number.isNaN(birth.getTime())) return '';
  const days = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24));
  const weeksExact = days / 7;
  if (weeksExact < 26) {
    const whole = Math.floor(weeksExact);
    const plus = weeksExact - whole > 0 ? '+' : '';
    return `${whole}${plus} wk${whole === 1 && !plus ? '' : 's'}`;
  }
  const months = Math.floor(days / 30.4375);
  return `${months} mo${months === 1 ? '' : 's'}`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const today = new Date();
  const label =
    d.toDateString() === today.toDateString() ? 'Today' : d.toLocaleDateString();
  return `${label} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

/** Horizontal bar: elapsed time since last event vs typical gap (average). */
function PottyGapBar({ hoursSince, avgHours, accentColor }) {
  const hasSince = hoursSince != null && Number.isFinite(Number(hoursSince));
  const hasAvg = avgHours != null && Number.isFinite(Number(avgHours)) && Number(avgHours) > 0;
  const since = hasSince ? Number(hoursSince) : 0;
  const avg = hasAvg ? Number(avgHours) : 0;

  if (!hasSince && !hasAvg) return null;

  const maxScale = Math.max(hasSince ? since : 0, hasAvg ? avg : 0, 0.25) * 1.15;
  const fillPct = hasSince ? Math.min(100, (since / maxScale) * 100) : 0;
  const avgPct = hasAvg ? Math.min(100, (avg / maxScale) * 100) : null;

  let fillColor = accentColor;
  if (hasSince && hasAvg) {
    const ratio = since / avg;
    if (ratio >= 1) fillColor = '#dc2626';
    else if (ratio >= 0.6) fillColor = '#d97706';
    else fillColor = '#059669';
  }

  const ratio = hasSince && hasAvg ? since / avg : null;
  let statusLine = null;
  if (ratio != null) {
    if (ratio >= 1) statusLine = `${(ratio * 100 - 100).toFixed(0)}% past typical gap`;
    else statusLine = `${(100 - ratio * 100).toFixed(0)}% of typical gap remaining`;
  } else if (hasSince && !hasAvg) {
    statusLine = 'Typical gap: need more history';
  } else if (!hasSince && hasAvg) {
    statusLine = `Typical gap about ${avg.toFixed(1)} h — log an event to track`;
  }

  const aria = [
    hasSince ? `${since.toFixed(1)} hours since last` : 'No time since last logged',
    hasAvg ? `typical gap ${avg.toFixed(1)} hours` : 'no typical gap yet',
  ].join('; ');

  return (
    <div className="potty-gap-wrap">
      <div
        className="potty-gap-track"
        role="img"
        aria-label={aria}
      >
        {hasSince ? (
          <div
            className="potty-gap-fill"
            style={{ width: `${fillPct}%`, background: fillColor }}
          />
        ) : null}
        {avgPct != null ? (
          <div
            className="potty-gap-avg"
            style={{ left: `${avgPct}%` }}
            title={`Typical gap (~${avg.toFixed(1)} h)`}
          >
            <span className="potty-gap-avg-cap">Avg</span>
          </div>
        ) : null}
      </div>
      <div className="potty-gap-scale">
        <span>0 h</span>
        <span>{maxScale.toFixed(1)} h</span>
      </div>
      {statusLine ? <p className="potty-gap-status">{statusLine}</p> : null}
    </div>
  );
}

function Meter({ title, data, color }) {
  const block = data?.[title === 'Poop' ? 'poop' : 'pee'];
  if (!block) {
    return (
      <div className="meter-card">
        <h3>{title}</h3>
        <p className="muted">—</p>
      </div>
    );
  }
  const { hours_since: hoursSince, avg_hours: avgHours, last_time: lastTime } = block;
  const hasAny = hoursSince != null || avgHours != null || lastTime;
  if (!hasAny) {
    return (
      <div className="meter-card">
        <h3>{title}</h3>
        <p className="muted">No data yet</p>
      </div>
    );
  }

  return (
    <div className="meter-card">
      <h3>{title}</h3>
      <p className="meter-big">
        {hoursSince != null ? `${hoursSince} h ago` : 'No recent log'}
      </p>
      <p className="muted small">
        Avg gap: {avgHours != null ? `${avgHours} h` : '—'}
        {lastTime ? (
          <>
            {' '}
            · Last {fmtTime(lastTime)}
          </>
        ) : null}
      </p>
      <PottyGapBar hoursSince={hoursSince} avgHours={avgHours} accentColor={color} />
    </div>
  );
}

export default function HomePage() {
  const { postActivityResilient } = useOfflineQueue();
  const [pets, setPets] = useState([]);
  const [petId, setPetId] = useState(() => localStorage.getItem(DEFAULT_PET_LS) || '');
  const [latest, setLatest] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [wizard, setWizard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const dash = await fetchDashboard();
    setPets(dash.pets || []);
    const serverDefault = (await getDefaultPet()).default_pet_id;
    const fromLs = localStorage.getItem(DEFAULT_PET_LS);
    const pick =
      (fromLs && dash.pets?.some((p) => String(p.id) === fromLs) && fromLs) ||
      (serverDefault && dash.pets?.some((p) => p.id === serverDefault) ? String(serverDefault) : '') ||
      (dash.pets?.[0] ? String(dash.pets[0].id) : '');
    setPetId(pick);
    if (pick) localStorage.setItem(DEFAULT_PET_LS, pick);
  }, []);

  useEffect(() => {
    load().catch(() => setErr('Could not load dashboard'));
  }, [load]);

  const refreshSummaries = useCallback(async () => {
    if (!petId) {
      setLatest(null);
      setSpeed(null);
      return;
    }
    try {
      const [l, s] = await Promise.all([
        fetchLatestByType(petId),
        fetchSpeedometer(petId),
      ]);
      setLatest(l.ok ? l.latest : null);
      setSpeed(s);
    } catch {
      setLatest(null);
      setSpeed(null);
    }
  }, [petId]);

  useEffect(() => {
    refreshSummaries();
  }, [refreshSummaries]);

  useEffect(() => {
    const onSynced = () => {
      refreshSummaries();
    };
    window.addEventListener('pethub-offline-queue-synced', onSynced);
    return () => window.removeEventListener('pethub-offline-queue-synced', onSynced);
  }, [refreshSummaries]);

  const selectedPet = useMemo(() => pets.find((p) => String(p.id) === String(petId)), [pets, petId]);

  const onPetChange = async (e) => {
    const v = e.target.value;
    setPetId(v);
    localStorage.setItem(DEFAULT_PET_LS, v);
    try {
      await setDefaultPet(v === '' ? '' : Number(v));
    } catch {
      /* optional */
    }
    refreshSummaries();
  };

  const saveActivity = async (payload) => {
    setSaving(true);
    setErr('');
    try {
      const data = await postActivityResilient(payload);
      if (data.queued) {
        window.alert(
          navigator.onLine
            ? `Unable to reach the server quickly. Activity saved locally and will sync when you are back online (${data.queueLength} pending).`
            : `No network connection. Activity saved locally and will sync later (${data.queueLength} pending).`
        );
        setWizard(null);
      } else {
        if (!data.ok) throw new Error(data.error || 'Save failed');
        await refreshSummaries();
        setWizard(null);
      }
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const doubleGood = async () => {
    if (!petId) {
      setErr('Select a pet first.');
      return;
    }
    const now = new Date().toISOString();
    const base = { activity_type: 'toilet', location: 'outside', pet_id: Number(petId), created_at: now };
    setSaving(true);
    setErr('');
    try {
      const poop = await postActivityResilient({ ...base, sub_type: 'poop', rating: 2 });
      const pee = await postActivityResilient({ ...base, sub_type: 'pee', rating: 7 });
      const nQueued = (poop.queued ? 1 : 0) + (pee.queued ? 1 : 0);
      if (nQueued > 0) {
        const total = getOfflineQueueCount();
        window.alert(
          navigator.onLine
            ? `${nQueued} of 2 activities saved locally and will sync when the connection is stable (${total} pending).`
            : `No network connection. ${nQueued} of 2 activities saved locally (${total} pending).`
        );
      }
      await refreshSummaries();
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      {err ? <div className="error-banner">{err}</div> : null}
      <section className="card">
        <div className="row-between">
          <h2>Activities</h2>
          <div className="row gap">
            <label>
              Selected pet
              <select value={petId} onChange={onPetChange}>
                <option value="">(none)</option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="age-pill">{ageLabel(selectedPet?.birthdate)}</span>
          </div>
        </div>
        <div className="tiles">
          <button type="button" className="tile" disabled={saving} onClick={doubleGood}>
            <span className="tile-icon">👌</span>
            <span>Double Good</span>
          </button>
          <button type="button" className="tile" disabled={saving} onClick={() => setWizard({ type: 'toilet' })}>
            <span className="tile-icon">🚽</span>
            <span>Toilet</span>
          </button>
          <button type="button" className="tile" disabled={saving} onClick={() => setWizard({ type: 'water' })}>
            <span className="tile-icon">💧</span>
            <span>Water</span>
          </button>
          <button type="button" className="tile" disabled={saving} onClick={() => setWizard({ type: 'food' })}>
            <span className="tile-icon">🍖</span>
            <span>Food</span>
          </button>
          <button type="button" className="tile" disabled={saving} onClick={() => setWizard({ type: 'notes' })}>
            <span className="tile-icon">📝</span>
            <span>Notes</span>
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Potty status</h2>
        <div className="meter-row">
          <Meter title="Pee" data={speed} color="#3b82f6" />
          <Meter title="Poop" data={speed} color="#b45309" />
        </div>
      </section>

      <section className="card">
        <h2>Recent by type</h2>
        <div className="grid-4">
          <div className="mini-card">
            <div className="muted">Pee</div>
            <div>{fmtTime(latest?.pee?.created_at)}</div>
          </div>
          <div className="mini-card">
            <div className="muted">Poop</div>
            <div>{fmtTime(latest?.poop?.created_at)}</div>
          </div>
          <div className="mini-card">
            <div className="muted">Water</div>
            <div>{fmtTime(latest?.water?.created_at)}</div>
          </div>
          <div className="mini-card">
            <div className="muted">Food</div>
            <div>{fmtTime(latest?.food?.created_at)}</div>
          </div>
        </div>
      </section>

      {wizard ? (
        <div className="modal-overlay" role="presentation" onClick={() => !saving && setWizard(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <WizardBody
              wizard={wizard}
              setWizard={setWizard}
              petId={petId}
              saving={saving}
              onSave={saveActivity}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WizardBody({ wizard, setWizard, petId, saving, onSave }) {
  const [subType, setSubType] = useState('pee');
  const [location, setLocation] = useState('outside');
  const [rating, setRating] = useState(4);
  const [notes, setNotes] = useState('');

  if (wizard.type === 'toilet') {
    return (
      <div className="stack">
        <h3>Toilet</h3>
        <label>
          Type
          <select value={subType} onChange={(e) => setSubType(e.target.value)}>
            <option value="pee">Pee</option>
            <option value="poop">Poop</option>
          </select>
        </label>
        <label>
          Location
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="inside">Inside</option>
            <option value="outside">Outside</option>
          </select>
        </label>
        <label>
          Rating (1–7)
          <input
            type="range"
            min={1}
            max={7}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          />
          <span>{rating}</span>
        </label>
        <div className="row gap end">
          <button type="button" className="secondary" onClick={() => setWizard(null)} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={saving || !petId}
            onClick={() =>
              onSave({
                activity_type: 'toilet',
                sub_type: subType,
                location,
                rating,
                pet_id: Number(petId),
                notes: null,
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  if (wizard.type === 'water' || wizard.type === 'food') {
    return (
      <div className="stack">
        <h3>{wizard.type === 'water' ? 'Water' : 'Food'}</h3>
        <label>
          Rating (1–7)
          <input
            type="range"
            min={1}
            max={7}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          />
          <span>{rating}</span>
        </label>
        <div className="row gap end">
          <button type="button" className="secondary" onClick={() => setWizard(null)} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={saving || !petId}
            onClick={() =>
              onSave({
                activity_type: wizard.type,
                rating,
                pet_id: Number(petId),
                notes: null,
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  if (wizard.type === 'notes') {
    return (
      <div className="stack">
        <h3>Notes</h3>
        <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="row gap end">
          <button type="button" className="secondary" onClick={() => setWizard(null)} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={saving || !petId}
            onClick={() =>
              onSave({
                activity_type: 'notes',
                notes,
                pet_id: Number(petId),
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return null;
}
