import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../../context/DashboardContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState, SkeletonRows } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { IconBell } from '../../components/icons';

export function NotificationsPage() {
  const { notifications, summary, loading, markRead, markAllRead } = useDashboard();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = unreadOnly ? notifications.filter((notification) => !notification.is_read) : notifications;
  const unread = summary.unread_notifications;
  return <div className="mx-auto max-w-[900px]"><Card className="p-5 sm:p-7"><CardHeader title="Notifications" subtitle={unread ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'You are all caught up.'} action={<div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={() => setUnreadOnly((value) => !value)} className={`min-h-10 rounded-lg px-3 text-xs font-bold ${unreadOnly ? 'bg-brand-800 text-white' : 'border border-line text-ink-600 hover:bg-canvas'}`}>Unread only</button><Button type="button" variant="soft" size="sm" onClick={markAllRead} disabled={!unread}>Mark all read</Button></div>} /><div className="pt-2">{loading && <SkeletonRows rows={5} className="py-5" />}{!loading && !list.length && <EmptyState icon={IconBell} title={unreadOnly ? 'No unread notifications' : 'No notifications yet'} description={unreadOnly ? 'Switch back to see your full feed.' : 'Booking confirmations and salon updates will appear here.'} />}{!loading && list.length > 0 && <ul className="divide-y divide-line">{list.map((notification) => <li key={notification.id} className={`flex items-start gap-3 py-5 ${notification.is_read ? '' : 'bg-blush-50/60 px-3'}`}><span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? 'bg-line-strong' : 'bg-blush-600'}`} /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-ink-900">{notification.title}</p><p className="mt-1 text-sm leading-relaxed text-ink-600">{notification.message}</p><p className="mt-1 text-xs text-ink-400">{notification.created_at}</p></div>{!notification.is_read && <Button type="button" variant="ghost" size="sm" onClick={() => markRead(notification.id)}>Mark read</Button>}</li>)}</ul>}</div><div className="mt-5 border-t border-line pt-4 text-xs text-ink-500">Read status is shared with the notification control in your workspace header. <Link to="/dashboard/overview" className="font-bold text-brand-800">Back to overview</Link></div></Card></div>;
}
