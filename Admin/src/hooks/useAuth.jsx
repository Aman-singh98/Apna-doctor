// ─── hooks/useAuth.jsx ────────────────────────────────────────────────────────
// Manages admin authentication state globally via React Context.
// Token is stored in sessionStorage so it clears when the tab closes.

import { createContext, useContext, useState, useCallback } from 'react';
import { apiLogin, apiGetMe } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Restore admin profile from sessionStorage (survives page reload)
  const [admin, setAdmin] = useState(() => {
    const saved = sessionStorage.getItem('apna_admin');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError('');
    try {
      // Calls POST /api/auth/admin/login
      const data = await apiLogin(email, password);

      // Persist JWT + admin profile for the session
      sessionStorage.setItem('apna_token', data.token);
      sessionStorage.setItem('apna_admin', JSON.stringify(data.admin));

      setAdmin(data.admin);
      return { success: true };
    } catch (err) {
      // err.message is the server's { message } string (set in api.js)
      setError(err.message || 'Login failed. Please try again.');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    sessionStorage.removeItem('apna_token');
    sessionStorage.removeItem('apna_admin');
    setAdmin(null);
  }, []);

  // ── Refresh admin profile from server (optional, call after profile update) ─
  const refreshAdmin = useCallback(async () => {
    try {
      const data = await apiGetMe();
      sessionStorage.setItem('apna_admin', JSON.stringify(data.admin));
      setAdmin(data.admin);
    } catch {
      // If the token is invalid / expired, force logout
      logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{ admin, loading, error, login, logout, refreshAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Custom hook ───────────────────────────────────────────────────────────────
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
