import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMe, login as apiLogin, logout as apiLogout, signup as apiSignup } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMe();
      setMe(data);
    } catch {
      setMe({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email, password) => {
      const data = await apiLogin(email, password);
      await refresh();
      return data;
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setMe({ authenticated: false });
  }, []);

  const signup = useCallback(async (email, password) => {
    return apiSignup(email, password);
  }, []);

  const value = useMemo(
    () => ({
      me,
      loading,
      refresh,
      login,
      logout,
      signup,
      user: me?.authenticated ? me.user : null,
      isAdmin: Boolean(me?.user?.is_admin),
    }),
    [me, loading, refresh, login, logout, signup]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
