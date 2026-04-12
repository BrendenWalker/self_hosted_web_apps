import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth({ children }) {
  const { me, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="center muted">Loading…</div>;
  }

  if (!me?.authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
