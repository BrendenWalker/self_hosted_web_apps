import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useBlocker, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOfflineQueue } from '../context/OfflineQueueContext';
import VersionFooter from './VersionFooter';

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const { pendingCount, online, syncing, syncMessage, syncPending } = useOfflineQueue();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const shouldBlockNavigation = useCallback(
    ({ nextLocation }) => {
      if (online) return false;
      const path = nextLocation.pathname;
      if (path === '/login' || path === '/signup') return false;
      return true;
    },
    [online]
  );

  const blocker = useBlocker(shouldBlockNavigation);

  useEffect(() => {
    if (online && blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [online, blocker]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" onClick={() => setOpen(false)}>
            PetHub
          </Link>
          <button
            type="button"
            className="nav-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="offline-status" aria-live="polite">
            {!online ? <span className="offline-badge">Offline</span> : null}
            {pendingCount > 0 ? (
              <>
                <span className={`pending-badge ${pendingCount > 0 ? 'has-pending' : ''}`}>
                  {pendingCount} activit{pendingCount === 1 ? 'y' : 'ies'} waiting to sync
                </span>
                <button
                  type="button"
                  className="sync-pending-btn"
                  disabled={syncing || !online}
                  onClick={() => syncPending()}
                  title={!online ? 'Connect to the internet to sync' : 'Send queued activities to the server'}
                >
                  {syncing ? 'Syncing…' : 'Sync now'}
                </button>
              </>
            ) : null}
            {syncMessage ? <span className="sync-message">{syncMessage}</span> : null}
          </div>
          <nav className={`nav ${open ? 'nav-open' : ''}`}>
            <NavLink to="/" end className="nav-link" onClick={() => setOpen(false)}>
              Home
            </NavLink>
            <NavLink to="/reports/activity" className="nav-link" onClick={() => setOpen(false)}>
              Reports
            </NavLink>
            <NavLink to="/pets" className="nav-link" onClick={() => setOpen(false)}>
              Pets
            </NavLink>
            {isAdmin ? (
              <NavLink to="/admin" className="nav-link" onClick={() => setOpen(false)}>
                Admin
              </NavLink>
            ) : null}
            <span className="nav-user">{user?.email}</span>
            <button type="button" className="link-btn" onClick={handleLogout}>
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <VersionFooter />
    </div>
  );
}
