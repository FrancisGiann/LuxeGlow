import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../api/endpoints';
import { supabase } from '../lib/supabase';

/**
 * Owns the Supabase Auth session and the auth modal (login / staff login /
 * register / OTP verify / password reset). Authorization is enforced again by
 * profiles RLS and server-side RPCs; UI state is never trusted for access.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | authenticated | guest
  const [customer, setCustomer] = useState(null);
  const [modalView, setModalView] = useState(null); // null | login | admin | register | verify
  const [verifyEmail, setVerifyEmail] = useState('');

  const refreshSession = useCallback(async () => {
    try {
      const data = await api.checkSession();
      if (data.loggedIn) {
        setCustomer(data.customer);
        setStatus('authenticated');
      } else {
        setCustomer(null);
        setStatus('guest');
      }
    } catch {
      setCustomer(null);
      setStatus('guest');
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setModalView('forgot-reset');
        return;
      }
      // Defer the profile query until the auth callback has returned; this
      // avoids re-entering the Supabase client from inside its event loop.
      setTimeout(refreshSession, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refreshSession]);

  const openAuth = useCallback((view = 'login') => setModalView(view), []);
  const closeAuth = useCallback(() => {
    setModalView(null);
    setVerifyEmail('');
  }, []);

  /** Returns { ok, needsVerification } without throwing on bad credentials. */
  const login = useCallback(async (email, password) => {
    const data = await api.loginCustomer(email, password);
    if (data.needs_verification) {
      setVerifyEmail(email);
      setModalView('verify');
      return { ok: false, needsVerification: true };
    }
    if (data.success) {
      await refreshSession();
      closeAuth();
      return { ok: true };
    }
    return { ok: false, error: data.error || 'Invalid email or password.' };
  }, [refreshSession, closeAuth]);

  const loginStaff = useCallback(async (username, password) => {
    const data = await api.loginStaff(username, password);
    if (data.success) {
      await refreshSession();
      return { ok: true, redirect: data.redirect || null };
    }
    return { ok: false, error: data.error || 'Invalid staff credentials.' };
  }, [refreshSession]);

  /** Returns { ok, error }. On success the session enters "pending verify". */
  const register = useCallback(async (fields) => {
    const data = await api.registerCustomer(fields);
    if (data.success) {
      if (data.needs_verification) {
        setVerifyEmail(fields.email);
        setModalView('verify');
      } else {
        await refreshSession();
        closeAuth();
      }
      return { ok: true };
    }
    return { ok: false, error: data.error || 'Registration failed.' };
  }, [refreshSession, closeAuth]);

  const verify = useCallback(async (otp) => {
    const data = await api.verifyOtp(otp, verifyEmail);
    if (!data.success) return { ok: false, error: data.error || 'Invalid code.' };
    await refreshSession();
    closeAuth();
    return { ok: true };
  }, [verifyEmail, refreshSession, closeAuth]);

  const resend = useCallback(async () => {
    const data = await api.resendOtp(verifyEmail);
    const retryAfter = Number(data.retry_after ?? data.remaining ?? 0);
    return {
      ok: !!data.success,
      error: data.error,
      retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 0,
    };
  }, [verifyEmail]);

  const requestPasswordReset = useCallback(async (email) => {
    const data = await api.requestPasswordReset(email);
    return { ok: !!data.success, error: data.error, message: data.message };
  }, []);

  const completePasswordReset = useCallback(async (fields) => {
    const data = await api.completePasswordReset(fields);
    return { ok: !!data.success, error: data.error, message: data.message };
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logoutCustomer();
    } finally {
      setCustomer(null);
      setStatus('guest');
    }
  }, []);

  const value = useMemo(
    () => ({
      status,
      customer,
      isAuthenticated: status === 'authenticated',
      modalView,
      verifyEmail,
      openAuth,
      closeAuth,
      login,
      loginStaff,
      register,
      verify,
      resend,
      requestPasswordReset,
      completePasswordReset,
      logout,
      refreshSession,
    }),
    [status, customer, modalView, verifyEmail, openAuth, closeAuth, login, loginStaff, register, verify, resend, requestPasswordReset, completePasswordReset, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
