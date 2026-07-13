import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addPetMember,
  createPet,
  deletePet,
  fetchPetsManage,
  invitePetMember,
  removePetMember,
  revokeInvite,
  updatePetBirthdate,
  updatePetFoodTransition,
} from '../api/client';

export default function PetsManagePage() {
  const [pets, setPets] = useState([]);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const data = await fetchPetsManage();
    setPets(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load().catch((e) => setError(e.response?.data?.error || e.message));
  }, []);

  const onCreatePet = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await createPet(newName.trim());
      setNewName('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1>Manage pets</h1>
      {error ? <div className="error-banner">{error}</div> : null}
      <section className="card">
        <h2>Add pet</h2>
        <form className="row gap" onSubmit={onCreatePet}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            maxLength={50}
          />
          <button type="submit" className="primary" disabled={busy}>
            Add
          </button>
        </form>
      </section>
      {pets.map((p) => (
        <PetCard key={p.id} pet={p} onReload={load} onError={setError} />
      ))}
    </div>
  );
}

function PetCard({ pet, onReload, onError }) {
  const [email, setEmail] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [birth, setBirth] = useState(pet.birthdate || '');
  const [transitionStart, setTransitionStart] = useState(pet.adult_food_transition_start || '');
  const [dailyCups, setDailyCups] = useState(
    pet.daily_food_cups != null ? String(pet.daily_food_cups) : ''
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBirth(pet.birthdate || '');
    setTransitionStart(pet.adult_food_transition_start || '');
    setDailyCups(pet.daily_food_cups != null ? String(pet.daily_food_cups) : '');
  }, [pet.birthdate, pet.adult_food_transition_start, pet.daily_food_cups]);

  const addMember = async (e) => {
    e.preventDefault();
    setBusy(true);
    onError('');
    try {
      await addPetMember(pet.id, email.trim());
      setEmail('');
      await onReload();
    } catch (err) {
      onError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    setBusy(true);
    onError('');
    try {
      await invitePetMember(pet.id, inviteEmail.trim());
      setInviteEmail('');
      await onReload();
    } catch (err) {
      onError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveBirth = async () => {
    setBusy(true);
    onError('');
    try {
      await updatePetBirthdate(pet.id, birth);
      await onReload();
    } catch (err) {
      onError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveFoodSettings = async () => {
    setBusy(true);
    onError('');
    try {
      const cupsValue = dailyCups.trim() === '' ? null : Number(dailyCups);
      if (cupsValue != null && (!Number.isFinite(cupsValue) || cupsValue <= 0)) {
        onError('Daily food cups must be a number greater than 0');
        return;
      }
      await updatePetFoodTransition(pet.id, {
        adult_food_transition_start: transitionStart || null,
        daily_food_cups: cupsValue,
      });
      await onReload();
    } catch (err) {
      onError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const hasSchedule =
    Boolean(pet.adult_food_transition_start) && pet.daily_food_cups != null && pet.daily_food_cups > 0;

  return (
    <section className="card">
      <h2>{pet.name}</h2>
      <div className="stack small-gap">
        <label>
          Birthdate
          <div className="row gap">
            <input type="date" value={birth || ''} onChange={(e) => setBirth(e.target.value)} />
            <button type="button" className="secondary" disabled={busy} onClick={saveBirth}>
              Save birthdate
            </button>
          </div>
        </label>
        <h3>Food transition</h3>
        <label>
          Adult food transition start
          <input
            type="date"
            value={transitionStart || ''}
            onChange={(e) => setTransitionStart(e.target.value)}
          />
        </label>
        <label>
          Daily food intake (cups)
          <input
            type="number"
            min="0"
            step="0.25"
            value={dailyCups}
            onChange={(e) => setDailyCups(e.target.value)}
            placeholder="e.g. 1.5"
          />
        </label>
        <div className="row gap">
          <button type="button" className="secondary" disabled={busy} onClick={saveFoodSettings}>
            Save food settings
          </button>
          {hasSchedule ? (
            <Link className="inline-link" to={`/food-transition?pet_id=${pet.id}`}>
              View transition schedule →
            </Link>
          ) : null}
        </div>
        <h3>Members</h3>
        <ul className="plain-list">
          {pet.members?.map((m) => (
            <li key={m.user_id} className="row-between">
              <span>
                {m.email} {m.is_manager ? '(manager)' : ''}
              </span>
              {!m.is_manager ? (
                <button
                  type="button"
                  className="link-btn danger"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm(`Remove ${m.email}?`)) return;
                    setBusy(true);
                    try {
                      await removePetMember(pet.id, m.user_id);
                      await onReload();
                    } catch (err) {
                      onError(err.response?.data?.error || err.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <form className="row gap" onSubmit={addMember}>
          <input
            type="email"
            placeholder="Add existing user by email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="secondary" disabled={busy}>
            Add member
          </button>
        </form>
        <h3>Pending invites</h3>
        <ul className="plain-list">
          {pet.invites?.map((inv) => (
            <li key={inv.id} className="row-between">
              <span>
                {inv.invite_email} {inv.expires_at ? `(expires ${inv.expires_at})` : ''}
              </span>
              <button
                type="button"
                className="link-btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await revokeInvite(pet.id, inv.id);
                    await onReload();
                  } catch (err) {
                    onError(err.response?.data?.error || err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
        <form className="row gap" onSubmit={sendInvite}>
          <input
            type="email"
            placeholder="Invite by email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button type="submit" className="secondary" disabled={busy}>
            Send invite
          </button>
        </form>
        <button
          type="button"
          className="danger-btn"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(`Delete pet ${pet.name}? This cannot be undone.`)) return;
            setBusy(true);
            try {
              await deletePet(pet.id);
              await onReload();
            } catch (err) {
              onError(err.response?.data?.error || err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete pet
        </button>
      </div>
    </section>
  );
}
