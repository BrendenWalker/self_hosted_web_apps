import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { deleteActivity, fetchActivities, fetchDailyCounts, fetchPottyHold, fetchPottyLocation, fetchPets } from '../api/client';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function useFilterParams() {
  const [petId, setPetId] = useState('all');
  const [activityType, setActivityType] = useState('all');
  const [subType, setSubType] = useState('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (petId && petId !== 'all') p.set('pet_id', petId);
    if (activityType && activityType !== 'all') p.set('activity_type', activityType);
    if (subType && subType !== 'all') p.set('sub_type', subType);
    if (start) {
      const d = start.includes('T') ? new Date(start) : new Date(`${start}T00:00:00Z`);
      p.set('start', d.toISOString());
    }
    if (end) {
      const d = end.includes('T') ? new Date(end) : new Date(`${end}T23:59:59.999Z`);
      p.set('end', d.toISOString());
    }
    return p;
  }, [petId, activityType, subType, start, end]);

  return {
    petId,
    setPetId,
    activityType,
    setActivityType,
    subType,
    setSubType,
    start,
    setStart,
    end,
    setEnd,
    params,
  };
}

function FilterBar({ pets, f, showTypeFilters }) {
  return (
    <div className="card stack small-gap">
      <div className="row gap wrap">
        <label>
          Pet
          <select value={f.petId} onChange={(e) => f.setPetId(e.target.value)}>
            <option value="all">All</option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {showTypeFilters ? (
          <>
            <label>
              Type
              <select value={f.activityType} onChange={(e) => f.setActivityType(e.target.value)}>
                <option value="all">All</option>
                <option value="toilet">Toilet</option>
                <option value="water">Water</option>
                <option value="food">Food</option>
                <option value="notes">Notes</option>
              </select>
            </label>
            <label>
              Sub type
              <select value={f.subType} onChange={(e) => f.setSubType(e.target.value)}>
                <option value="all">All</option>
                <option value="poop">Poop</option>
                <option value="pee">Pee</option>
              </select>
            </label>
          </>
        ) : null}
        <label>
          From
          <input type="date" value={f.start} onChange={(e) => f.setStart(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={f.end} onChange={(e) => f.setEnd(e.target.value)} />
        </label>
        <button type="button" className="secondary" onClick={() => {
          f.setPetId('all');
          f.setActivityType('all');
          f.setSubType('all');
          f.setStart('');
          f.setEnd('');
        }}>
          Clear
        </button>
      </div>
    </div>
  );
}

function ActivityTab({ pets, f }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await fetchActivities(Object.fromEntries(f.params.entries()));
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  }, [f.params]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const exportCsv = () => {
    window.open(`/api/export.csv?${f.params.toString()}`, '_blank');
  };

  const openReport = () => {
    window.open(`/api/report?${f.params.toString()}`, '_blank');
  };

  return (
    <div className="stack">
      {err ? <div className="error-banner">{err}</div> : null}
      <FilterBar pets={pets} f={f} showTypeFilters />
      <div className="row gap">
        <button type="button" className="secondary" onClick={refresh}>
          Apply filters
        </button>
        <button type="button" className="secondary" onClick={exportCsv}>
          Export CSV
        </button>
        <button type="button" className="secondary" onClick={openReport}>
          Report JSON
        </button>
      </div>
      <div className="card">
        <h2>Activity table</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Pet</th>
                <th>Type</th>
                <th>Details</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                  <td>{a.pet_name}</td>
                  <td>{a.activity_type}</td>
                  <td>
                    {a.activity_type === 'toilet'
                      ? [a.sub_type, a.location, a.rating ? `score ${a.rating}` : ''].filter(Boolean).join(' • ')
                      : a.activity_type === 'water' || a.activity_type === 'food'
                        ? a.rating || a.notes || ''
                        : a.notes || ''}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-btn danger"
                      onClick={async () => {
                        if (!window.confirm('Delete?')) return;
                        await deleteActivity(a.id);
                        refresh();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function normalizeHoldSeries(raw, daysLen) {
  let trend = [];
  let min = [];
  let max = [];
  if (Array.isArray(raw)) trend = raw;
  else if (raw && typeof raw === 'object') {
    trend = raw.trend || [];
    min = raw.min || [];
    max = raw.max || [];
  }
  const pad = (arr) => {
    const a = Array.isArray(arr) ? arr.slice() : [];
    while (a.length < daysLen) a.push(null);
    return a.length > daysLen ? a.slice(0, daysLen) : a;
  };
  return { trend: pad(trend), min: pad(min), max: pad(max) };
}

function DailyTab({ pets, f }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await fetchDailyCounts(Object.fromEntries(f.params.entries()));
      if (!cancelled) setData(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [f.params]);
  if (!data?.days) return <p className="muted">No data</p>;
  const datasets = data.series.map((act) => ({
    label: act,
    data: data.days.map((day) => (data.values[day] && data.values[day][act]) || 0),
    fill: true,
  }));
  return (
    <div className="card">
      <FilterBar pets={pets} f={f} showTypeFilters={false} />
      <Line
        data={{ labels: data.days, datasets }}
        options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
      />
    </div>
  );
}

function HoldTab({ pets, f }) {
  const [potty, setPotty] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await fetchPottyHold(Object.fromEntries(f.params.entries()));
      if (!cancelled) setPotty(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [f.params]);
  if (!potty?.days?.length) return <p className="muted">No potty hold data</p>;
  const n = potty.days.length;
  const poop = normalizeHoldSeries(potty.poop, n);
  const pee = normalizeHoldSeries(potty.pee, n);
  return (
    <div className="stack">
      <FilterBar pets={pets} f={f} showTypeFilters={false} />
      <div className="card">
        <h3>Poop</h3>
        <Line
          data={{
            labels: potty.days,
            datasets: [
              { label: 'Trend (h)', data: poop.trend, borderColor: '#dc2626', spanGaps: true },
              { label: 'Min gap', data: poop.min, borderColor: '#16a34a', borderDash: [6, 4], spanGaps: true },
              { label: 'Max gap', data: poop.max, borderColor: '#eab308', borderDash: [2, 3], spanGaps: true },
            ],
          }}
          options={{
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } },
          }}
        />
      </div>
      <div className="card">
        <h3>Pee</h3>
        <Line
          data={{
            labels: potty.days,
            datasets: [
              { label: 'Trend (h)', data: pee.trend, borderColor: '#3b82f6', spanGaps: true },
              { label: 'Min gap', data: pee.min, borderColor: '#14b8a6', borderDash: [6, 4], spanGaps: true },
              { label: 'Max gap', data: pee.max, borderColor: '#a855f7', borderDash: [2, 3], spanGaps: true },
            ],
          }}
          options={{
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } },
          }}
        />
      </div>
    </div>
  );
}

function LocationTab({ pets, f }) {
  const [loc, setLoc] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await fetchPottyLocation(Object.fromEntries(f.params.entries()));
      if (!cancelled) setLoc(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [f.params]);
  if (!loc?.days?.length) return <p className="muted">No location data</p>;
  return (
    <div className="card">
      <FilterBar pets={pets} f={f} showTypeFilters={false} />
      <Line
        data={{
          labels: loc.days,
          datasets: [
            { label: 'Inside', data: loc.inside, borderColor: '#ef4444', fill: true },
            { label: 'Outside', data: loc.outside, borderColor: '#22c55e', fill: true },
          ],
        }}
        options={{
          responsive: true,
          plugins: { legend: { position: 'bottom' } },
          scales: { y: { beginAtZero: true } },
        }}
      />
    </div>
  );
}

export default function ReportsPage() {
  const f = useFilterParams();
  const [pets, setPets] = useState([]);

  useEffect(() => {
    fetchPets().then(setPets).catch(() => setPets([]));
  }, []);

  return (
    <div className="page">
      <h1>Reports</h1>
      <nav className="subnav">
        <NavLink to="/reports/activity" className={({ isActive }) => (isActive ? 'active' : '')}>
          Activity
        </NavLink>
        <NavLink to="/reports/daily" className={({ isActive }) => (isActive ? 'active' : '')}>
          Daily counts
        </NavLink>
        <NavLink to="/reports/hold" className={({ isActive }) => (isActive ? 'active' : '')}>
          Potty hold
        </NavLink>
        <NavLink to="/reports/location" className={({ isActive }) => (isActive ? 'active' : '')}>
          Potty location
        </NavLink>
      </nav>
      <Routes>
        <Route index element={<Navigate to="activity" replace />} />
        <Route path="activity" element={<ActivityTab pets={pets} f={f} />} />
        <Route path="daily" element={<DailyTab pets={pets} f={f} />} />
        <Route path="hold" element={<HoldTab pets={pets} f={f} />} />
        <Route path="location" element={<LocationTab pets={pets} f={f} />} />
        <Route path="*" element={<ActivityTab pets={pets} f={f} />} />
      </Routes>
    </div>
  );
}
