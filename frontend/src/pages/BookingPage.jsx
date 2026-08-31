import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createAppointment, getAvailableSlots, getBookableStaff, getServices } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../components/ui/Toast';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { Spinner } from '../components/ui/Spinner';
import { BookingReceiptModal } from '../components/booking/BookingReceiptModal';
import { IconCalendar, IconCheckCircle } from '../components/icons';
import { ServiceCatalog } from '../components/services/ServiceCatalog';
import { formatPeso } from '../utils/format';

const manilaISO = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const todayISO = () => manilaISO();
const maxISO = () => {
  const [year, month, day] = manilaISO().split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 60));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};
const durationLabel = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours ? `${hours}h` : ''}${rest ? `${hours ? ' ' : ''}${rest}m` : ''}` || '—';
};

function SlotGrid({ slots, loading, error, selectedTime, onSelect, onRetry }) {
  if (loading) return <div className="flex items-center gap-2 py-6 text-sm text-ink-500"><Spinner size="sm" tone="brand" />Checking availability…</div>;
  if (error) return <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert"><p className="font-semibold">{error}</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-danger/40 px-3 py-2 text-xs font-bold text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">Try again</button></div>;
  if (!slots) return <p className="py-4 text-sm text-ink-500">Choose a date to see open times.</p>;
  if (!slots.length) return <p className="rounded-xl border border-gold-600 bg-gold-100 px-4 py-3 text-sm font-semibold text-ink-900" role="status">No appointment times are available for this date and service duration.</p>;
  const freeCount = slots.filter((slot) => slot.available).length;
  return <div><div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">{slots.map((slot) => { const label = slot.available ? 'Available' : 'Booked or unavailable'; return <button key={slot.time} type="button" disabled={!slot.available} aria-label={`${slot.time}: ${label}`} title={label} onClick={() => onSelect(slot.time)} className={`min-h-11 rounded-lg border px-2 text-xs font-bold transition-colors sm:text-sm ${selectedTime === slot.time ? 'border-brand-800 bg-brand-800 text-white' : slot.available ? 'border-line bg-surface text-ink-700 hover:border-brand-400 hover:bg-brand-50' : 'cursor-not-allowed border-line bg-canvas text-ink-300 line-through'}`}><span>{slot.time}</span><span className="sr-only"> — {label}</span></button>; })}</div>{!freeCount && <p className="mt-3 rounded-xl border border-gold-600 bg-gold-100 px-4 py-3 text-sm font-semibold text-ink-900" role="status">All listed times are booked or unavailable for this team member. Please choose another day.</p>}</div>;
}

function StaffPicker({ staff, loading, error, selectedId, onSelect }) {
  if (loading) return <div className="flex items-center gap-2 py-4 text-sm text-ink-500"><Spinner size="sm" tone="brand" />Loading team members…</div>;
  if (error) return <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</p>;
  if (!staff?.length) return <p className="rounded-xl border border-gold-600 bg-gold-100 px-4 py-3 text-sm font-semibold text-ink-900">No team members are accepting appointments right now. Please check again later.</p>;
  return <div role="radiogroup" aria-label="Bookable team members" className="grid gap-2 sm:grid-cols-2">{staff.map((member) => <button key={member.id} type="button" role="radio" aria-checked={selectedId === member.id} onClick={() => onSelect(member.id)} className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 ${selectedId === member.id ? 'border-brand-800 bg-brand-50 text-brand-800' : 'border-line bg-surface text-ink-700 hover:border-brand-400 hover:bg-brand-50'}`}><span className="block">{member.name}</span><span className="mt-0.5 block text-xs font-normal text-ink-500">{selectedId === member.id ? 'Selected team member' : 'Select this team member'}</span></button>)}</div>;
}

function Summary({ selectedServices, totalPrice, totalMinutes, prettyDate, time, staffName, compact = false }) {
  return <aside className={`${compact ? '' : 'lg:sticky lg:top-24'} self-start`}><Card className="overflow-hidden"><div className="border-b border-line bg-brand-800 px-5 py-5 text-white sm:px-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-blush-200">Your appointment</p><p className="mt-2 font-display text-3xl font-medium">{formatPeso(totalPrice)}</p></div><div className="px-5 py-5 sm:px-6"><div className="flex items-center justify-between gap-3"><h3 className="font-display text-lg font-medium text-ink-900">Services</h3><span className="text-xs font-bold text-ink-500">{selectedServices.length}/8</span></div>{selectedServices.length ? <ul className="mt-4 divide-y divide-line">{selectedServices.map((service) => <li key={service.id} className="flex items-start justify-between gap-3 py-3 first:pt-0"><span className="min-w-0 text-sm font-semibold text-ink-700">{service.name}<span className="mt-1 block text-xs font-normal text-ink-500">{service.duration}</span></span><span className="shrink-0 text-sm font-bold text-ink-900">{formatPeso(service.price)}</span></li>)}</ul> : <p className="mt-3 text-sm text-ink-500">Select a treatment to begin.</p>}<dl className="mt-4 border-t border-line pt-4 text-sm"><div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-500">Team member</dt><dd className="text-right font-semibold text-ink-900">{staffName || '—'}</dd></div><div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-500">Date</dt><dd className="text-right font-semibold text-ink-900">{prettyDate || '—'}</dd></div><div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-500">Time</dt><dd className="font-semibold text-ink-900">{time || '—'}</dd></div><div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-500">Duration</dt><dd className="font-semibold text-ink-900">{totalMinutes ? durationLabel(totalMinutes) : '—'}</dd></div></dl></div></Card></aside>;
}

function BookingSuccess({ reference, summary, customer, onBookAnother }) {
  const navigate = useNavigate();
  const [receiptOpen, setReceiptOpen] = useState(false);
  return <><Card className="mx-auto max-w-2xl p-7 text-center sm:p-10"><span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><IconCheckCircle size={34} /></span><h2 className="mt-6 font-display text-3xl font-medium text-ink-900">Your request is in.</h2><p className="mx-auto mt-3 max-w-[46ch] text-sm leading-relaxed text-ink-600">Your appointment is currently <strong className="text-gold-600">Pending</strong>. We will notify you once Astrid Nails &amp; Beauty Bar confirms it.</p><div className="mx-auto mt-8 max-w-sm border-y border-brand-300 py-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-500">Booking reference</p><p className="mt-2 font-display text-3xl font-semibold tracking-wide text-brand-800">{reference}</p></div><dl className="mx-auto mt-7 max-w-sm text-left text-sm"><div className="flex justify-between gap-3 border-b border-line py-3"><dt className="text-ink-500">Team member</dt><dd className="max-w-[65%] text-right font-semibold text-ink-900">{summary.staffName}</dd></div><div className="flex justify-between gap-3 border-b border-line py-3"><dt className="text-ink-500">Services</dt><dd className="max-w-[65%] text-right font-semibold text-ink-900">{summary.services}</dd></div><div className="flex justify-between border-b border-line py-3"><dt className="text-ink-500">Date</dt><dd className="font-semibold text-ink-900">{summary.date}</dd></div><div className="flex justify-between border-b border-line py-3"><dt className="text-ink-500">Time</dt><dd className="font-semibold text-ink-900">{summary.time}</dd></div><div className="flex justify-between py-3"><dt className="font-bold text-ink-900">Service total</dt><dd className="font-display text-lg font-semibold text-brand-800">{formatPeso(summary.total)}</dd></div></dl><div className="mt-8 flex flex-wrap justify-center gap-3"><Button type="button" onClick={() => navigate('/dashboard/appointments')}>View appointments</Button><Button type="button" variant="soft" onClick={() => setReceiptOpen(true)}>View / print receipt</Button><Button type="button" variant="ghost" onClick={onBookAnother}>Book another</Button></div><p className="mt-5 text-xs text-ink-500">Appointment record only — not proof of payment.</p></Card>{receiptOpen && <BookingReceiptModal receipt={{ reference, customer, staffName: summary.staffName, services: summary.serviceItems, appointmentDate: summary.rawDate, appointmentTime: summary.rawTime, dateLabel: summary.date, serviceTotal: summary.total, status: 'Pending', createdAt: summary.createdAt }} onClose={() => setReceiptOpen(false)} />}</>;
}

export function BookingPage() {
  const { customer } = useAuth();
  const { customer: dashboardCustomer, refresh: refreshDashboard } = useDashboard();
  const toast = useToast();
  const [services, setServices] = useState(null);
  const [servicesError, setServicesError] = useState('');
  const [staff, setStaff] = useState(null);
  const [staffError, setStaffError] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const availabilityRequestRef = useRef(0);
  const availabilitySelectionVersionRef = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => { let alive = true; getServices().then((data) => alive && setServices(Array.isArray(data) ? data : [])).catch(() => alive && setServicesError('Could not load the treatment menu.')); getBookableStaff().then((data) => alive && setStaff(Array.isArray(data) ? data : [])).catch(() => alive && setStaffError('Could not load available team members.')); return () => { alive = false; }; }, []);
  const selectedServices = useMemo(() => (services || []).filter((service) => selectedIds.includes(service.id)), [services, selectedIds]);
  const selectedStaff = useMemo(() => (staff || []).find((member) => member.id === selectedStaffId), [staff, selectedStaffId]);
  const totalMinutes = selectedServices.reduce((sum, service) => sum + (service.minutes || 0), 0);
  const totalPrice = selectedServices.reduce((sum, service) => sum + (service.price || 0), 0);
  const prettyDate = useMemo(() => date ? new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '', [date]);

  const invalidateAvailability = () => {
    availabilityRequestRef.current += 1;
    availabilitySelectionVersionRef.current += 1;
    setSlots(null);
    setSlotsError('');
    setSlotsLoading(false);
  };
  const loadAvailability = (staffId, dateValue, durationMinutes, expectedSelectionVersion = availabilitySelectionVersionRef.current) => {
    if (expectedSelectionVersion !== availabilitySelectionVersionRef.current) return Promise.resolve();
    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;
    setSlotsLoading(true);
    setSlotsError('');
    return getAvailableSlots(dateValue, durationMinutes, staffId)
      .then((data) => {
        if (requestId === availabilityRequestRef.current && expectedSelectionVersion === availabilitySelectionVersionRef.current) setSlots(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (requestId === availabilityRequestRef.current && expectedSelectionVersion === availabilitySelectionVersionRef.current) {
          setSlots(null);
          setSlotsError(error.message || 'Could not load availability. Please try again.');
        }
      })
      .finally(() => {
        if (requestId === availabilityRequestRef.current && expectedSelectionVersion === availabilitySelectionVersionRef.current) setSlotsLoading(false);
      });
  };
  const toggleService = (id) => {
    setSelectedIds((current) => { if (current.includes(id)) return current.filter((value) => value !== id); if (current.length >= 8) { setFormError('Choose up to 8 services per appointment.'); return current; } return [...current, id]; });
    setFormError(''); setTime(''); invalidateAvailability();
  };
  useEffect(() => {
    if (!selectedStaffId || !date || !totalMinutes) { availabilityRequestRef.current += 1; return undefined; }
    loadAvailability(selectedStaffId, date, totalMinutes, availabilitySelectionVersionRef.current);
    return undefined;
  }, [date, totalMinutes, selectedStaffId, selectedIds]);
  useEffect(() => { if (time && slots && !slotsLoading && !slots.some((slot) => slot.time === time && slot.available)) setTime(''); }, [slots, slotsLoading, time]);

  const submit = async (event) => {
    event.preventDefault(); setFormError('');
    if (!selectedStaffId) return setFormError('Choose a team member.');
    if (!selectedIds.length) return setFormError('Select at least one service.');
    if (selectedIds.length > 8) return setFormError('Choose up to 8 services per appointment.');
    if (!date) return setFormError('Choose your preferred date.');
    if (!time) return setFormError('Pick an available time slot.');
    const selectionVersion = availabilitySelectionVersionRef.current;
    setSubmitting(true);
    try {
      const result = await createAppointment({ serviceIds: selectedIds, staffId: selectedStaffId, date, time });
      if (result.success) { const createdAt = new Date().toISOString(); setSuccess({ reference: result.appointment_id, customer: dashboardCustomer || customer, summary: { staffName: selectedStaff?.name || 'Unassigned', services: selectedServices.map((service) => service.name).join(', '), serviceItems: selectedServices.map((service) => ({ name: service.name, price: service.price })), rawDate: date, rawTime: time, date: prettyDate, time, total: totalPrice, createdAt } }); refreshDashboard(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else { setFormError(result.error || 'Booking failed. Please try again.'); if (/no longer available/i.test(result.error || '')) { setTime(''); toast('That slot was just taken. Pick a new time.', 'error'); loadAvailability(selectedStaffId, date, totalMinutes, selectionVersion); } }
    } catch (error) { setFormError(error.message || 'Could not place the booking.'); } finally { setSubmitting(false); }
  };
  const resetForm = () => { setSuccess(null); setSelectedIds([]); setSelectedStaffId(''); setDate(''); setTime(''); invalidateAvailability(); setFormError(''); };
  if (success) return <div className="mx-auto max-w-6xl"><BookingSuccess reference={success.reference} summary={success.summary} customer={success.customer} onBookAnother={resetForm} /></div>;
  const canSubmit = selectedIds.length > 0 && selectedStaffId && date && time && !submitting;
  return <form onSubmit={submit} className="mx-auto max-w-[1240px]" noValidate>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div><h2 className="font-display text-3xl font-medium text-ink-900">Book an appointment</h2><p className="mt-2 text-sm text-ink-500">Choose your treatments, team member, and an available time.</p></div>
      <Link to="/dashboard/appointments" className="text-sm font-bold text-brand-800 hover:text-brand-900">View my appointments</Link>
    </div>
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Card className="p-5 sm:p-7"><CardHeader title="Select services" subtitle="Choose one to eight treatments for this visit." /><div className="pt-5"><ServiceCatalog services={services} loading={!services && !servicesError} error={servicesError} onToggle={toggleService} selectable selectedIds={selectedIds} selectionLimit={8} /></div></Card>
        <Card className="p-5 sm:p-7"><CardHeader title="Choose your team member" subtitle="Your selected member’s schedule will determine the available times." /><div className="pt-5"><StaffPicker staff={staff} loading={!staff && !staffError} error={staffError} selectedId={selectedStaffId} onSelect={(id) => { setSelectedStaffId(id); setTime(''); invalidateAvailability(); setFormError(''); }} /></div></Card>
        <Card className="p-5 sm:p-7">
          <CardHeader title="Choose date and time" subtitle={selectedStaff ? `${selectedStaff.name} · ${totalMinutes ? `${durationLabel(totalMinutes)} needed for your selected services.` : 'Select services first so we can check the right amount of time.'}` : 'Select a team member and services first so we can check availability.'} />
          <div className="flex flex-col gap-6 pt-5">
            <Input id="booking-date" type="date" label="Preferred date" min={todayISO()} max={maxISO()} value={date} onChange={(event) => { setDate(event.target.value); setTime(''); invalidateAvailability(); }} required />
            <div><span className="mb-2 block text-sm font-bold text-ink-900">Available times{selectedStaff ? ` for ${selectedStaff.name}` : ''}</span><SlotGrid slots={slots} loading={slotsLoading} error={slotsError} selectedTime={time} onSelect={(value) => { setTime(value); setFormError(''); }} onRetry={() => loadAvailability(selectedStaffId, date, totalMinutes, availabilitySelectionVersionRef.current)} />{!date && <p className="mt-2 text-xs text-ink-500">Times are offered in 30-minute increments.</p>}</div>
          </div>
        </Card>
        <Card className="p-5 sm:p-7"><CardHeader title="Review and confirm" subtitle="Your request will be placed under your account." /><dl className="grid gap-3 pt-5 text-sm sm:grid-cols-2"><div className="flex justify-between gap-4 border-b border-line pb-3 sm:col-span-2"><dt className="text-ink-500">Name</dt><dd className="truncate font-semibold text-ink-900">{customer?.full_name || customer?.first_name || '—'}</dd></div><div className="flex justify-between gap-4 border-b border-line pb-3 sm:col-span-2"><dt className="text-ink-500">Email</dt><dd className="truncate font-semibold text-ink-900">{customer?.email || '—'}</dd></div><div className="flex justify-between gap-4 pb-1 sm:col-span-2"><dt className="text-ink-500">Team member</dt><dd className="font-semibold text-ink-900">{selectedStaff?.name || '—'}</dd></div></dl>{formError && <p className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger" role="alert">{formError}</p>}<div className="mt-6 hidden lg:block"><Button type="submit" size="lg" block disabled={!canSubmit} loading={submitting}>{submitting ? 'Placing booking…' : 'Confirm booking'}</Button><p className="mt-3 flex items-center justify-center gap-2 text-xs text-ink-500"><IconCalendar size={13} />Payment is settled at the salon after staff confirmation.</p></div></Card>
      </div>
      <div className="hidden lg:block"><Summary selectedServices={selectedServices} totalPrice={totalPrice} totalMinutes={totalMinutes} prettyDate={prettyDate} time={time} staffName={selectedStaff?.name} /></div>
    </div>
    <div className="mt-6 lg:hidden"><Summary compact selectedServices={selectedServices} totalPrice={totalPrice} totalMinutes={totalMinutes} prettyDate={prettyDate} time={time} staffName={selectedStaff?.name} /></div>
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur-sm lg:hidden"><div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-ink-900">{selectedIds.length} service{selectedIds.length === 1 ? '' : 's'}</span><span className="font-display font-semibold text-brand-800">{formatPeso(totalPrice)}</span></div><Button type="submit" block size="lg" disabled={!canSubmit} loading={submitting}>{submitting ? 'Placing booking…' : 'Confirm booking'}</Button>{formError && <p className="mt-2 text-center text-xs font-semibold text-danger">{formError}</p>}</div>
  </form>;
}
