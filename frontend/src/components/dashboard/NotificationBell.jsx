import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDashboard } from '../../context/DashboardContext';
import { IconBell, IconChevronDown } from '../icons';

/**
 * The ONLY notification surface in the top bar. It reads the exact same
 * DashboardContext state as the dashboard Notifications page — so badge and
 * list can never disagree with it (audit fix #4).
 */
export function NotificationBell() {
  const { notifications, summary, markRead, markAllRead } = useDashboard();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  const unread = summary.unread_notifications;

  useEffect(() => {
    if (!open) return undefined;
    const onClickAway = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-50"
      >
        <IconBell size={19} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-canvas bg-blush-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[1000] w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-bold text-ink-900">Notifications</span>
            <button
              onClick={markAllRead}
              disabled={!unread}
              className="text-xs font-semibold text-brand-800 transition-colors hover:text-brand-900 disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>

          <div className="scroll-slim max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-ink-400">You're all caught up.</p>
            )}
            {notifications.slice(0, 6).map((n) => (
              <div
                key={n.id}
                className={`border-b border-line px-4 py-3 last:border-b-0 ${n.is_read ? 'bg-surface' : 'bg-brand-50/70'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-500">{n.message}</p>
                    <p className="mt-1 text-[11px] text-ink-300">{n.created_at}</p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markRead(n.id)}
                      title="Mark as read"
                      className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blush-600 transition-transform hover:scale-125"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <Link
            to="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block bg-canvas px-4 py-3 text-center text-sm font-bold text-brand-800 transition-colors hover:bg-brand-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
