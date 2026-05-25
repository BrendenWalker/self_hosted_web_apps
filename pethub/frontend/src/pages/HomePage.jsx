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

/** Value for `<input type="datetime-local">` in local time. */
function toDatetimeLocalValue(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function datetimeLocalToISO(localStr) {
  if (!localStr?.trim()) return new Date().toISOString();
  const d = new Date(localStr);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/** Semi-circle speedometer: time since last vs benchmark hours (needle sweeps toward “due”). */
function PottySpeedometerGauge({ hoursSince, avgHours, label }) {
  const avg = avgHours != null ? Number(avgHours) : NaN;
  const hs = hoursSince != null ? Number(hoursSince) : 0;
  if (!Number.isFinite(avg) || avg <= 0) {
    return (
      <div className="meter-speedo-empty-gauge muted small" role="img" aria-label={label}>
        No benchmark
      </div>
    );
  }

  const percentage = (hs / avg) * 100;
  let arcColor = '#10b981';
  if (percentage >= 100) arcColor = '#ef4444';
  else if (percentage >= 60) arcColor = '#f59e0b';

  const size = 168;
  const center = size / 2;
  const radius = size / 2 - 14;
  const ratio = Math.min(hs / avg, 1.0);
  const angleRad = Math.PI * (1 - ratio);
  const startAngle = Math.PI;
  const endAngle = angleRad;
  const endX = center + radius * Math.cos(endAngle);
  const endY = center - radius * Math.sin(endAngle);
  const startX = center + radius * Math.cos(startAngle);
  const startY = center - radius * Math.sin(startAngle);
  const sweepAngle = Math.PI - angleRad;
  const largeArc = sweepAngle > Math.PI ? 1 : 0;
  const h = size / 2 + 14;

  const aria = `${label}: ${hs.toFixed(1)} h since last, benchmark ${avg.toFixed(1)} h`;

  return (
    <svg
      className="potty-speedo-svg"
      width={size}
      height={h}
      viewBox={`0 0 ${size} ${h}`}
      role="img"
      aria-label={aria}
    >
      <path
        d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${size - 14} ${center}`}
        stroke="#e5e7eb"
        strokeWidth="10"
        fill="none"
      />
      <path
        d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`}
        stroke={arcColor}
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      <line
        x1={center}
        y1={center}
        x2={endX}
        y2={endY}
        stroke="#111827"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx={center} cy={center} r={5} fill="#111827" />
    </svg>
  );
}

function SpeedoPctLine({ hoursSince, avgHours }) {
  const avg = avgHours != null ? Number(avgHours) : NaN;
  const hs = hoursSince != null ? Number(hoursSince) : NaN;
  if (!Number.isFinite(avg) || avg <= 0 || !Number.isFinite(hs)) return null;
  const pct = (hs / avg) * 100;
  const over = pct >= 100;
  const text = over
    ? `${(pct - 100).toFixed(0)}% past benchmark`
    : `${(100 - pct).toFixed(0)}% to benchmark`;
  return <p className={`meter-speedo-pct${over ? ' is-over' : ''}`}>{text}</p>;
}

function DualMethodMeter({ title, data }) {
  const block = data?.[title === 'Poop' ? 'poop' : 'pee'];
  if (!block) {
    return (
      <div className="meter-card">
        <h3>{title}</h3>
        <p className="muted">—</p>
      </div>
    );
  }
  const {
    hours_since: hoursSince,
    avg_hours: avgLegacy,
    avg_hours_new_method: avgNew,
  } = block;
  const hasAny =
    hoursSince != null || avgLegacy != null || avgNew != null;
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
      <div className="meter-card-head">
        <h3 className="meter-card-title">{title}</h3>
        <span className={`meter-ago${hoursSince == null ? ' muted' : ''}`}>
          {hoursSince != null ? `${hoursSince} h ago` : 'No recent log'}
        </span>
      </div>

      <div className="meter-speedo-row">
        <div className="meter-speedo-cell meter-speedo-cell-ema">
          <div className="meter-speedo-gauge-wrap">
            <PottySpeedometerGauge
              hoursSince={hoursSince}
              avgHours={avgLegacy}
              label="EMA trend legacy"
            />
          </div>
          <div className="meter-speedo-details">
            <div className="meter-speedo-method-title">EMA trend (legacy)</div>
            <p className="muted small meter-speedo-bench">
              {avgLegacy != null ? `Benchmark: ${avgLegacy} h` : 'No benchmark yet'}
            </p>
            <SpeedoPctLine hoursSince={hoursSince} avgHours={avgLegacy} />
          </div>
        </div>
        <div className="meter-speedo-cell meter-speedo-cell-new">
          <div className="meter-speedo-gauge-wrap">
            {avgNew != null ? (
              <PottySpeedometerGauge
                hoursSince={hoursSince}
                avgHours={avgNew}
                label="Rest-span estimate"
              />
            ) : (
              <div className="meter-speedo-empty-gauge muted small">—</div>
            )}
          </div>
          <div className="meter-speedo-details">
            <div className="meter-speedo-method-title is-new">New method (rest-span)</div>
            <p className="muted small meter-speedo-bench">
              {avgNew != null ? `Benchmark: ${avgNew} h` : 'No benchmark yet'}
            </p>
            {avgNew != null ? <SpeedoPctLine hoursSince={hoursSince} avgHours={avgNew} /> : null}
            {avgNew == null ? (
              <p className="muted small meter-speedo-hint">
                Not shown for &quot;all&quot; pets, or when history is too sparse to infer rest-span holds.
              </p>
            ) : null}
          </div>
        </div>
      </div>
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
          <DualMethodMeter title="Pee" data={speed} />
          <DualMethodMeter title="Poop" data={speed} />
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
  const [rating, setRating] = useState(7);
  const [notes, setNotes] = useState('');
  const [eventAt, setEventAt] = useState(() => toDatetimeLocalValue());

  useEffect(() => {
    setEventAt(toDatetimeLocalValue());
    if (wizard.type === 'toilet') {
      setSubType('pee');
      setLocation('outside');
      setRating(7);
      setNotes('');
    } else if (wizard.type === 'water') {
      setRating(4);
      setNotes('');
    } else if (wizard.type === 'food') {
      setRating(7);
      setNotes('');
    } else if (wizard.type === 'notes') {
      setNotes('');
    }
  }, [wizard]);

  const createdAt = datetimeLocalToISO(eventAt);

  if (wizard.type === 'toilet') {
    return (
      <div className="stack">
        <h3>Toilet</h3>
        <ChoiceButtons
          label="Type"
          value={subType}
          onChange={(v) => {
            setSubType(v);
            setRating(v === 'pee' ? 7 : 4);
          }}
          options={[
            { value: 'pee', label: 'Pee', icon: '💦' },
            { value: 'poop', label: 'Poop', icon: '💩' },
          ]}
        />
        <ChoiceButtons
          label="Location"
          value={location}
          onChange={setLocation}
          options={[
            { value: 'inside', label: 'Inside', icon: '🏠' },
            { value: 'outside', label: 'Outside', icon: '🌳' },
          ]}
        />
        <label>
          {subType === 'pee' ? 'Pee amount (1–7)' : 'Poop score (1–7)'}
          <div className="row gap" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="range"
              min={1}
              max={7}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            />
            <span>{rating}</span>
          </div>
          {subType === 'pee' ? (
            <div className="row-between muted small" style={{ marginTop: 4 }}>
              <span>Little bit</span>
              <span>Full pee</span>
            </div>
          ) : null}
        </label>
        <label>
          Date and time
          <input
            type="datetime-local"
            value={eventAt}
            onChange={(e) => setEventAt(e.target.value)}
          />
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
                created_at: createdAt,
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
        <label>
          Date and time
          <input
            type="datetime-local"
            value={eventAt}
            onChange={(e) => setEventAt(e.target.value)}
          />
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
                created_at: createdAt,
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
        <label>
          Date and time
          <input
            type="datetime-local"
            value={eventAt}
            onChange={(e) => setEventAt(e.target.value)}
          />
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
                activity_type: 'notes',
                notes,
                pet_id: Number(petId),
                created_at: createdAt,
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

function ChoiceButtons({ label, value, onChange, options }) {
  return (
    <div>
      <div>{label}</div>
      <div className="choice-row" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`choice-btn${value === opt.value ? ' selected' : ''}`}
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            <span className="choice-btn-icon" aria-hidden>
              {opt.icon}
            </span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
