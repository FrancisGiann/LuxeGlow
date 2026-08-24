import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../../context/DashboardContext';
import { Card } from '../../components/ui/Card';
import { EmptyState, SkeletonRows } from '../../components/ui/EmptyState';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { RateVisitModal } from '../../components/dashboard/RateVisitModal';
import { classifyAppointments } from '../../utils/appointments';
import { formatPeso, toAppointmentDate } from '../../utils/format';
import { IconStar } from '../../components/icons';

const TABS = [
  ['upcoming', 'Upcoming'],
  ['recent', 'Recent'],
  ['history', 'History'],
];

function StarsRow({ rating }) {
  return (
    <span className="flex items-center gap-0.5 text-gold-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStar key={i} size={13} filled={i < rating} />
      ))}
    </span>
  );
}

function AppointmentCard({ appt, onRate }) {
  const dt = toAppointmentDate(appt.raw_date, appt.raw_time);
  const dateLabel = dt.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeLabel = dt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <li className="flex flex-col gap-4 border-b border-line py-5 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center">
      {/* Service */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink-900">{appt.service}</p>
        <p className="mt-0.5 text-xs text-ink-400">
          Ref <span className="font-semibold text-brand-800">#{appt.id}</span> · Booked {appt.created_at ? new Date(appt.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '—'}
        </p>
      </div>

      {/* When */}
      <div className="text-sm">
        <p className="font-semibold text-ink-700">{dateLabel}</p>
        <p className="text-xs text-ink-400">{timeLabel}</p>
      </div>

      {/* Price */}
      <span className="w-28 font-display text-lg font-bold text-brand-800 sm:text-right">
        {formatPeso(appt.price)}
      </span>

      {/* Status / rating action */}
      <div className="flex items-center gap-3 sm:w-44 sm:flex-wrap sm:justify-end">
        <StatusPill status={appt.status} size="sm" />
        {appt.has_rating ? (
          <StarsRow rating={appt.rating_given} />
        ) : appt.status === 'Completed' ? (
          <button onClick={() => onRate(appt.id)} className="text-xs font-bold text-blush-600 transition-colors hover:text-blush-700">
            ★ Rate this visit
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function MyAppointmentsPage() {
  const { appointments, loading } = useDashboard();
  const [tab, setTab] = useState('upcoming');
  const [rateFor, setRateFor] = useState(null); // appointment id | 'any'

  const groups = useMemo(() => classifyAppointments(appointments), [appointments]);
  const visible = groups[tab];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">My Appointments</h2>
          <p className="mt-1 text-sm text-ink-500">Manage your upcoming pampering sessions and revisit your history.</p>
        </div>
        <Link to="/dashboard/book">
          <Button>+ Book Appointment</Button>
        </Link>
      </div>

      {/* Tab bar */}
      <div role="tablist" aria-label="Appointment groups" className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card">
        {TABS.map(([key, label]) => {
          const count = groups[key].length;
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                active ? 'bg-brand-800 text-white shadow-card' : 'text-ink-500 hover:bg-canvas hover:text-ink-900'
              }`}
            >
              {label}
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none ${
                  active ? 'bg-white/20 text-white' : 'bg-canvas text-ink-500'
                }`}
              >
                {loading ? '…' : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <Card className="px-6 py-2 sm:px-8">
        {loading && <SkeletonRows rows={3} className="py-5" />}

        {!loading && visible.length === 0 && (
          <EmptyState
            icon={tab === 'upcoming' ? '🗓' : tab === 'recent' ? '✨' : '🗂'}
            title={
              tab === 'upcoming'
                ? 'No upcoming appointments'
                : tab === 'recent'
                  ? 'No recent visits'
                  : 'Nothing in history yet'
            }
            description={
              tab === 'upcoming'
                ? 'Your next bookings will appear here as soon as they are placed.'
                : tab === 'recent'
                  ? `Visits you completed in the last 30 days show up here.`
                  : 'Older and cancelled bookings are kept here for your records.'
            }
            action={<Link to="/" className="text-sm font-semibold text-brand-800 hover:text-brand-900">Browse services →</Link>}
          />
        )}

        {!loading && visible.length > 0 && (
          <ul className="divide-y divide-line">
            {visible.map((a) => (
              <AppointmentCard key={a.id} appt={a} onRate={(id) => setRateFor(id)} />
            ))}
          </ul>
        )}
      </Card>

      {rateFor !== null && (
        <RateVisitModal presetAppointmentId={String(rateFor)} onClose={() => setRateFor(null)} />
      )}
    </div>
  );
}
