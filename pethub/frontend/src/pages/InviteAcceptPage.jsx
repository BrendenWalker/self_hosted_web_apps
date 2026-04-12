import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { acceptInvite, fetchInvitePreview } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function InviteAcceptPage() {
  const { token } = useParams();
  const { me, loading } = useAuth();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!me?.authenticated || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchInvitePreview(token);
        if (!cancelled) setPreview(data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Could not load invite');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me, token]);

  const onAccept = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await acceptInvite(token);
      if (!data.ok) {
        setError(data.error || 'Could not accept');
        return;
      }
      setAccepted(true);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not accept');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="center muted">Loading…</div>;
  }

  if (!me?.authenticated) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Pet invitation</h1>
          <p className="muted">Please sign in as the invited email address, then open this link again.</p>
          <Link to="/login" state={{ from: { pathname: `/invite/pet/${token}` } }} className="primary inline-link">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Welcome</h1>
          <p>You now have access to the pet.</p>
          <Link to="/">Go home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <h1>Pet invitation</h1>
        {error ? <div className="error-banner">{error}</div> : null}
        {preview && !preview.ok ? <p className="muted">{preview.error || 'Invalid invite'}</p> : null}
        {preview?.ok ? (
          <div className="stack">
            <p>
              Pet: <strong>{preview.pet_name || '—'}</strong>
            </p>
            <p className="muted">Invited email: {preview.invite_email}</p>
            {preview.accepted ? <p>This invite was already used.</p> : null}
            {preview.expired ? <p className="error-banner">This invitation has expired.</p> : null}
            {!preview.accepted && !preview.expired ? (
              <button type="button" className="primary" disabled={busy} onClick={onAccept}>
                {busy ? 'Saving…' : 'Accept invitation'}
              </button>
            ) : null}
          </div>
        ) : (
          !error && <p className="muted">Loading invite…</p>
        )}
        <Link to="/">Cancel</Link>
      </div>
    </div>
  );
}
