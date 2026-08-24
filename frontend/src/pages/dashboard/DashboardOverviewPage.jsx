import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState, SkeletonRows } from '../../components/ui/EmptyState';
import { StatusPill } from '../../components/ui/StatusPill';
import { formatPeso, toAppointmentDate, formatLongDate, formatTime } from '../../utils/format';
import { IconArrowRight, IconBell, IconCalendar, IconCheckCircle, IconClock } from '../../components/icons';

function MetricCard({ to, tone, icon: Icon, value, label, loading }) {
  const tones = {
    brand: 'bg-brand-100 text-brand-800',
    gold: 'bg-gold-100 text-gold-600',
    success: 'bg-success/10 text-success',
    danger: 'bg-danger/10 text-danger',
  };
  return (
    <Link to={to} className="group">
      <Card hoverable className="flex items-center gap-4 p-5">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={22} />
        </span>
        <div className="min-w-0">
          {loading ? (
            <div className="h-8 w-14 animate-pulse rounded-lg bg-canvas" />
          ) : (
            <span className="block font-display text-3xl font-bold leading-none text-ink-900">{value}</span>
          )}
          <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        </div>
        <IconArrowRight size={16} className="ml-auto shrink-0 text-line-strong transition-all group-hover:translate-x-0.5 group-hover:text-brand-800" />
      </Card>
    </Link>
  );
}

function NextAppointmentCard() {
  const { appointments, loading } = useDashboard();

  if (loading) return <Card className="p-6"><SkeletonRows rows={4} /></Card>;

  const now = new Date();
  const upcoming = appointments
    .filter((a) => ['Confirmed', 'Pending'].includes(a.status))
    .map((a) => ({ ...a, ts: toAppointmentDate(a.raw_date, a.raw_time).getTime() }))
    .filter((a) => a.ts >= now.getTime())
    .sort((a, b) => a.ts - b.ts)[0];

  return (
    <Card className="flex flex-col p-6">
      <CardHeader title="Next Appointment" subtitle={upcoming ? 'We can’t wait to see you!' : undefined} />
      {!upcoming ? (
        <EmptyState
          icon="🗓"
          title="No upcoming visits"
          description="When you book an appointment, it will appear here."
          action={
            <div className="flex items-center justify-center gap-4">
              <Link to="/dashboard/book" className="text-sm font-semibold text-brand-800 hover:text-brand-900">+ Book now</Link>
              <Link to="/dashboard/appointments" className="text-sm font-semibold text-brand-800 hover:text-brand-900">View my bookings →</Link>
            </div>
          }
        />
      ) : (
        <div className="mt-2 flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl font-bold text-ink-900">{upcoming.service}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink-400">Ref #{upcoming.id}</p>
            </div>
            <StatusPill status={upcoming.status} />
          </div>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            <dt className="flex items-center gap-1.5 font-semibold text-ink-500"><IconCalendar size={15} /> Date</dt>
            <dd className="font-medium text-ink-900">{formatLongDate(toAppointmentDate(upcoming.raw_date, upcoming.raw_time))}</dd>
            <dt className="flex items-center gap-1.5 font-semibold text-ink-500"><IconClock size={15} /> Time</dt>
            <dd className="font-medium text-ink-900">{formatTime(toAppointmentDate(upcoming.raw_date, upcoming.raw_time))}</dd>
          </dl>
          <div className="mt-auto flex items-center justify-between border-t border-line pt-4 mt-5">
            <span className="font-display text-2xl font-bold text-brand-800">{formatPeso(upcoming.price)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function RecentNotifications() {
  const { notifications, loading } = useDashboard();
  return (
    <Card className="flex flex-col p-6">
      <CardHeader
        title="Recent Notifications"
        action={<Link to="/dashboard/notifications" className="text-sm font-bold text-brand-800 hover:text-brand-900">View all →</Link>}
      />
      <div className="mt-4 flex flex-col gap-1">
        {loading && <SkeletonRows rows={3} />}
        {!loading && notifications.length === 0 && (
          <EmptyState icon="🔕" title="No notifications yet" description="Booking updates will show up here." />
        )}
        {!loading &&
          notifications.slice(0, 4).map((n) => (
            <div key={n.id} className={`rounded-xl px-4 py-3 ${n.is_read ? '' : 'bg-brand-50/70'}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink-900">{n.title}</p>
                {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blush-600" />}
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{n.message}</p>
              <p className="mt-1 text-[11px] text-ink-300">{n.created_at}</p>
            </div>
          ))}
      </div>
    </Card>
  );
}

function RecentVisits() {
  const { appointments, loading } = useDashboard();
  const visits = appointments.filter((a) => a.status === 'Completed').slice(0, 3);

  return (
    <Card className="p-6">
      <CardHeader
        title="Recent Visits"
        action={<Link to="/dashboard/appointments" className="text-sm font-bold text-brand-800 hover:text-brand-900">View all →</Link>}
      />
      <div className="mt-4">
        {loading && <SkeletonRows rows={2} />}
        {!loading && visits.length === 0 && <EmptyState icon="✨" title="No completed visits yet" description="Your pampering history will build up here." />}
        {!loading && visits.length > 0 && (
          <ul className="divide-y divide-line">
            {visits.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{v.service}</p>
                  <p className="text-xs text-ink-400">{v.date} · {v.time}</p>
                </div>
                <StatusPill status={v.status} size="sm" />
                <span className="w-24 text-right font-display text-base font-bold text-brand-800">{formatPeso(v.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function DashboardOverviewPage() {
  const { customer } = useAuth();
  const { summary, loading } = useDashboard();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold">
          Welcome back, {customer?.first_name || 'friend'}!
        </h2>
        <p className="mt-1 text-ink-500">Here's what's happening with your visits.</p>
      </div>

      {/* Metric row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard to="/dashboard/appointments" tone="brand" icon={IconCalendar} value={summary.confirmed_count} label="Upcoming Bookings" loading={loading} />
        <MetricCard to="/dashboard/appointments" tone="gold" icon={IconClock} value={summary.pending_count} label="Pending Requests" loading={loading} />
        <MetricCard to="/dashboard/reviews" tone="success" icon={IconCheckCircle} value={summary.completed_count} label="Completed Visits" loading={loading} />
        <MetricCard to="/dashboard/notifications" tone="danger" icon={IconBell} value={summary.unread_notifications} label="Unread Alerts" loading={loading} />
      </div>

      {/* Middle row */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <NextAppointmentCard />
        <RecentNotifications />
      </div>

      {/* Bottom row */}
      <div className="mt-6">
        <RecentVisits />
      </div>
    </div>
  );
}
