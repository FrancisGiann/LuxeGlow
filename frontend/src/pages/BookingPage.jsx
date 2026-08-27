import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createAppointment, getAvailableSlots, getServices } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../components/ui/Toast';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { Spinner } from '../components/ui/Spinner';
import { BookingReceiptModal } from '../components/booking/BookingReceiptModal';
import { IconCheckCircle, IconClock, IconStar } from '../components/icons';
import { formatPeso } from '../utils/format';

const manilaISO = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const todayISO = () => manilaISO();

const maxISO = () => {
  const [year, month, day] = manilaISO().split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + 60));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/* ── Section 1: service picker ─────────────────────────────────── */
function ServicePicker({ services, selectedIds, onToggle }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((s) => {
        const checked = selectedIds.includes(s.id);
        return (
          <label
            key={s.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
              checked
                ? 'border-brand-800 bg-brand-50 ring-2 ring-brand-100'
                : 'border-line bg-surface hover:border-brand-200'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(s.id)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#6b21a8]"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink-900">{s.name}</span>
              <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-400">
                <IconClock size={12} /> {s.duration}
                {s.rating > 0 && (
                  <span className="flex items-center gap-0.5 font-semibold text-gold-600">
                    <IconStar size={10} filled /> {Number(s.rating).toFixed(1)}
                  </span>
                )}
              </span>
              <span className="mt-1 block font-display text-base font-bold text-brand-800">
                {formatPeso(s.price)}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ── Section 2: time slots ─────────────────────────────────────── */
function SlotGrid({ slots, loading, selectedTime, onSelect }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-ink-400">
        <Spinner size="sm" tone="brand" /> Checking availability…
      </div>
    );
  }
  if (!slots) {
    return <p className="py-4 text-sm text-ink-400">Pick a date to see open times.</p>;
  }
  const freeCount = slots.filter((s) => s.available).length;
  if (freeCount === 0) {
    return (
      <p className="rounded-xl bg-gold-100/60 px-4 py-3 text-sm font-medium text-gold-600">
        Fully booked on this date — please try another day.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {slots.map((slot) => (
        <button
          key={slot.time}
          type="button"
          disabled={!slot.available}
          onClick={() => onSelect(slot.time)}
          className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
            selectedTime === slot.time
              ? 'border-brand-800 bg-brand-800 text-white shadow-card'
              : slot.available
                ? 'border-line bg-surface text-ink-700 hover:border-brand-300 hover:bg-brand-50'
                : 'cursor-not-allowed border-line bg-canvas text-ink-300 line-through'
          }`}
        >
          {slot.time}
        </button>
      ))}
    </div>
  );
}

/* ── Success panel ─────────────────────────────────────────────── */
function BookingSuccess({ reference, summary, customer, onBookAnother }) {
  const navigate = useNavigate();
  const [receiptOpen, setReceiptOpen] = useState(false);

  return (
    <>
      <Card className="mx-auto max-w-2xl p-8 text-center sm:p-10">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
          <IconCheckCircle size={34} />
        </span>
        <h2 className="mt-5 font-display text-3xl font-bold">Booking Confirmed!</h2>
        <p className="mt-2 text-sm text-ink-500">
          Your request has been received and is currently <strong className="text-warning">Pending</strong> approval.
          We'll notify you once the salon confirms.
        </p>

        <div className="mx-auto mt-7 max-w-sm rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-400">Your booking reference</p>
          <p className="mt-1 font-display text-3xl font-extrabold tracking-wide text-brand-800">{reference}</p>
        </div>

        <dl className="mx-auto mt-7 max-w-sm space-y-2.5 rounded-2xl border border-line px-6 py-5 text-left text-sm">
          {summary.services && (
            <>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">Services</dt>
              <dd className="mb-2 font-medium text-ink-900">{summary.services}</dd>
            </>
          )}
          <div className="flex justify-between"><dt className="text-ink-500">Date</dt><dd className="font-medium">{summary.date}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">Time</dt><dd className="font-medium">{summary.time}</dd></div>
          <div className="flex justify-between border-t border-line pt-2.5"><dt className="font-bold text-ink-900">Service total</dt><dd className="font-display text-lg font-bold text-brand-800">{formatPeso(summary.total)}</dd></div>
        </dl>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={() => navigate('/dashboard/appointments')}>View My Appointments</Button>
          <Button type="button" variant="soft" onClick={() => setReceiptOpen(true)}>View / Print Receipt</Button>
          <Button type="button" variant="ghost" onClick={onBookAnother}>Book Another</Button>
        </div>
        <p className="mt-4 text-xs font-medium text-ink-400">Appointment record only — not proof of payment.</p>
      </Card>

      {receiptOpen && (
        <BookingReceiptModal
          receipt={{
            reference,
            customer,
            services: summary.serviceItems || summary.services,
            appointmentDate: summary.rawDate,
            appointmentTime: summary.rawTime || summary.time,
            dateLabel: summary.date,
            serviceTotal: summary.total,
            status: 'Pending',
            createdAt: summary.createdAt,
          }}
          onClose={() => setReceiptOpen(false)}
        />
      )}
    </>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */
export function BookingPage() {
  const { customer } = useAuth();
  const { customer: dashboardCustomer, refresh: refreshDashboard } = useDashboard();
  const toast = useToast();

  const [services, setServices] = useState(null);
  const [servicesError, setServicesError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(null); // { reference, summary }

  /* Load service menu */
  useEffect(() => {
    let alive = true;
    getServices()
      .then((data) => alive && setServices(Array.isArray(data) ? data : []))
      .catch(() => alive && setServicesError('Could not load the service menu.'));
    return () => { alive = false; };
  }, []);

  const selectedServices = useMemo(
    () => (services || []).filter((s) => selectedIds.includes(s.id)),
    [services, selectedIds]
  );
  const totalMinutes = selectedServices.reduce((sum, s) => sum + (s.minutes || 0), 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);

  const toggleService = (id) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    setFormError('');
  };

  /* Fetch availability whenever date or duration changes */
  useEffect(() => {
    if (!date || totalMinutes === 0) {
      setSlots(null);
      return undefined;
    }
    let alive = true;
    setSlotsLoading(true);
    getAvailableSlots(date, totalMinutes)
      .then((data) => alive && setSlots(Array.isArray(data) ? data : []))
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setSlotsLoading(false));
    return () => { alive = false; };
  }, [date, totalMinutes]);

  /* Drop a selected time that just became unavailable */
  useEffect(() => {
    if (time && slots && !slotsLoading) {
      const stillFree = slots.some((s) => s.time === time && s.available);
      if (!stillFree) setTime('');
    }
  }, [slots, slotsLoading, time]);

  const prettyDate = useMemo(() => {
    if (!date) return '';
    const d = new Date(`${date}T00:00:00+08:00`);
    return d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [date]);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!selectedIds.length) return setFormError('Please select at least one service.');
    if (!date) return setFormError('Please choose your preferred date.');
    if (!time) return setFormError('Please pick an available time slot.');

    setSubmitting(true);
    try {
      const res = await createAppointment({ serviceIds: selectedIds, date, time });
      if (res.success) {
        const createdAt = new Date().toISOString();
        setSuccess({
          reference: res.appointment_id,
          customer: dashboardCustomer || customer,
          summary: {
            services: selectedServices.map((s) => s.name).join(', '),
            serviceItems: selectedServices.map((s) => ({ name: s.name, price: s.price })),
            rawDate: date,
            rawTime: time,
            date: prettyDate,
            time,
            total: totalPrice,
            createdAt,
          },
        });
        refreshDashboard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setFormError(res.error || 'Booking failed. Please try again.');
        if (res.error?.includes('no longer available')) {
          setTime('');
          getAvailableSlots(date, totalMinutes)
            .then((data) => setSlots(Array.isArray(data) ? data : []))
            .catch(() => {});
          toast('That slot was just taken — pick a new time.', 'error');
        }
      }
    } catch (err) {
      setFormError(err.message || 'Error processing booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSuccess(null);
    setSelectedIds([]);
    setDate('');
    setTime('');
    setSlots(null);
    setFormError('');
  };

  if (success) {
    return (
      <div className="mx-auto max-w-6xl">
        <BookingSuccess reference={success.reference} summary={success.summary} customer={success.customer} onBookAnother={resetForm} />
      </div>
    );
  }

  const canSubmit = selectedIds.length > 0 && date && time && !submitting;

  return (
    <form onSubmit={submit} className="mx-auto max-w-6xl" noValidate>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Book an Appointment</h2>
          <p className="mt-1 text-sm text-ink-500">Three quick steps — pick your treatments, choose a time, confirm.</p>
        </div>
        <Link to="/dashboard/appointments" className="text-sm font-semibold text-brand-800 transition-colors hover:text-brand-900">
          My Appointments →
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* ── Form sections ── */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* 1. Services */}
          <Card className="p-6 sm:p-8">
            <CardHeader title="1 · Select Services" subtitle="Choose one or more treatments for your visit." />
            <div className="pt-5">
              {!services && !servicesError && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-canvas" />
                  ))}
                </div>
              )}
              {servicesError && (
                <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{servicesError}</p>
              )}
              {services && <ServicePicker services={services} selectedIds={selectedIds} onToggle={toggleService} />}
            </div>
          </Card>

          {/* 2. Date & time */}
          <Card className="p-6 sm:p-8">
            <CardHeader
              title="2 · Choose Date & Time"
              subtitle={totalMinutes > 0 ? `Duration needed: ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60 ? `${totalMinutes % 60}m` : ''}`.trim() : 'Select services first so we can hold the right amount of time.'}
            />
            <div className="flex flex-col gap-5 pt-5">
              <Input
                id="booking-date"
                type="date"
                label="Preferred date"
                min={todayISO()}
                max={maxISO()}
                value={date}
                onChange={(e) => { setDate(e.target.value); setTime(''); }}
                required
              />
              <div>
                <span className="mb-2 block text-sm font-semibold text-ink-900">Available times</span>
                <SlotGrid
                  slots={slots}
                  loading={slotsLoading}
                  selectedTime={time}
                  onSelect={(t) => { setTime(t); setFormError(''); }}
                />
                {!date && <p className="mt-2 text-xs text-ink-400">Times open daily 10:00 AM – 5:30 PM.</p>}
              </div>
            </div>
          </Card>

          {/* 3. Confirm details */}
          <Card className="p-6 sm:p-8">
            <CardHeader title="3 · Review & Confirm" subtitle="Booking is placed under your account." />
            <dl className="grid gap-x-8 gap-y-2.5 pt-5 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2 flex justify-between gap-4 border-b border-line pb-2.5">
                <dt className="shrink-0 text-ink-500">Name</dt>
                <dd className="truncate font-medium text-ink-900">{customer?.first_name || '—'}</dd>
              </div>
              <div className="sm:col-span-2 flex justify-between gap-4 border-b border-line pb-2.5">
                <dt className="shrink-0 text-ink-500">Email</dt>
                <dd className="truncate font-medium text-ink-900">{customer?.email || '—'}</dd>
              </div>
            </dl>
            {formError && (
              <p className="mt-5 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{formError}</p>
            )}
            <div className="mt-6 hidden lg:block">
              <Button type="submit" size="lg" block disabled={!canSubmit} loading={submitting}>
                {submitting ? 'Placing booking…' : 'Confirm Booking'}
              </Button>
              <p className="mt-3 text-center text-xs text-ink-400">
                No payment yet — you settle at the salon after staff confirmation.
              </p>
            </div>
          </Card>
        </div>

        {/* ── Sticky summary rail ── */}
        <aside className="hidden self-start lg:sticky lg:top-24 lg:block">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-800 to-brand-900 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-widest text-blush-200">Booking Summary</p>
              <p className="mt-1 font-display text-2xl font-bold text-white">{formatPeso(totalPrice)}</p>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5 text-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Services ({selectedIds.length})</p>
                {selectedServices.length === 0 ? (
                  <p className="mt-1 text-ink-400">Nothing selected yet</p>
                ) : (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {selectedServices.map((s) => (
                      <li key={s.id} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate text-ink-700">{s.name}</span>
                        <span className="shrink-0 font-semibold text-ink-900">{formatPeso(s.price)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-between border-t border-line pt-3">
                <span className="text-ink-500">Date</span>
                <span className="font-medium text-ink-900">{prettyDate || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Time</span>
                <span className="font-medium text-ink-900">{time || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Duration</span>
                <span className="font-medium text-ink-900">
                  {totalMinutes ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60 ? `${totalMinutes % 60}m` : ''}`.trim() : '—'}
                </span>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {/* Mobile submit bar */}
      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur-md lg:hidden">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-semibold text-ink-900">
            {selectedIds.length} service{selectedIds.length === 1 ? '' : 's'} · {prettyDate || 'no date'}
          </span>
          <span className="font-display font-bold text-brand-800">{formatPeso(totalPrice)}</span>
        </div>
        <Button type="submit" block size="lg" disabled={!canSubmit} loading={submitting}>
          {submitting ? 'Placing booking…' : 'Confirm Booking'}
        </Button>
        {formError && <p className="mt-2 text-center text-xs font-medium text-danger">{formError}</p>}
      </div>
    </form>
  );
}
