import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listAdminNotifications, markAdminNotificationRead, markAllAdminNotificationsRead } from '../api/admin';
import { supabase } from '../lib/supabase';
import { mergeStaffNotifications } from '../utils/staffNotifications';

const STAFF_ROLES = new Set(['staff', 'admin']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isActiveStaff(customer, status) {
  return status === 'authenticated'
    && customer?.is_active === true
    && STAFF_ROLES.has(customer?.role)
    && UUID_PATTERN.test(String(customer?.id || ''));
}

export function useStaffNotifications() {
  const { status, customer } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState('idle');
  const generationRef = useRef(0);
  const notificationsRef = useRef(notifications);
  const canUseNotifications = isActiveStaff(customer, status);
  const userId = canUseNotifications ? customer.id : '';

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const refresh = useCallback(async (generation = generationRef.current) => {
    if (!canUseNotifications) return [];
    setLoading(true);
    try {
      const rows = await listAdminNotifications();
      if (generation !== generationRef.current) return [];
      // Merge instead of replacing: a row can arrive between subscribing and
      // the initial SELECT, and the realtime callback must not be lost.
      setNotifications((current) => mergeStaffNotifications(current, rows));
      setError('');
      return rows;
    } catch (loadError) {
      if (generation === generationRef.current) setError(loadError?.message || 'Could not load staff notifications.');
      return [];
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [canUseNotifications]);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setNotifications([]);
    setError('');
    setRealtimeStatus(canUseNotifications ? 'connecting' : 'idle');
    if (!canUseNotifications) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    if (!supabase) {
      setLoading(false);
      setRealtimeStatus('error');
      setError('Live staff notifications are not configured.');
      return undefined;
    }

    let disposed = false;
    const channel = supabase
      .channel(`staff-notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'staff_notifications', filter: `recipient_id=eq.${userId}` },
        (payload) => {
          if (disposed || String(payload?.new?.recipient_id || '') !== userId) return;
          setNotifications((current) => mergeStaffNotifications(current, [payload.new]));
        }
      );

    const handleStatus = (nextStatus) => {
      if (disposed) return;
      setRealtimeStatus(String(nextStatus || '').toLowerCase());
      // SUBSCRIBED is deliberately the first load boundary. Reconnects and
      // channel errors also refresh so the feed heals after dropped events.
      if (nextStatus === 'SUBSCRIBED' || nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') {
        refresh(generation);
      }
    };

    try {
      channel.subscribe(handleStatus);
    } catch (subscribeError) {
      setRealtimeStatus('error');
      setError(subscribeError?.message || 'Could not connect to live staff notifications.');
      refresh(generation);
    }

    return () => {
      disposed = true;
      generationRef.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [canUseNotifications, refresh, userId]);

  const markRead = useCallback(async (notificationId) => {
    const id = Number(notificationId);
    if (!Number.isSafeInteger(id) || id < 1) return;
    const previous = notificationsRef.current;
    setNotifications((current) => {
      const next = current.map((notification) => notification.id === id ? { ...notification, is_read: true } : notification);
      notificationsRef.current = next;
      return next;
    });
    try {
      await markAdminNotificationRead(id);
    } catch (markError) {
      setNotifications((current) => {
        const next = current.map((notification) => {
          const original = previous.find((item) => item.id === notification.id);
          return notification.id === id && original ? { ...notification, is_read: original.is_read } : notification;
        });
        notificationsRef.current = next;
        return next;
      });
      setError(markError?.message || 'Could not mark notification as read.');
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const previous = notificationsRef.current;
    setNotifications((current) => {
      const next = current.map((notification) => ({ ...notification, is_read: true }));
      notificationsRef.current = next;
      return next;
    });
    try {
      await markAllAdminNotificationsRead();
    } catch (markError) {
      setNotifications((current) => {
        const originalById = new Map(previous.map((notification) => [notification.id, notification]));
        const next = current.map((notification) => {
          const original = originalById.get(notification.id);
          return original ? { ...notification, is_read: original.is_read } : notification;
        });
        notificationsRef.current = next;
        return next;
      });
      setError(markError?.message || 'Could not mark notifications as read.');
    }
  }, []);

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.is_read).length,
    loading,
    error,
    realtimeStatus,
    refresh: () => refresh(generationRef.current),
    markRead,
    markAllRead,
  };
}
