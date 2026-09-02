import { useEffect, useRef, useState } from 'react';
import { IconArrowRight, IconBell } from '../icons';
import { useStaffNotifications } from '../../hooks/useStaffNotifications';

const NOTIFICATION_PANEL_ID = 'staff-notifications-panel';
const NOTIFICATION_HEADING_ID = 'staff-notifications-heading';

export function StaffNotificationBell({ onOpenAppointments, onOpenAppointment }) {
  const { notifications, unreadCount, loading, error, markRead, markAllRead } = useStaffNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClickAway = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openAppointments = () => {
    setOpen(false);
    onOpenAppointments?.();
  };

  const openNotification = (notification) => {
    if (!notification.is_read) void markRead(notification.id);
    setOpen(false);
    (onOpenAppointment || onOpenAppointments)?.(notification);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Staff notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-controls={NOTIFICATION_PANEL_ID}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
      >
        <IconBell size={19} />
        {unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-canvas bg-blush-600 px-1 text-[10px] font-bold leading-none text-white" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div id={NOTIFICATION_PANEL_ID} role="region" aria-labelledby={NOTIFICATION_HEADING_ID} className="absolute right-0 top-12 z-[1000] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 id={NOTIFICATION_HEADING_ID} className="text-sm font-bold text-ink-900">Booking requests</h2>
              <p className="mt-0.5 text-xs text-ink-500" aria-live="polite">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p>
            </div>
            <button type="button" onClick={markAllRead} disabled={!unreadCount || loading} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-brand-800 transition-colors hover:bg-brand-50 hover:text-brand-900 disabled:cursor-not-allowed disabled:opacity-40">Mark all read</button>
          </div>

          <div className="scroll-slim max-h-80 overflow-y-auto">
            {loading && <p className="px-4 py-8 text-center text-sm text-ink-500">Loading booking requests…</p>}
            {!loading && error && <div className="px-4 py-6 text-sm text-danger" role="alert"><p>{error}</p><button type="button" onClick={openAppointments} className="mt-3 min-h-11 rounded-lg px-2 font-bold text-brand-800 underline underline-offset-4">Open appointments</button></div>}
            {!loading && !error && !notifications.length && <p className="px-4 py-8 text-center text-sm text-ink-500">No new booking requests yet.</p>}
            {!loading && !error && notifications.slice(0, 6).map((notification) => (
              <div key={notification.id} className={`border-b border-line last:border-b-0 ${notification.is_read ? 'bg-surface' : 'bg-brand-50/70'}`}>
                <button type="button" onClick={() => openNotification(notification)} aria-label={`${notification.title}. Open appointment details`} className="flex min-h-20 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-800">
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? 'bg-line-strong' : 'bg-blush-600'}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">{notification.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{notification.message}</span>
                    <span className="mt-1 block text-[11px] text-ink-400">{notification.created_at}</span>
                  </span>
                </button>
              </div>
            ))}
          </div>

          {!error && <button type="button" onClick={openAppointments} className="flex min-h-12 w-full items-center justify-center gap-2 bg-canvas px-4 py-3 text-center text-sm font-bold text-brand-800 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-800"><span>Review appointments</span><IconArrowRight size={15} /></button>}
        </div>
      )}
    </div>
  );
}
