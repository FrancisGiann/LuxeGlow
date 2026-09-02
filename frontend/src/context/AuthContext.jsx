import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../api/endpoints';
import { authRedirect, supabase } from '../lib/supabase';
import { passwordSetupError } from '../utils/authRedirect';

/**
 * Owns the Supabase Auth session and the auth modal (login / staff login /
 * register / email verification / password reset). Authorization is enforced again by
 * profiles RLS and server-side RPCs; UI state is never trusted for access.
 */
const AuthContext = createContext(null);
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const MIN_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const ACTIVITY_BROADCAST_INTERVAL_MS = 15 * 1000;
const AUTH_EVENT_STORAGE_KEY = 'luxeglow-auth-event';

function configuredIdleTimeout() {
  const configuredMinutes = Number(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MINUTES);
  if (!Number.isFinite(configuredMinutes)) return DEFAULT_IDLE_TIMEOUT_MS;
  return Math.min(MAX_IDLE_TIMEOUT_MS, Math.max(MIN_IDLE_TIMEOUT_MS, configuredMinutes * 60 * 1000));
}

function isStaffRole(role) {
  return role === 'staff' || role === 'admin';
}

function createAuthSourceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function initialPasswordSetup() {
  if (!authRedirect.isPasswordSetup && !authRedirect.isResetPath) return null;
  return {
    // A bare /reset-password visit is allowed to show the form, but it is not
    // trusted as proof that a recovery callback was completed.
    type: authRedirect.isPasswordSetup ? authRedirect.type : '',
    userId: null,
    email: '',
    ready: false,
    callbackObserved: false,
    error: authRedirect.hasError ? passwordSetupError() : '',
  };
}

export function AuthProvider({ children }) {
  const initialSetup = initialPasswordSetup();
  const [status, setStatus] = useState('loading'); // loading | authenticated | guest
  const [customer, setCustomer] = useState(null);
  const [modalView, setModalView] = useState(initialSetup ? 'forgot-reset' : null); // null | login | admin | register | verify | forgot-reset | password-success
  const [verifyEmail, setVerifyEmail] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const [passwordSetup, setPasswordSetup] = useState(initialSetup);
  const [passwordCompletion, setPasswordCompletion] = useState(null); // null | { type: invite | recovery }
  const idleTimerRef = useRef(null);
  const lastActivityRef = useRef(0);
  const lastActivityBroadcastRef = useRef(0);
  const activityResetRef = useRef(() => {});
  const channelRef = useRef(null);
  const sourceRef = useRef(null);
  const authCallbackHandledRef = useRef(false);
  const passwordRecoveryObservedRef = useRef(false);

  useEffect(() => {
    sourceRef.current = createAuthSourceId();
  }, []);

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
    const acceptPasswordSetup = (callbackType, session) => {
      if (!['invite', 'recovery'].includes(callbackType) || !session?.user?.id || authCallbackHandledRef.current) return false;
      authCallbackHandledRef.current = true;
      setPasswordSetup({ type: callbackType, userId: session.user.id, email: session.user.email || '', ready: true, callbackObserved: true, error: authRedirect.hasError ? passwordSetupError() : '' });
      setModalView('forgot-reset');
      return true;
    };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') passwordRecoveryObservedRef.current = true;
      const hasCallbackLocation = authRedirect.isResetPath && authRedirect.hasCallbackCredentials;
      if (event === 'INITIAL_SESSION') {
        if (!hasCallbackLocation || !session?.user?.id || authCallbackHandledRef.current) {
          setTimeout(refreshSession, 0);
          return;
        }
        // INITIAL_SESSION can be the only event observed when the client
        // consumed the URL before this subscription was registered. Give a
        // queued PASSWORD_RECOVERY event precedence over the PKCE/no-type
        // invite fallback before accepting the session once.
        setTimeout(() => {
          if (!authRedirect.type && passwordRecoveryObservedRef.current) {
            setTimeout(refreshSession, 0);
            return;
          }
          const initialType = authRedirect.type || 'invite';
          if (!acceptPasswordSetup(initialType, session)) setTimeout(refreshSession, 0);
        }, 0);
        return;
      }
      const callbackType = event === 'PASSWORD_RECOVERY' && hasCallbackLocation
        ? 'recovery'
        : event === 'SIGNED_IN' && hasCallbackLocation && authRedirect.isPasswordSetup
          ? authRedirect.type
          : '';
      if (acceptPasswordSetup(callbackType, session)) return;
      if (event === 'SIGNED_OUT') setPasswordSetup(null);
      // Defer the profile query until the auth callback has returned; this
      // avoids re-entering the Supabase client from inside its event loop.
      setTimeout(refreshSession, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refreshSession]);

  const openAuth = useCallback((view = 'login') => {
    if (view !== 'forgot-reset') {
      setPasswordSetup(null);
      setPasswordCompletion(null);
    }
    setModalView(view);
  }, []);
  const closeAuth = useCallback(() => {
    setModalView(null);
    setVerifyEmail('');
    setSessionNotice('');
    setPasswordCompletion(null);
  }, []);

  const broadcast = useCallback((payload) => {
    const message = { ...payload, source: sourceRef.current, at: Date.now() };
    channelRef.current?.postMessage(message);
    try {
      window.localStorage.setItem(AUTH_EVENT_STORAGE_KEY, JSON.stringify(message));
    } catch {
      // Storage may be blocked; BroadcastChannel still covers modern tabs.
    }
  }, []);

  const applySignedOut = useCallback(({ expired = false, role = null } = {}) => {
    clearTimeout(idleTimerRef.current);
    setCustomer(null);
    setStatus('guest');
    if (expired) {
      setSessionNotice('Your session expired after a period of inactivity. Please sign in again.');
      setModalView(isStaffRole(role) ? 'admin' : 'login');
    } else {
      setSessionNotice('');
      setModalView(null);
    }
  }, []);

  useEffect(() => {
    const onMessage = (message) => {
      const payload = message?.data || message;
      if (!payload || payload.source === sourceRef.current) return;
      if (payload.type === 'activity' && Number.isFinite(Number(payload.at))) {
        lastActivityRef.current = Math.max(lastActivityRef.current, Number(payload.at));
        activityResetRef.current();
      }
      if (payload.type === 'signed_out') applySignedOut({ expired: payload.reason === 'expired', role: payload.role });
    };
    if (typeof BroadcastChannel !== 'undefined') {
      channelRef.current = new BroadcastChannel('luxeglow-auth');
      channelRef.current.addEventListener('message', onMessage);
    }
    const onStorage = (event) => {
      if (event.key !== AUTH_EVENT_STORAGE_KEY || !event.newValue) return;
      try { onMessage(JSON.parse(event.newValue)); } catch { /* Ignore malformed storage events. */ }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      channelRef.current?.removeEventListener('message', onMessage);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [applySignedOut]);

  const performSignOut = useCallback(async ({ expired = false } = {}) => {
    const role = customer?.role;
    broadcast({ type: 'signed_out', reason: expired ? 'expired' : 'manual', role });
    try {
      await api.logoutCustomer();
    } finally {
      applySignedOut({ expired, role });
    }
  }, [customer?.role, broadcast, applySignedOut]);

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
      closeAuth();
      return { ok: true, redirect: data.redirect || null };
    }
    return { ok: false, error: data.error || 'Invalid staff credentials.' };
  }, [refreshSession, closeAuth]);

  /** Returns { ok, error }. On success the session enters "pending email verification". */
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

  const resend = useCallback(async () => {
    const data = await api.resendVerificationEmail(verifyEmail);
    const retryAfter = Number(data.retry_after ?? data.remaining ?? 0);
    return {
      ok: !!data.success,
      error: data.error,
      retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 0,
    };
  }, [verifyEmail]);

  const requestPasswordReset = useCallback(async (email) => {
    const data = await api.requestPasswordReset(email);
    if (data.success) {
      setPasswordSetup({
        type: 'recovery',
        userId: null,
        email: String(email || '').trim().toLowerCase(),
        ready: false,
        callbackObserved: false,
        error: '',
      });
    }
    return { ok: !!data.success, error: data.error, message: data.message };
  }, []);

  const completePasswordReset = useCallback(async (fields) => {
    // Capture the verified callback type before the API globally signs out and
    // the auth event clears passwordSetup. Completion copy must reflect the
    // flow that actually succeeded, not whichever login is opened next.
    const flowType = passwordSetup?.type || '';
    const data = await api.completePasswordReset({
      ...(fields && typeof fields === 'object' ? fields : {}),
      expectedUserId: passwordSetup?.userId || '',
      flowType,
    });
    if (data.success && ['invite', 'recovery'].includes(flowType)) {
      setPasswordSetup(null);
      setPasswordCompletion({ type: flowType });
      setModalView('password-success');
    }
    return { ok: !!data.success, error: data.error, message: data.message };
  }, [passwordSetup]);

  const logout = useCallback(() => performSignOut(), [performSignOut]);

  useEffect(() => {
    if (status !== 'authenticated' || !customer?.role) {
      clearTimeout(idleTimerRef.current);
      return undefined;
    }
    lastActivityRef.current = Date.now();
    const timeoutMs = configuredIdleTimeout();
    const schedule = () => {
      clearTimeout(idleTimerRef.current);
      const remaining = timeoutMs - (Date.now() - lastActivityRef.current);
      if (remaining <= 0) {
        performSignOut({ expired: true });
        return;
      }
      idleTimerRef.current = setTimeout(schedule, Math.min(remaining, 60 * 1000));
    };
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      if (lastActivityRef.current - lastActivityBroadcastRef.current >= ACTIVITY_BROADCAST_INTERVAL_MS) {
        lastActivityBroadcastRef.current = lastActivityRef.current;
        broadcast({ type: 'activity' });
      }
      schedule();
    };
    activityResetRef.current = schedule;
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    schedule();
    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      clearTimeout(idleTimerRef.current);
      activityResetRef.current = () => {};
    };
  }, [status, customer?.role, broadcast, performSignOut]);

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
      resend,
      requestPasswordReset,
      completePasswordReset,
      passwordSetup,
      passwordCompletion,
      logout,
      refreshSession,
      sessionNotice,
    }),
    [status, customer, modalView, verifyEmail, openAuth, closeAuth, login, loginStaff, register, resend, requestPasswordReset, completePasswordReset, passwordSetup, passwordCompletion, logout, refreshSession, sessionNotice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
