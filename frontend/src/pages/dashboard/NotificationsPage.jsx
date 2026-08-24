import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../../context/DashboardContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState, SkeletonRows } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';

export function NotificationsPage() {
  const { notifications, summary, loading, markRead, markAllRead } = useDashboard();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const list = unreadOnly ? notifications.filter((n) => !n.is_read) : notifications;
  const unread = summary.unread_notifications;

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader
          title="Notifications Center"
          subtitle={unread ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'You are all caught up.'}
          action={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setUnreadOnly((v) => !v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  unreadOnly ? 'bg-brand-800 text-white' : 'border border-line text-ink-500 hover:bg-canvas'
                }`}
              >
                Unread only
              </button>
              <Button variant="soft" size="sm" onClick={markAllRead} disabled={!unread}>
                ✓ Mark all read
              </Button>
            </div>
          }
        />

        <div className="pt-2">
          {loading && <SkeletonRows rows={5} className="py-5" />}

          {!loading && list.length === 0 && (
            <EmptyState
              icon="🔕"
              title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
              description={
                unreadOnly
                  ? 'Switch back to see your full feed.'
                  : 'Booking confirmations, reminders and salon updates will land here.'
              }
            />
          )}

          {!loading && list.length > 0 && (
            <ul className="divide-y divide-line">
              {list.map((n) => (
                <li key={n.id} className={`flex items-start gap-4 px-1 py-4 ${n.is_read ? '' : 'rounded-xl bg-brand-50/70 px-4 my-1'}`}>
                  <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.is_read ? 'bg-line-strong' : 'bg-blush-600'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink-900">{n.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{n.message}</p>
                    <p className="mt-1 text-xs text-ink-300">{n.created_at}</p>
                  </div>
                  {!n.is_read && (
                    <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                      Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line pt-4 text-xs text-ink-400">
          This feed shares state with the top-bar bell — read one place, synced everywhere.{' '}
          <Link to="/dashboard/overview" className="font-semibold text-brand-800 hover:text-brand-900">Back to overview</Link>
        </div>
      </Card>
    </div>
  );
}
