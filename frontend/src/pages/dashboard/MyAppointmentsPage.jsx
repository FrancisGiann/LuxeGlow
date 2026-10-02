import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../../context/DashboardContext';
import { AdminDialog } from '../../components/admin/AdminDialog';
import { cancelMyAppointment, getAvailableSlots, rescheduleMyAppointment } from '../../api/endpoints';
import { useToast } from '../../components/ui/Toast';
import { Card } from '../../components/ui/Card';
import { EmptyState, SkeletonRows } from '../../components/ui/EmptyState';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { RateVisitModal } from '../../components/dashboard/RateVisitModal';
import { BookingReceiptModal } from '../../components/booking/BookingReceiptModal';
import { classifyAppointments } from '../../utils/appointments';
import { toAppointmentDate } from '../../utils/format';
import { IconCalendar, IconGrid, IconPrinter, IconSparkle, IconStar } from '../../components/icons';

const TABS = [['upcoming', 'Upcoming'], ['recent', 'Recent'], ['history', 'History']];
const manilaDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const maxBookingDate = () => { const [year, month, day] = manilaDate().split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day + 60)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`; };
function canCustomerManage(appointment) {
  if (!['Pending', 'Confirmed'].includes(appointment.status) || appointment.arrived_at) return false;
  const start = appointment.start_at ? Date.parse(appointment.start_at) : toAppointmentDate(appointment.raw_date, appointment.raw_time).getTime();
  return Number.isFinite(start) && start > Date.now();
}
function StarsRow({ rating }) { return <span className="flex items-center gap-0.5 text-gold-500" aria-label={`${rating} out of 5 stars`}>{Array.from({ length: 5 }).map((_, i) => <IconStar key={i} size={13} filled={i < rating} />)}</span>; }
function AppointmentRow({ appointment, onRate, onReceipt, onView, onReschedule, onCancel }) {
  const date = toAppointmentDate(appointment.raw_date, appointment.raw_time);
  const dateLabel = date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeLabel = date.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });
  const manageable = canCustomerManage(appointment);
  const actionClassName = 'min-h-12 w-full whitespace-normal px-3.5 py-2 text-center leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 sm:w-auto sm:min-w-44';

  return (
    <li className="grid gap-x-6 gap-y-3 border-b border-line px-1 py-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start lg:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)_auto] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-blush-50 text-brand-300">
          {appointment.service_image ? <img src={appointment.service_image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <IconSparkle size={17} aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-medium text-ink-900">{appointment.service}</p>
          <p className="mt-1 break-words text-xs text-ink-500">
            {appointment.staff_name || 'Unassigned'} · Reference {appointment.reference_no || appointment.id} · Booked {appointment.created_at ? new Date(appointment.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '—'}
          </p>
        </div>
      </div>

      <div className="min-w-0 text-sm sm:text-right lg:text-left">
        <p className="font-semibold text-ink-800">{dateLabel}</p>
        <p className="mt-1 text-xs text-ink-500">{timeLabel}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-1 lg:justify-self-end">
        <StatusPill status={appointment.status} size="sm" />
        {appointment.has_rating ? <StarsRow rating={appointment.rating_given} /> : appointment.status === 'Completed' ? (
          <button type="button" onClick={() => onRate(appointment.id)} className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-blush-600 hover:text-blush-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800">
            <IconStar size={13} filled aria-hidden="true" /> Rate visit
          </button>
        ) : null}
      </div>

      <div className="col-span-full flex w-full flex-wrap justify-start gap-2 sm:justify-end">
        {['Pending', 'Confirmed'].includes(appointment.status) && (
          <Button type="button" variant="primary" size="sm" className={actionClassName} onClick={() => onView(appointment)}>
            <IconPrinter size={14} aria-hidden="true" /> View booking details
          </Button>
        )}
        {appointment.status === 'Completed' && (
          <Button type="button" variant="primary" size="sm" className={actionClassName} onClick={() => onReceipt(appointment)}>
            <IconPrinter size={14} aria-hidden="true" /> View / print booking confirmation
          </Button>
        )}
        {manageable && (
          <>
            <Button type="button" variant="soft" size="sm" className={actionClassName} onClick={() => onReschedule(appointment)}>
              Change date or time
            </Button>
            <Button type="button" variant="soft" size="sm" className={`${actionClassName} border-danger/30 text-danger hover:border-danger/50 hover:bg-danger/5`} onClick={() => onCancel(appointment)}>
              Cancel booking
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function RescheduleDialog({ appointment, onClose, onSave }) {
  const [date, setDate] = useState(appointment.raw_date);
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState([]);
  const [loadedDate, setLoadedDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loading = loadedDate !== date;
  useEffect(() => {
    let alive = true;
    getAvailableSlots(date, Math.max(1, Number(appointment.total_duration_minutes) || 30), appointment.staff_id)
      .then((next) => { if (alive) { setSlots(next); setError(''); setLoadedDate(date); setTime((current) => current && next.some((slot) => slot.time === current && slot.available) ? current : ''); } })
      .catch((failure) => { if (alive) { setSlots([]); setError(failure.message || 'Could not load available times.'); setLoadedDate(date); } });
    return () => { alive = false; };
  }, [appointment.staff_id, appointment.total_duration_minutes, date]);
  const save = async (event) => {
    event.preventDefault();
    if (!time || busy) return;
    setBusy(true);
    setError('');
    try { await onSave(appointment, date, time); }
    catch (failure) { setError(failure.message || 'Could not reschedule this appointment.'); }
    finally { setBusy(false); }
  };
  return <AdminDialog open title="Change appointment time" description="Choose a new date and an available start time. Your request will return to Pending for salon confirmation." onClose={onClose} closeDisabled={busy} size="wide">
    <form onSubmit={save} className="space-y-4">
      <label className="block text-sm font-semibold text-ink-900">New date<input type="date" required min={manilaDate()} max={maxBookingDate()} value={date} onChange={(event) => { setDate(event.target.value); setTime(''); }} className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm" /></label>
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-900">Available times</p>
        {loading ? <p className="py-5 text-sm text-ink-500" role="status">Checking availability…</p> : error && !slots.length ? <p className="text-sm text-danger" role="alert">{error}</p> : slots.filter((slot) => slot.available).length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.filter((slot) => slot.available).map((slot) => <button key={slot.time} type="button" aria-pressed={time === slot.time} onClick={() => setTime(slot.time)} className={`min-h-11 rounded-lg border px-2 text-sm font-bold ${time === slot.time ? 'border-brand-800 bg-brand-800 text-white' : 'border-line bg-surface text-ink-700 hover:border-brand-400'}`}>{slot.time}</button>)}</div> : <p className="text-sm text-ink-500">No times are available for this date.</p>}
      </div>
      {error && slots.length > 0 && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="soft" onClick={onClose} disabled={busy}>Back</Button><Button type="submit" loading={busy} disabled={!time || loading}>{busy ? 'Saving…' : 'Save new time'}</Button></div>
    </form>
  </AdminDialog>;
}
function CancelDialog({ appointment, onClose, onSave }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (event) => {
    event.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason || cleanReason.length > 500 || busy) { setError('Enter a reason between 1 and 500 characters.'); return; }
    setBusy(true);
    setError('');
    try { await onSave(appointment, cleanReason); }
    catch (failure) { setError(failure.message || 'Could not cancel this appointment.'); }
    finally { setBusy(false); }
  };
  return <AdminDialog open title="Cancel appointment" description="Tell us why you need to cancel. The salon can see this reason with the appointment details." onClose={onClose} closeDisabled={busy}>
    <form onSubmit={save}>
      <label className="block text-sm font-semibold text-ink-900">Cancellation reason<textarea required maxLength={500} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" /></label>
      <p className="mt-1 text-right text-xs text-ink-500">{reason.trim().length}/500</p>
      {error && <p className="mt-3 text-sm font-semibold text-danger" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="soft" onClick={onClose} disabled={busy}>Keep appointment</Button><Button type="submit" variant="danger" loading={busy} disabled={!reason.trim()}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</Button></div>
    </form>
  </AdminDialog>;
}

export function MyAppointmentsPage() {
  const { appointments, customer, loading, refresh } = useDashboard();
  const toast = useToast();
  const [tab, setTab] = useState('upcoming'); const [rateFor, setRateFor] = useState(null); const [receiptFor, setReceiptFor] = useState(null);
  const [rescheduleFor, setRescheduleFor] = useState(null); const [cancelFor, setCancelFor] = useState(null);
  const groups = useMemo(() => classifyAppointments(appointments), [appointments]); const visible = groups[tab];
  const saveReschedule = async (appointment, date, time) => {
    const result = await rescheduleMyAppointment(appointment.id, date, time);
    if (!result.success) throw new Error(result.error);
    await refresh();
    setRescheduleFor(null);
    toast('Appointment rescheduled. It is pending salon confirmation.', 'success');
  };
  const saveCancellation = async (appointment, reason) => {
    const result = await cancelMyAppointment(appointment.id, reason);
    if (!result.success) throw new Error(result.error);
    await refresh();
    setCancelFor(null);
    toast('Appointment cancelled.', 'success');
  };
  return <div className="mx-auto max-w-[1240px]"><div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-display text-3xl font-medium text-ink-900">My appointments</h2><p className="mt-2 text-sm text-ink-500">Keep track of upcoming requests and completed visits.</p></div><Link to="/dashboard/book"><Button>Book an appointment</Button></Link></div><div role="tablist" aria-label="Appointment groups" className="mb-5 flex flex-wrap gap-1 border-b border-line">{TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-11 border-b-2 px-4 text-sm font-bold transition-colors ${tab === key ? 'border-brand-800 text-brand-800' : 'border-transparent text-ink-500 hover:text-ink-900'}`}>{label}<span className="ml-2 text-xs text-ink-400">{loading ? '—' : groups[key].length}</span></button>)}</div><Card className="p-5 sm:p-7">{loading && <SkeletonRows rows={4} className="py-4" />}{!loading && !visible.length && <EmptyState icon={tab === 'upcoming' ? IconCalendar : tab === 'recent' ? IconSparkle : IconGrid} title={tab === 'upcoming' ? 'No upcoming appointments' : tab === 'recent' ? 'No recent visits' : 'Nothing in history yet'} description={tab === 'upcoming' ? 'Your next booking will appear here once it is placed.' : tab === 'recent' ? 'Completed visits from the last 30 days appear here.' : 'Older and cancelled bookings stay here for your records.'} action={<Link to="/dashboard/book" className="text-sm font-bold text-brand-800">Browse treatments</Link>} />}{!loading && visible.length > 0 && <ul>{visible.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onRate={setRateFor} onReceipt={setReceiptFor} onView={setReceiptFor} onReschedule={setRescheduleFor} onCancel={setCancelFor} />)}</ul>}</Card>{rateFor !== null && <RateVisitModal presetAppointmentId={String(rateFor)} onClose={() => setRateFor(null)} />}{receiptFor && <BookingReceiptModal receipt={{ reference: receiptFor.reference_no || receiptFor.id, customer, service: receiptFor.service, staffName: receiptFor.staff_name, raw_date: receiptFor.raw_date, raw_time: receiptFor.raw_time, price: receiptFor.price, status: receiptFor.status, createdAt: receiptFor.created_at }} onClose={() => setReceiptFor(null)} hidePrint={receiptFor.status === 'Pending'} />}{rescheduleFor && <RescheduleDialog appointment={rescheduleFor} onClose={() => setRescheduleFor(null)} onSave={saveReschedule} />}{cancelFor && <CancelDialog appointment={cancelFor} onClose={() => setCancelFor(null)} onSave={saveCancellation} />}</div>;
}
