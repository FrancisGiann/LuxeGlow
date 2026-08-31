import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState, SkeletonRows } from '../../components/ui/EmptyState';
import { StatusPill } from '../../components/ui/StatusPill';
import { formatPeso, formatLongDate, formatTime, getCurrentTimestamp, toAppointmentDate } from '../../utils/format';
import { IconBell, IconCalendar, IconClock, IconSparkle } from '../../components/icons';

function NextAppointment() {
  const { appointments, loading } = useDashboard();
  if (loading) return <Card className="p-6"><SkeletonRows rows={4} /></Card>;
  const now = getCurrentTimestamp();
  const upcoming = appointments.filter((appointment) => ['Confirmed', 'Pending'].includes(appointment.status)).map((appointment) => ({ ...appointment, instant: toAppointmentDate(appointment.raw_date, appointment.raw_time).getTime() })).filter((appointment) => appointment.instant >= now).sort((a, b) => a.instant - b.instant)[0];
  return <Card className="overflow-hidden"><div className="flex items-center justify-between gap-4 border-b border-line px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500">Next appointment</p><h2 className="mt-2 font-display text-2xl font-medium text-ink-900">{upcoming ? upcoming.service : 'Nothing scheduled yet'}</h2>{upcoming && <p className="mt-1 text-sm text-ink-500">{upcoming.staff_name || 'Unassigned'}</p>}</div>{upcoming && <StatusPill status={upcoming.status} />}</div>{upcoming ? <div className="grid gap-5 px-6 py-6 sm:grid-cols-[1fr_auto] sm:items-end"><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="flex items-center gap-2 text-ink-500"><IconCalendar size={15} />Date</dt><dd className="mt-1 font-semibold text-ink-900">{formatLongDate(toAppointmentDate(upcoming.raw_date, upcoming.raw_time))}</dd></div><div><dt className="flex items-center gap-2 text-ink-500"><IconClock size={15} />Time</dt><dd className="mt-1 font-semibold text-ink-900">{formatTime(toAppointmentDate(upcoming.raw_date, upcoming.raw_time))}</dd></div></dl><p className="font-display text-2xl font-semibold text-brand-800">{formatPeso(upcoming.price)}</p></div> : <EmptyState icon={IconCalendar} title="No upcoming visits" description="Your next booking will appear here once it is placed." action={<Link to="/dashboard/book" className="text-sm font-bold text-brand-800">Book an appointment</Link>} />}</Card>;
}

function VisitStatus() {
  const { summary, loading } = useDashboard();
  const rows = [['Pending requests', summary.pending_count], ['Confirmed visits', summary.confirmed_count], ['Completed visits', summary.completed_count], ['Cancelled visits', summary.cancelled_count]];
  return <Card className="p-6"><CardHeader title="Your appointment record" subtitle="A quick view of the current status of your bookings." /><dl className="mt-2 divide-y divide-line">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 py-3"><dt className="text-sm text-ink-600">{label}</dt><dd className="font-display text-xl font-semibold text-ink-900">{loading ? '—' : value}</dd></div>)}</dl><Link to="/dashboard/appointments" className="mt-4 inline-flex text-sm font-bold text-brand-800 hover:text-brand-900">View all appointments</Link></Card>;
}

function RecentActivity() {
  const { notifications, appointments, loading } = useDashboard();
  const visits = appointments.filter((appointment) => appointment.status === 'Completed').slice(0, 3);
  return <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><Card className="p-6"><CardHeader title="Recent notifications" action={<Link to="/dashboard/notifications" className="text-sm font-bold text-brand-800">View all</Link>} /><div className="mt-3">{loading ? <SkeletonRows rows={3} /> : notifications.length ? <ul className="divide-y divide-line">{notifications.slice(0, 4).map((notification) => <li key={notification.id} className="flex items-start gap-3 py-4 first:pt-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.is_read ? 'bg-line-strong' : 'bg-blush-600'}`} /><div><p className="text-sm font-semibold text-ink-900">{notification.title}</p><p className="mt-1 text-xs leading-relaxed text-ink-500">{notification.message}</p><p className="mt-1 text-[11px] text-ink-400">{notification.created_at}</p></div></li>)}</ul> : <EmptyState icon={IconBell} title="No notifications yet" description="Booking updates will appear here." />}</div></Card><Card className="p-6"><CardHeader title="Completed visits" action={<Link to="/dashboard/reviews" className="text-sm font-bold text-brand-800">Ratings &amp; Reviews</Link>} /><div className="mt-3">{loading ? <SkeletonRows rows={2} /> : visits.length ? <ul className="divide-y divide-line">{visits.map((visit) => <li key={visit.id} className="flex items-start justify-between gap-4 py-4 first:pt-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink-900">{visit.service}</p><p className="mt-1 text-xs text-ink-500">{visit.staff_name || 'Unassigned'} · {visit.date} · {visit.time}</p></div><div className="text-right"><StatusPill status={visit.status} size="sm" /><p className="mt-2 font-display text-base font-semibold text-brand-800">{formatPeso(visit.price)}</p></div></li>)}</ul> : <EmptyState icon={IconSparkle} title="No completed visits yet" description="Your appointment history will build here." />}</div></Card></div>;
}

export function DashboardOverviewPage() {
  const { customer } = useAuth();
  return <div className="mx-auto max-w-[1240px]"><div className="mb-8"><h2 className="font-display text-3xl font-medium text-ink-900">Welcome back, {customer?.first_name || 'friend'}.</h2><p className="mt-2 text-ink-500">Your appointment journey, in one place.</p></div><div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]"><NextAppointment /><VisitStatus /></div><div className="mt-6"><RecentActivity /></div></div>;
}
