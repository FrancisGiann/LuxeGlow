import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../../context/DashboardContext';
import { AdminDialog } from '../../components/admin/AdminDialog';
import { cancelMyAppointment, getRescheduleSlots, rescheduleMyAppointment } from '../../api/endpoints';
import { useToast } from '../../components/ui/Toast';
import { Card } from '../../components/ui/Card';
import { EmptyState, SkeletonRows } from '../../components/ui/EmptyState';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { RateVisitModal } from '../../components/dashboard/RateVisitModal';
import { BookingReceiptModal } from '../../components/booking/BookingReceiptModal';
import { pendingReschedule, requestedTimeLabel } from '../../utils/rescheduleRequests';
import { RescheduleRequestHistory } from '../../components/booking/RescheduleRequestHistory';
import { classifyAppointments, filterCompletedAppointmentsByDate } from '../../utils/appointments';
import { toAppointmentDate } from '../../utils/format';
import { IconCalendar, IconGrid, IconPrinter, IconSparkle, IconStar } from '../../components/icons';

const TABS = [['upcoming', 'Upcoming'], ['history', 'History']];
const CANCELLATION_REASONS = ['Schedule conflict', 'Change of plans', 'Booked by mistake', 'Feeling unwell', 'Other'];
const RESCHEDULE_REASONS = ['Schedule conflict', 'Change of plans', 'Feeling unwell', 'Others'];
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
    <li className="grid gap-x-6 gap-y-3 border-b border-line px-3 py-5 odd:bg-surface even:bg-blush-100 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start lg:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)_auto] lg:items-center">
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

      {pendingReschedule(appointment) && <p className="col-span-full break-words text-sm font-semibold text-brand-800" role="status">Requested: {requestedTimeLabel(pendingReschedule(appointment))}. Your current appointment remains scheduled until approval.</p>}
      <RescheduleRequestHistory requests={appointment.reschedule_requests} />
      <div className="col-span-full flex w-full flex-wrap justify-start gap-2 sm:justify-end">
        {['Pending', 'Confirmed'].includes(appointment.status) && (
          <Button type="button" variant="primary" size="sm" className={actionClassName} onClick={() => onView(appointment)}>
            <IconPrinter size={14} aria-hidden="true" /> View booking details
          </Button>
        )}
        {appointment.status === 'Completed' && (
          <Button type="button" variant="primary" size="sm" className={actionClassName} onClick={() => onReceipt(appointment)}>
            <IconPrinter size={14} aria-hidden="true" /> Print booking confirmation
          </Button>
        )}
        {manageable && (
          <>
            <Button type="button" variant="soft" size="sm" className={actionClassName} onClick={() => onReschedule(appointment)}>
              {pendingReschedule(appointment) ? 'Update reschedule request' : 'Request a reschedule'}
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
  const [reasonChoice, setReasonChoice] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [slots, setSlots] = useState([]);
  const [loadedDate, setLoadedDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reasonError, setReasonError] = useState('');
  const loading = loadedDate !== date;
  useEffect(() => {
    let alive = true;
    getRescheduleSlots(appointment.id, date)
      .then((next) => { if (alive) { setSlots(next); setError(''); setLoadedDate(date); setTime((current) => current && next.some((slot) => slot.time === current && slot.available) ? current : ''); } })
      .catch((failure) => { if (alive) { setSlots([]); setError(failure.message || 'Could not load available times.'); setLoadedDate(date); } });
    return () => { alive = false; };
  }, [appointment.id, date]);
  const save = async (event) => {
    event.preventDefault();
    if (!time || busy) return;
    if (!RESCHEDULE_REASONS.includes(reasonChoice)) {
      setReasonError('Choose a reason for rescheduling.');
      return;
    }
    const cleanReason = reasonChoice === 'Others' ? otherReason.trim() : reasonChoice;
    if (reasonChoice === 'Others' && (!cleanReason || cleanReason.length > 500)) {
      setReasonError('Enter a reason between 1 and 500 characters.');
      return;
    }
    setBusy(true);
    setError('');
    setReasonError('');
    try { await onSave(appointment, date, time, cleanReason); }
    catch (failure) { setError(failure.message || 'Could not submit this request.'); }
    finally { setBusy(false); }
  };
  const invalidChoice = Boolean(reasonError) && !RESCHEDULE_REASONS.includes(reasonChoice);
  const invalidOtherReason = Boolean(reasonError) && reasonChoice === 'Others';
  const reasonErrorDescription = reasonError ? ' reschedule-reason-error' : '';
  return <AdminDialog open title="Request a reschedule" description="Choose a new time for salon approval. Your current appointment stays scheduled. The requested time is not reserved until approval; a new request replaces your earlier pending request." onClose={onClose} closeDisabled={busy} size="wide">
    <form onSubmit={save} className="space-y-4">
      <label className="block text-sm font-semibold text-ink-900">New date<input type="date" required min={manilaDate()} max={maxBookingDate()} value={date} onChange={(event) => { setDate(event.target.value); setTime(''); }} className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm" /></label>
      <div>
        <label htmlFor="reschedule-reason" className="block text-sm font-semibold text-ink-900">Reason for rescheduling</label>
        <select id="reschedule-reason" required value={reasonChoice} aria-invalid={invalidChoice} aria-describedby={`reschedule-reason-hint${invalidChoice ? reasonErrorDescription : ''}`} onChange={(event) => { setReasonChoice(event.target.value); setReasonError(''); }} className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <option value="" disabled>Select a reason</option>
          {RESCHEDULE_REASONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <p id="reschedule-reason-hint" className="mt-1 text-xs text-ink-500">The salon can see this reason with the appointment details.</p>
        {reasonChoice === 'Others' && <div className="mt-3">
          <label htmlFor="reschedule-other-reason" className="block text-sm font-semibold text-ink-900">Please specify</label>
          <textarea id="reschedule-other-reason" required maxLength={500} rows={3} value={otherReason} aria-invalid={invalidOtherReason} aria-describedby={`reschedule-reason-hint reschedule-reason-count${invalidOtherReason ? reasonErrorDescription : ''}`} onChange={(event) => { const nextReason = event.target.value; setOtherReason(nextReason); if (reasonError && nextReason.trim() && nextReason.trim().length <= 500) setReasonError(''); }} className="mt-1 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" />
          <p id="reschedule-reason-count" className="text-right text-xs text-ink-500" aria-live="polite" aria-atomic="true">{otherReason.trim().length}/500</p>
        </div>}
        {reasonError && <p id="reschedule-reason-error" className="mt-1 text-sm font-semibold text-danger" role="alert">{reasonError}</p>}
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-900">Available times</p>
        {loading ? <p className="py-5 text-sm text-ink-500" role="status">Checking availability…</p> : error && !slots.length ? <p className="text-sm text-danger" role="alert">{error}</p> : slots.filter((slot) => slot.available).length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.filter((slot) => slot.available).map((slot) => <button key={slot.time} type="button" aria-pressed={time === slot.time} onClick={() => setTime(slot.time)} className={`min-h-11 rounded-lg border px-2 text-sm font-bold ${time === slot.time ? 'border-brand-800 bg-brand-800 text-white' : 'border-line bg-surface text-ink-700 hover:border-brand-400'}`}>{slot.time}</button>)}</div> : <p className="text-sm text-ink-500">No times are available for this date.</p>}
      </div>
      {error && slots.length > 0 && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="soft" onClick={onClose} disabled={busy}>Back</Button><Button type="submit" loading={busy} disabled={!time || loading || !reasonChoice || (reasonChoice === 'Others' && !otherReason.trim())}>{busy ? 'Submitting…' : 'Submit request'}</Button></div>
    </form>
  </AdminDialog>;
}
function CancelDialog({ appointment, onClose, onSave }) {
  const [reasonChoice, setReasonChoice] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (event) => {
    event.preventDefault();
    const cleanReason = (reasonChoice === 'Other' ? otherReason : reasonChoice).trim();
    if (!cleanReason || cleanReason.length > 500 || busy) { setError('Enter a reason between 1 and 500 characters.'); return; }
    setBusy(true);
    setError('');
    try { await onSave(appointment, cleanReason); }
    catch (failure) { setError(failure.message || 'Could not cancel this appointment.'); }
    finally { setBusy(false); }
  };
  return <AdminDialog open title="Cancel appointment" description="Tell us why you need to cancel. The salon can see this reason with the appointment details." onClose={onClose} closeDisabled={busy}>
    <form onSubmit={save}>
      <label className="block text-sm font-semibold text-ink-900">Cancellation reason<select required value={reasonChoice} onChange={(event) => { setReasonChoice(event.target.value); setError(''); }} className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm"><option value="" disabled>Select a reason</option>{CANCELLATION_REASONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      {reasonChoice === 'Other' && <label className="mt-3 block text-sm font-semibold text-ink-900">Please specify<textarea required maxLength={500} rows={3} value={otherReason} onChange={(event) => { setOtherReason(event.target.value); if (error && event.target.value.trim()) setError(''); }} className="mt-1 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" /></label>}
      {reasonChoice === 'Other' && <p className="mt-1 text-right text-xs text-ink-500">{otherReason.trim().length}/500</p>}
      {error && <p className="mt-3 text-sm font-semibold text-danger" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="soft" onClick={onClose} disabled={busy}>Keep appointment</Button><Button type="submit" variant="danger" loading={busy} disabled={!reasonChoice || (reasonChoice === 'Other' && !otherReason.trim())}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</Button></div>
    </form>
  </AdminDialog>;
}

export function MyAppointmentsPage() {
  const { appointments, customer, loading, refresh } = useDashboard();
  const toast = useToast();
  const [tab, setTab] = useState('upcoming'); const [rateFor, setRateFor] = useState(null); const [receiptFor, setReceiptFor] = useState(null);
  const [rescheduleFor, setRescheduleFor] = useState(null); const [cancelFor, setCancelFor] = useState(null);
  const [historyDate, setHistoryDate] = useState('');
  const groups = useMemo(() => classifyAppointments(appointments), [appointments]);
  const historyVisits = useMemo(() => filterCompletedAppointmentsByDate(groups.history, historyDate), [groups.history, historyDate]);
  const visible = tab === 'history' ? historyVisits : groups.upcoming;
  const saveReschedule = async (appointment, date, time, reason) => {
    const result = await rescheduleMyAppointment(appointment.id, date, time, reason);
    if (!result.success) throw new Error(result.error);
    await refresh();
    setRescheduleFor(null);
    toast('Reschedule requested. Your current appointment remains scheduled until approval.', 'success');
  };
  const saveCancellation = async (appointment, reason) => {
    const result = await cancelMyAppointment(appointment.id, reason);
    if (!result.success) throw new Error(result.error);
    await refresh();
    setCancelFor(null);
    toast('Appointment cancelled.', 'success');
  };
  return <div className="mx-auto max-w-[1240px]"><div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-display text-3xl font-medium text-ink-900">My appointments</h2><p className="mt-2 text-sm text-ink-500">Keep track of upcoming bookings and completed visits.</p></div><Link to="/dashboard/book"><Button>Book an appointment</Button></Link></div><div role="tablist" aria-label="Appointment groups" className="mb-5 flex flex-wrap gap-1 border-b border-line">{TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-11 border-b-2 px-4 text-sm font-bold transition-colors ${tab === key ? 'border-brand-800 text-brand-800' : 'border-transparent text-ink-500 hover:text-ink-900'}`}>{label}<span className="ml-2 text-xs text-ink-400">{loading ? '—' : groups[key].length}</span></button>)}</div><Card className="p-5 sm:p-7">{tab === 'history' && <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><label htmlFor="history-visit-date" className="block text-sm font-semibold text-ink-900">Filter completed visits by date<input id="history-visit-date" type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className="mt-1 block min-h-11 rounded-xl border border-line bg-surface px-4 text-sm" /></label><p className="text-sm text-ink-500" role="status" aria-live="polite">{historyVisits.length}{historyDate ? ` of ${groups.history.length}` : ''} completed visit{historyVisits.length === 1 ? '' : 's'}</p></div>}{loading && <SkeletonRows rows={4} className="py-4" />}{!loading && !visible.length && <EmptyState icon={tab === 'upcoming' ? IconCalendar : IconGrid} title={tab === 'upcoming' ? 'No upcoming appointments' : historyDate ? 'No completed visits on this date' : 'No completed visits yet'} description={tab === 'upcoming' ? 'Your next booking will appear here once it is placed.' : historyDate ? 'Choose another date or clear the filter to see all completed visits.' : 'Completed visits will appear here after your appointment.'} action={tab === 'upcoming' ? <Link to="/dashboard/book" className="text-sm font-bold text-brand-800">Browse treatments</Link> : null} />}{!loading && visible.length > 0 && <ul>{visible.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onRate={setRateFor} onReceipt={setReceiptFor} onView={setReceiptFor} onReschedule={setRescheduleFor} onCancel={setCancelFor} />)}</ul>}</Card>{rateFor !== null && <RateVisitModal presetAppointmentId={String(rateFor)} onClose={() => setRateFor(null)} />}{receiptFor && <BookingReceiptModal receipt={{ reference: receiptFor.reference_no || receiptFor.id, customer, service: receiptFor.service, staffName: receiptFor.staff_name, raw_date: receiptFor.raw_date, raw_time: receiptFor.raw_time, price: receiptFor.price, status: receiptFor.status, createdAt: receiptFor.created_at }} onClose={() => setReceiptFor(null)} hidePrint={receiptFor.status === 'Pending'} />}{rescheduleFor && <RescheduleDialog appointment={rescheduleFor} onClose={() => setRescheduleFor(null)} onSave={saveReschedule} />}{cancelFor && <CancelDialog appointment={cancelFor} onClose={() => setCancelFor(null)} onSave={saveCancellation} />}</div>;
}
