import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getDashboard, markAllNotificationsRead, markNotificationRead } from '../api/endpoints';
import { useAuth } from './AuthContext';

/**
 * Single source of truth for the logged-in customer's data, sourced from the
 * untouched `my_dashboard.php` aggregate endpoint. Both the top-bar bell and
 * the dashboard Notifications page consume THIS state — which is what
 * guarantees the two can never drift apart (audit fix #4).
 *
 * Mutating actions (mark read) optimistically update local state, then
 * re-sync from the server in the background.
 */
const POLL_MS = 30_000;

const EMPTY = {
  customer: null,
  summary: { pending_count: 0, confirmed_count: 0, completed_count: 0, cancelled_count: 0, unread_notifications: 0 },
  appointments: [],
  notifications: [],
  reviews: [],
};

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const payload = await getDashboard();
      if (payload.success) {
        setData({
          customer: payload.customer,
          summary: payload.summary,
          appointments: payload.appointments || [],
          notifications: payload.notifications || [],
          reviews: payload.reviews || [],
        });
        setError(null);
      }
    } catch (e) {
      if (e.status !== 401) setError(e.message || 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setData(EMPTY);
      setLoading(false);
      setError(null);
      clearInterval(pollRef.current);
      return undefined;
    }
    setLoading(true);
    refresh();
    pollRef.current = setInterval(refresh, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [isAuthenticated, refresh]);

  const markRead = useCallback(async (notificationId) => {
    setData((d) => ({
      ...d,
      notifications: d.notifications.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
      summary: { ...d.summary, unread_notifications: Math.max(0, d.summary.unread_notifications - 1) },
    }));
    try {
      await markNotificationRead(notificationId);
    } finally {
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setData((d) => ({
      ...d,
      notifications: d.notifications.map((n) => ({ ...n, is_read: true })),
      summary: { ...d.summary, unread_notifications: 0 },
    }));
    try {
      await markAllNotificationsRead();
    } finally {
      refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ ...data, loading, error, refresh, markRead, markAllRead }),
    [data, loading, error, refresh, markRead, markAllRead]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside <DashboardProvider>');
  return ctx;
}
