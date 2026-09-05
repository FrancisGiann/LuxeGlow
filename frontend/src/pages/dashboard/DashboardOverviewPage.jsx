import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Card } from '../../components/ui/Card';
import { EmptyState, SkeletonRows } from '../../components/ui/EmptyState';
import { StatusPill } from '../../components/ui/StatusPill';
import { formatPeso, formatLongDate, formatTime, getCurrentTimestamp, toAppointmentDate } from '../../utils/format';
import { IconCalendar, IconClock } from '../../components/icons';

function NextAppointment() {
  const { appointments, loading } = useDashboard();
  if (loading) return <Card className="p-6"><SkeletonRows rows={4} /></Card>;
  const now = getCurrentTimestamp();
  const upcoming = appointments.filter((appointment) => ['Confirmed', 'Pending'].includes(appointment.status)).map((appointment) => ({ ...appointment, instant: toAppointmentDate(appointment.raw_date, appointment.raw_time).getTime() })).filter((appointment) => appointment.instant >= now).sort((a, b) => a.instant - b.instant)[0];
  return <Card className="overflow-hidden"><div className="flex items-center justify-between gap-4 border-b border-line px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500">Next appointment</p><h2 className="mt-2 font-display text-2xl font-medium text-ink-900">{upcoming ? upcoming.service : 'Nothing scheduled yet'}</h2>{upcoming && <p className="mt-1 text-sm text-ink-500">{upcoming.staff_name || 'Unassigned'}</p>}</div>{upcoming && <StatusPill status={upcoming.status} />}</div>{upcoming ? <div className="grid gap-5 px-6 py-6 sm:grid-cols-[1fr_auto] sm:items-end"><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="flex items-center gap-2 text-ink-500"><IconCalendar size={15} />Date</dt><dd className="mt-1 font-semibold text-ink-900">{formatLongDate(toAppointmentDate(upcoming.raw_date, upcoming.raw_time))}</dd></div><div><dt className="flex items-center gap-2 text-ink-500"><IconClock size={15} />Time</dt><dd className="mt-1 font-semibold text-ink-900">{formatTime(toAppointmentDate(upcoming.raw_date, upcoming.raw_time))}</dd></div></dl><p className="font-display text-2xl font-semibold text-brand-800">{formatPeso(upcoming.price)}</p></div> : <EmptyState icon={IconCalendar} title="No upcoming visits" description="Your next booking will appear here once it is placed." action={<Link to="/book" className="text-sm font-bold text-brand-800">Book an appointment</Link>} />}</Card>;
}

export function DashboardOverviewPage() {
  const { customer } = useAuth();
  return <div className="mx-auto max-w-[900px]"><div className="mb-8"><h2 className="font-display text-3xl font-medium text-ink-900">Welcome back, {customer?.first_name || 'friend'}.</h2><p className="mt-2 text-ink-500">Your next visit and the actions you use most.</p></div><NextAppointment /><nav aria-label="Customer shortcuts" className="mt-6 grid gap-3 sm:grid-cols-2"><Link to="/book" className="rounded-xl bg-brand-800 px-4 py-4 text-sm font-bold text-white shadow-card hover:bg-brand-900">Book an appointment</Link><Link to="/dashboard/appointments" className="rounded-xl border border-line bg-surface px-4 py-4 text-sm font-bold text-brand-800 hover:border-brand-300">View appointments</Link></nav></div>;
}
