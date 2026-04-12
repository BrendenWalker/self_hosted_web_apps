import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { me, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (me?.authenticated) {
    const to = location.state?.from?.pathname || '/';
    return <Navigate to={to} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login(email, password);
      if (!data.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>PetHub</h1>
        <p className="muted">Sign in to track activities.</p>
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
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="primary">
            Sign in
          </button>
        </form>
        <p className="muted small">
          No account? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}
