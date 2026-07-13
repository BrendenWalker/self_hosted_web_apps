import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchPetsManage } from '../api/client';
import {
  buildTransitionSchedule,
  formatCups,
  getTransitionDayNumber,
  getTransitionStatus,
} from '../utils/foodTransition';

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

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString();
}

function statusLabel(status, dayNumber) {
  if (status === 'not_started') return 'Not started';
  if (status === 'complete') return 'Complete';
  if (status === 'in_progress' && dayNumber) return `Day ${dayNumber} of 14`;
  return 'Not configured';
}

export default function FoodTransitionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pets, setPets] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const petIdParam = searchParams.get('pet_id') || '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPetsManage()
      .then((data) => {
        if (cancelled) return;
        setPets(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.response?.data?.error || e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || pets.length === 0) return;
    const exists = pets.some((p) => String(p.id) === String(petIdParam));
    if (!petIdParam || !exists) {
      setSearchParams({ pet_id: String(pets[0].id) }, { replace: true });
    }
  }, [loading, pets, petIdParam, setSearchParams]);

  const pet = useMemo(
    () => pets.find((p) => String(p.id) === String(petIdParam)) || null,
    [pets, petIdParam]
  );

  const schedule = useMemo(() => {
    if (!pet?.adult_food_transition_start || pet.daily_food_cups == null) return [];
    return buildTransitionSchedule(pet.adult_food_transition_start, pet.daily_food_cups);
  }, [pet]);

  const status = pet?.adult_food_transition_start
    ? getTransitionStatus(pet.adult_food_transition_start)
    : 'not_configured';
  const dayNumber = pet?.adult_food_transition_start
    ? getTransitionDayNumber(pet.adult_food_transition_start)
    : null;

  const endDate = schedule.length ? schedule[schedule.length - 1].date : null;
  const age = pet ? ageLabel(pet.birthdate) : '';

  return (
    <div className="page">
      <h1>Food transition</h1>
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="card stack small-gap">
        <label>
          Pet
          <select
            value={petIdParam}
            onChange={(e) => setSearchParams({ pet_id: e.target.value })}
            disabled={loading || pets.length === 0}
          >
            {pets.length === 0 ? <option value="">No pets</option> : null}
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {pet && schedule.length === 0 ? (
        <section className="card stack small-gap">
          <p className="muted">
            Set the adult food transition start date and daily food cups for {pet.name} on the Pets
            page to see the 14-day schedule.
          </p>
          <Link to="/pets" className="inline-link">
            Configure on Pets page →
          </Link>
        </section>
      ) : null}

      {pet && schedule.length > 0 ? (
        <>
          <section className="card stack small-gap">
            <div className="row gap wrap row-between">
              <div className="row gap wrap">
                <strong>{pet.name}</strong>
                {age ? <span className="age-pill">{age}</span> : null}
                <span className={`status-badge status-${status}`}>{statusLabel(status, dayNumber)}</span>
              </div>
            </div>
            <p className="muted small">
              {formatCups(Number(pet.daily_food_cups))} cups/day · {formatDisplayDate(pet.adult_food_transition_start)}{' '}
              → {formatDisplayDate(endDate)}
            </p>
          </section>

          <section className="card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Date</th>
                    <th>Puppy %</th>
                    <th>Adult %</th>
                    <th>Puppy cups</th>
                    <th>Adult cups</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row) => (
                    <tr
                      key={row.day}
                      className={dayNumber === row.day ? 'row-today' : undefined}
                    >
                      <td>{row.day}</td>
                      <td>{formatDisplayDate(row.date)}</td>
                      <td>{row.oldPct}%</td>
                      <td>{row.newPct}%</td>
                      <td>{formatCups(row.puppyCups)}</td>
                      <td>{formatCups(row.adultCups)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
