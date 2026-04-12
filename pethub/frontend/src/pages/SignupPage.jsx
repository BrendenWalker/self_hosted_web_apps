import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const { me, signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (me?.authenticated) {
    return <Navigate to="/" replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await signup(email, password);
      if (!data.ok) {
        setError(data.error || 'Could not sign up');
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not sign up');
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Account created</h1>
          <p className="muted">You can sign in now.</p>
          <Link to="/login" className="primary inline-link">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create account</h1>
        <form onSubmit={submit} className="stack">
          {error ? <div className="error-banner">{error}</div> : null}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" className="primary">
            Sign up
          </button>
        </form>
        <p className="muted small">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <button type="button" className="link-btn" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    </div>
  );
}
