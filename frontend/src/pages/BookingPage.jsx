import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createAppointment, getAvailableSlots, getBookableStaff, getSalonDateStatus, getServices } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../components/ui/Toast';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { Spinner } from '../components/ui/Spinner';
import { StaffPicker } from '../components/booking/StaffPicker';
import { loadStaffAvailability, staffAvailabilityKey, staffChoiceState } from '../utils/staffAvailability';
import { IconCalendar } from '../components/icons';
import { ServiceCatalog } from '../components/services/ServiceCatalog';
import { formatPeso } from '../utils/format';
import { canSelectBookingService, normalizeBookingServiceIds, selectedPackageForBooking } from '../utils/bookingSelection';

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
const BOOKING_DRAFT_KEY = 'luxeglow-booking-draft-v1';
const readDraft = () => {
  try {
    const raw = window.sessionStorage.getItem(BOOKING_DRAFT_KEY);
    const draft = raw ? JSON.parse(raw) : null;
    return draft && typeof draft === 'object' ? draft : {};
  } catch {
    return {};
  }
};
const writeDraft = (draft) => {
  try { window.sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(draft)); } catch { /* Storage may be blocked. */ }
};

function SlotGrid({ slots, loading, error, selectedTime, onSelect, onRetry }) {
  if (loading) return <div className="flex items-center gap-2 py-6 text-sm text-ink-500"><Spinner size="sm" tone="brand" />Checking availability…</div>;
  if (error) return <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert"><p className="font-semibold">{error}</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-danger/40 px-3 py-2 text-xs font-bold text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">Try again</button></div>;
  if (!slots) return <p className="py-4 text-sm text-ink-500">Choose a date to see open times.</p>;
  if (!slots.length) return <p className="rounded-xl border border-gold-600 bg-gold-100 px-4 py-3 text-sm font-semibold text-ink-900" role="status">No appointment times are available for this date and service duration.</p>;
  const freeCount = slots.filter((slot) => slot.available).length;
  return <div><div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">{slots.map((slot) => { const label = slot.available ? 'Available' : 'Booked or unavailable'; return <button key={slot.time} type="button" disabled={!slot.available} aria-label={`${slot.time}: ${label}`} title={label} onClick={() => onSelect(slot.time)} className={`min-h-11 rounded-lg border px-2 text-xs font-bold transition-colors sm:text-sm ${selectedTime === slot.time ? 'border-brand-800 bg-brand-800 text-white' : slot.available ? 'border-line bg-surface text-ink-700 hover:border-brand-400 hover:bg-brand-50' : 'cursor-not-allowed border-line bg-canvas text-ink-300 line-through'}`}><span>{slot.time}</span><span className="sr-only"> — {label}</span></button>; })}</div>{!freeCount && <p className="mt-3 rounded-xl border border-gold-600 bg-gold-100 px-4 py-3 text-sm font-semibold text-ink-900" role="status">All listed times are booked or unavailable. Please choose another day.</p>}</div>;
}


function Summary({ selectedServices, totalPrice, totalMinutes, prettyDate, time, staffName, compact = false }) {
  return <aside className={`${compact ? '' : 'lg:sticky lg:top-24'} self-start`}><Card className="overflow-hidden"><div className="border-b border-line bg-brand-800 px-5 py-5 text-white sm:px-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-blush-200">Your appointment</p><p className="mt-2 font-display text-3xl font-medium">{formatPeso(totalPrice)}</p></div><div className="px-5 py-5 sm:px-6"><div className="flex items-center justify-between gap-3"><h3 className="font-display text-lg font-medium text-ink-900">Services</h3><span className="text-xs font-bold text-ink-500">{selectedServices.length} selected</span></div>{selectedServices.length ? <ul className="mt-4 divide-y divide-line">{selectedServices.map((service) => <li key={service.id} className="flex items-start justify-between gap-3 py-3 first:pt-0"><span className="min-w-0 text-sm font-semibold text-ink-700">{service.name}<span className="mt-1 block text-xs font-normal text-ink-500">{service.duration}</span></span><span className="shrink-0 text-sm font-bold text-ink-900">{formatPeso(service.price)}</span></li>)}</ul> : <p className="mt-3 text-sm text-ink-500">Select a treatment to begin.</p>}<dl className="mt-4 border-t border-line pt-4 text-sm"><div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-500">Team member</dt><dd className="text-right font-semibold text-ink-900">{staffName || 'No preference'}</dd></div><div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-500">Date</dt><dd className="text-right font-semibold text-ink-900">{prettyDate || '—'}</dd></div><div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-500">Time</dt><dd className="font-semibold text-ink-900">{time || '—'}</dd></div><div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-500">Duration</dt><dd className="font-semibold text-ink-900">{totalMinutes ? durationLabel(totalMinutes) : '—'}</dd></div></dl></div></Card></aside>;
}

export function BookingPage() {
  const { customer, isAuthenticated, status, openAuth } = useAuth();
  const { refresh: refreshDashboard } = useDashboard();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [services, setServices] = useState(null);
  const [servicesError, setServicesError] = useState('');
  const [staff, setStaff] = useState(null);
  const [staffError, setStaffError] = useState('');
  const [staffAvailability, setStaffAvailability] = useState({ status: 'idle' });
  const [staffAvailabilityRetry, setStaffAvailabilityRetry] = useState(0);
  const [staffNotice, setStaffNotice] = useState('');
  const [initialDraft] = useState(readDraft);
  const [selectedStaffId, setSelectedStaffId] = useState(() => String(initialDraft.staffId || ''));
  const [selectedIds, setSelectedIds] = useState(() => Array.isArray(initialDraft.serviceIds) ? [...new Set(initialDraft.serviceIds.map(String))] : []);
  const [date, setDate] = useState(() => { const draftDate = String(initialDraft.date || ''); return /^\d{4}-\d{2}-\d{2}$/.test(draftDate) && draftDate >= todayISO() && draftDate <= maxISO() ? draftDate : ''; });
  const [time, setTime] = useState(() => String(initialDraft.time || ''));
  const [slots, setSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [dateStatus, setDateStatus] = useState(null);
  const [dateStatusLoading, setDateStatusLoading] = useState(false);
  const [dateStatusError, setDateStatusError] = useState('');
  const [dateStatusRetryKey, setDateStatusRetryKey] = useState(0);
  const [availabilityReloadKey, setAvailabilityReloadKey] = useState(0);
  const availabilityRequestRef = useRef(0);
  const availabilitySelectionVersionRef = useRef(0);
  const dateStatusRequestRef = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [reviewStep, setReviewStep] = useState(false);
  const [editingReview, setEditingReview] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const dateInputRef = useRef(null);
  const selectedIdsForServices = useMemo(() => services ? normalizeBookingServiceIds(selectedIds, services) : [], [services, selectedIds]);
  const selectedPackage = useMemo(() => selectedPackageForBooking(selectedIdsForServices, services || []), [services, selectedIdsForServices]);
  const selectedServices = useMemo(() => (services || []).filter((service) => selectedIdsForServices.includes(service.id)), [services, selectedIdsForServices]);

  useEffect(() => { let alive = true; getServices().then((data) => alive && setServices(Array.isArray(data) ? data : [])).catch(() => alive && setServicesError('Could not load the treatment menu.')); getBookableStaff().then((data) => alive && setStaff(Array.isArray(data) ? data : [])).catch(() => alive && setStaffError('Could not load available team members.')); return () => { alive = false; }; }, []);
  useEffect(() => {
    if (!services) return;
    setSelectedIds((current) => normalizeBookingServiceIds(current, services));
  }, [services]);
  useEffect(() => {
    if (!staff) return;
    setSelectedStaffId((current) => {
      if (current && !staff.some((member) => member.id === current)) {
        setStaffNotice('Your team preference is no longer accepting bookings. No preference is selected.');
        return '';
      }
      return current;
    });
  }, [staff]);
  useEffect(() => {
    const requestId = ++dateStatusRequestRef.current;
    if (!date) {
      setDateStatus(null);
      setDateStatusError('');
      setDateStatusLoading(false);
      return () => { if (dateStatusRequestRef.current === requestId) dateStatusRequestRef.current += 1; };
    }
    setDateStatus(null);
    setDateStatusError('');
    setDateStatusLoading(true);
    getSalonDateStatus(date)
      .then((result) => {
        if (dateStatusRequestRef.current !== requestId) return;
        setDateStatus(result);
        setDateStatusLoading(false);
        if (result.isClosed) {
          setTime('');
          setSlots(null);
          setSlotsLoading(false);
          setSlotsError('');
        }
      })
      .catch((error) => {
        if (dateStatusRequestRef.current !== requestId) return;
        setDateStatusError(error.message || 'Could not confirm whether the salon is open on this date.');
        setDateStatusLoading(false);
      });
    return () => { if (dateStatusRequestRef.current === requestId) dateStatusRequestRef.current += 1; };
  }, [date, dateStatusRetryKey]);
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('service');
    if (!requested || !services?.some((service) => service.id === requested)) return;
    setSelectedIds((current) => {
      const normalized = normalizeBookingServiceIds(current, services);
      if (normalized.includes(requested) || !canSelectBookingService(requested, normalized, services)) return normalized;
      return normalizeBookingServiceIds([...normalized, requested], services);
    });
  }, [location.search, services]);
  useEffect(() => {
    if (status === 'loading' || !services) return;
    const continueToReview = reviewStep || (isAuthenticated && readDraft().reviewStep === true);
    if (continueToReview !== reviewStep) setReviewStep(continueToReview);
    writeDraft({ serviceIds: selectedIdsForServices, staffId: selectedStaffId || null, date, time, reviewStep: continueToReview });
  }, [date, isAuthenticated, reviewStep, selectedIdsForServices, selectedStaffId, services, status, time]);
  const selectedStaff = useMemo(() => (staff || []).find((member) => member.id === selectedStaffId), [staff, selectedStaffId]);
  const totalMinutes = selectedServices.reduce((sum, service) => sum + (service.minutes || 0), 0);
  const totalPrice = selectedServices.reduce((sum, service) => sum + (service.price || 0), 0);
  const hasDateStatus = dateStatus?.date === date;
  const selectedDateClosed = hasDateStatus && dateStatus.isClosed;
  const dateStatusPending = Boolean(date) && !hasDateStatus && !dateStatusError;
  const hasAvailableSelectedTime = Boolean(time && slots?.some((slot) => slot.time === time && slot.available));
  const prettyDate = useMemo(() => date ? new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '', [date]);

  const invalidateAvailability = () => {
    availabilityRequestRef.current += 1;
    availabilitySelectionVersionRef.current += 1;
    setAvailabilityReloadKey((current) => current + 1);
    setSlots(null);
    setSlotsError('');
    setSlotsLoading(false);
  };
  const staffCheckKey = staffAvailabilityKey(date, time, totalMinutes || 30, selectedIdsForServices);
  const currentStaffAvailability = useMemo(() => staffAvailability.key === staffCheckKey
    ? staffAvailability : { status: 'loading' }, [staffAvailability, staffCheckKey]);
  useEffect(() => {
    let alive = true;
    if (!date || !time || !staff || !hasDateStatus || selectedDateClosed || dateStatusError) return;
    setStaffAvailability({ key: staffCheckKey, status: 'loading' });
    loadStaffAvailability(staff, date, time, totalMinutes || 30, getAvailableSlots)
      .then((available) => { if (alive) setStaffAvailability({ key: staffCheckKey, status: 'ready', available }); })
      .catch(() => { if (alive) setStaffAvailability({ key: staffCheckKey, status: 'error' }); });
    return () => { alive = false; };
  }, [staffCheckKey, staff, date, time, totalMinutes, hasDateStatus, selectedDateClosed, dateStatusError, staffAvailabilityRetry]);
  useEffect(() => {
    if (!time || !selectedStaffId || currentStaffAvailability.status !== 'ready') return;
    if (staffChoiceState(selectedStaffId, currentStaffAvailability, true).disabled) {
      setSelectedStaffId('');
      setStaffNotice('Your selected team member is not available at this time. No preference is selected; choose another available team member if you wish.');
      setReviewStep(false);
      writeDraft({ serviceIds: selectedIdsForServices, staffId: null, date, time, reviewStep: false });
      invalidateAvailability();
    }
  }, [time, selectedStaffId, currentStaffAvailability, date, selectedIdsForServices]);

  const loadAvailability = (staffId, dateValue, durationMinutes, expectedSelectionVersion = availabilitySelectionVersionRef.current) => {
    if (expectedSelectionVersion !== availabilitySelectionVersionRef.current) return Promise.resolve();
    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;
    setSlots(null);
    setSlotsLoading(true);
    setSlotsError('');
    return getAvailableSlots(dateValue, durationMinutes, null)
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
    const current = selectedIdsForServices;
    if (current.includes(id)) {
      setSelectedIds(current.filter((value) => value !== id));
    } else if (canSelectBookingService(id, current, services || [])) {
      setSelectedIds(normalizeBookingServiceIds([...current, id], services || []));
    } else {
      setFormError('Only one package can be selected per booking. Remove the selected package before choosing another.');
      return;
    }
    setFormError(''); invalidateAvailability();
  };
  const selectDate = (value) => { setDate(value); setTime(''); invalidateAvailability(); };
  const selectStaff = (id) => { if (id && staffChoiceState(id, currentStaffAvailability, Boolean(time)).disabled) return; setStaffNotice(''); setFieldErrors((current) => ({ ...current, staff: '' })); setSelectedStaffId(id); invalidateAvailability(); setFormError(''); };
  useEffect(() => {
    if (!date || !hasDateStatus || selectedDateClosed || dateStatusError) {
      availabilityRequestRef.current += 1;
      setSlots(null);
      setSlotsLoading(false);
      return undefined;
    }
    loadAvailability(selectedStaffId, date, totalMinutes || 30, availabilitySelectionVersionRef.current);
    return undefined;
  }, [date, dateStatus?.date, dateStatus?.isClosed, dateStatusError, hasDateStatus, selectedDateClosed, totalMinutes, selectedStaffId, selectedIdsForServices, availabilityReloadKey]);
  useEffect(() => {
    if (slotsLoading || !time || !slots || slots.some((slot) => slot.time === time && slot.available)) return;
    setTime('');
    toast("That time doesn't fit your updated choices. Choose another available time.", 'info');
  }, [slots, slotsLoading, time, toast]);

  const validateBooking = () => {
    const errors = {};
    if (!services) errors.services = 'The service menu is still loading. Please wait and try again.';
    else if (!selectedIdsForServices.length) errors.services = 'Select at least one service.';
    else if (selectedPackage && selectedIds.filter((id) => services.find((service) => service.id === id)?.item_type === 'package').length > 1) errors.services = 'Only one package can be included in a booking. Remove the extra package before continuing.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayISO() || date > maxISO()) errors.date = 'Choose a date within the next 60 days.';
    else if (selectedDateClosed) errors.date = 'The salon is closed on this date. Choose another date.';
    else if (dateStatusPending || dateStatusLoading) errors.date = 'Wait while we check whether the salon is open on this date.';
    else if (dateStatusError) errors.date = 'Could not verify this date. Retry the date check before continuing.';
    if (!time) errors.time = 'Pick an available time slot.';
    else if (slotsLoading) errors.time = 'Availability is still loading. Wait, then try again.';
    else if (!hasAvailableSelectedTime) errors.time = 'Choose an open time from the current availability list.';
    if (staffError || !staff) errors.staff = 'Wait for the team list to load successfully before continuing.';
    else if (selectedStaffId && staffChoiceState(selectedStaffId, currentStaffAvailability, Boolean(time)).disabled) errors.staff = 'Choose an available team member or No preference after the availability check.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      const first = errors.services ? 'booking-services-heading' : errors.date ? 'booking-date' : errors.staff ? 'booking-staff-heading' : 'booking-times-heading';
      requestAnimationFrame(() => document.getElementById(first)?.focus());
      return false;
    }
    return true;
  };
  const submit = (event) => {
    event.preventDefault();
    setFormError('');
    if (!validateBooking()) return;
    if (!isAuthenticated || status !== 'authenticated') {
      writeDraft({ serviceIds: selectedIdsForServices, staffId: selectedStaffId || null, date, time, reviewStep: true });
      try { window.sessionStorage.setItem('luxeglow-auth-return', '/book'); } catch { /* Storage may be blocked. */ }
      openAuth('login');
      toast('Sign in to review your booking. Your choices are saved.', 'info');
      return;
    }
    if (editingReview) {
      writeDraft({ serviceIds: selectedIdsForServices, staffId: selectedStaffId || null, date, time, reviewStep: true });
      setEditingReview(false);
      setReviewStep(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setReviewStep(true);
    writeDraft({ serviceIds: selectedIdsForServices, staffId: selectedStaffId || null, date, time, reviewStep: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const confirmBooking = async () => {
    setFormError('');
    if (!isAuthenticated || status !== 'authenticated') {
      setReviewStep(false);
      openAuth('login');
      return;
    }
    if (!validateBooking()) { setReviewStep(false); return; }
    const selectionVersion = availabilitySelectionVersionRef.current;
    setSubmitting(true);
    try {
      const latestDateStatus = await getSalonDateStatus(date);
      if (latestDateStatus.isClosed) {
        setDateStatus(latestDateStatus);
        setTime('');
        setReviewStep(false);
        setFormError('The salon is now closed on this date. Choose another date before booking.');
        return;
      }
      const latestSlots = await getAvailableSlots(date, totalMinutes || 30, selectedStaffId);
      if (selectionVersion !== availabilitySelectionVersionRef.current) {
        setFormError('Your choices changed. Review them again before confirming.');
        setReviewStep(false);
        return;
      }
      if (!latestSlots.some((slot) => slot.time === time && slot.available)) {
        setFieldErrors((current) => ({ ...current, time: 'That time is no longer available. Choose another open time.' }));
        setFormError('That time is no longer available. Edit your choices and select another time.');
        setReviewStep(false);
        if (selectedStaffId) {
          setSelectedStaffId('');
          setStaffNotice('Your selected team member is not available at this time. No preference is selected.');
        }
        writeDraft({ serviceIds: selectedIdsForServices, staffId: null, date, time, reviewStep: false });
        setStaffAvailability({ status: 'loading' });
        setStaffAvailabilityRetry((value) => value + 1);
        invalidateAvailability();
        toast('That slot was just taken. Pick a new time.', 'error');
        return;
      }
      setSlots(latestSlots);
      const result = await createAppointment({ serviceIds: selectedIdsForServices, staffId: selectedStaffId, date, time });
      if (result.success) {
        try { window.sessionStorage.removeItem(BOOKING_DRAFT_KEY); window.sessionStorage.removeItem('luxeglow-auth-return'); } catch { /* Storage may be blocked. */ }
        toast(`Booking request sent. Reference ${result.appointment_id || result.appointment_uuid}.`, 'success');
        void refreshDashboard();
        navigate('/dashboard/overview', { replace: true });
      } else {
        setFormError(result.error || 'Booking failed. Please try again.');
        if (/no longer available|available team member/i.test(result.error || '')) {
          setStaffAvailability({ status: 'loading' });
          setStaffAvailabilityRetry((value) => value + 1);
          setReviewStep(false);
          if (selectedStaffId) {
            setSelectedStaffId('');
            setStaffNotice('Your selected team member is not available at this time. No preference is selected.');
          }
          writeDraft({ serviceIds: selectedIdsForServices, staffId: null, date, time, reviewStep: false });
          getBookableStaff().then(setStaff).catch(() => setStaffError('Could not refresh available team members. Reload this page to try again.'));
          setFieldErrors((current) => ({ ...current, time: 'That time is no longer available. Choose another open time.' }));
          loadAvailability(selectedStaffId, date, totalMinutes || 30, selectionVersion);
        }
      }
    } catch (error) {
      if (/available team member/i.test(error.message || '')) {
        setSelectedStaffId('');
        setStaffNotice('Your team preference is no longer accepting bookings. No preference is selected.');
        setReviewStep(false);
        writeDraft({ serviceIds: selectedIdsForServices, staffId: null, date, time, reviewStep: false });
        getBookableStaff().then(setStaff).catch(() => setStaffError('Could not refresh available team members. Reload this page to try again.'));
      }
      setFormError(error.message || 'Could not place the booking.');
    } finally {
      setSubmitting(false);
    }
  };
  const editBooking = () => { setEditingReview(true); setReviewStep(false); writeDraft({ serviceIds: selectedIdsForServices, staffId: selectedStaffId || null, date, time, reviewStep: false }); setFormError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  if (reviewStep) return <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12"><Card className="p-5 sm:p-8"><CardHeader title="Review your booking" subtitle="Confirm these details before sending your request to the salon." /><dl className="mt-6 divide-y divide-line border-y border-line text-sm"><div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><dt className="text-ink-500">Name</dt><dd className="font-semibold text-ink-900">{customer?.full_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || '—'}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><dt className="text-ink-500">Email</dt><dd className="break-all font-semibold text-ink-900">{customer?.email || '—'}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><dt className="text-ink-500">Services</dt><dd><ul className="space-y-2">{selectedServices.map((service) => <li key={service.id} className="flex justify-between gap-4"><span className="font-semibold text-ink-900">{service.name}</span><span className="shrink-0">{formatPeso(service.price)}</span></li>)}</ul></dd></div><div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><dt className="text-ink-500">Team member</dt><dd className="font-semibold text-ink-900">{selectedStaff?.name || 'No preference'}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><dt className="text-ink-500">Date and time</dt><dd className="font-semibold text-ink-900">{prettyDate} · {time}</dd></div><div className="flex justify-between gap-4 py-4 text-base"><dt className="font-bold text-ink-900">Service total</dt><dd className="font-display text-xl font-semibold text-brand-800">{formatPeso(totalPrice)}</dd></div></dl>{formError && <p className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger" role="alert">{formError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><Button type="button" variant="soft" onClick={editBooking} disabled={submitting}>Edit</Button><Button type="button" onClick={confirmBooking} loading={submitting}>{submitting ? 'Checking availability…' : 'Confirm booking'}</Button></div><p className="mt-4 text-center text-xs text-ink-500">Payment is settled at the salon after staff confirmation. No time is held until your request is placed.</p></Card></main>;
  return <form onSubmit={submit} className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-14 lg:py-12" noValidate>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div><h1 className="font-display text-3xl font-medium text-ink-900">Book an appointment</h1><p className="mt-2 text-sm text-ink-500">Choose a date and time first, then select services and an optional team preference. We’ll recheck availability as your choices change.</p>{!isAuthenticated && <p className="mt-3 max-w-[52ch] rounded-xl border border-gold-400 bg-gold-100 px-4 py-3 text-sm font-semibold text-ink-900" role="status">You can explore availability as a guest. Sign in only when you are ready to submit; nothing is sent automatically.</p>}</div>
      <Link to="/dashboard/appointments" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-5 text-sm font-bold text-ink-900 shadow-sm transition-colors hover:border-brand-300">View my appointments</Link>
    </div>
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Card className="p-5 sm:p-7">
          <CardHeader title="Choose date and time" subtitle="Times are offered in 30-minute increments. With no services selected, we check for a 30-minute visit. Change your date, services, or team preference and we’ll recheck your time." />
          <div className="flex flex-col gap-6 pt-5">
            <Input ref={dateInputRef} id="booking-date" type="date" label="Preferred date" min={todayISO()} max={maxISO()} value={date} error={fieldErrors.date} onChange={(event) => { selectDate(event.target.value); setFieldErrors((current) => ({ ...current, date: '' })); }} required />
            <div><span id="booking-times-heading" tabIndex={-1} className="mb-2 block text-sm font-bold text-ink-900">Available times for any available team member</span>{!date ? <SlotGrid slots={slots} loading={slotsLoading} error={slotsError} selectedTime={time} onSelect={(value) => { setTime(value); setFieldErrors((current) => ({ ...current, time: '' })); setFormError(''); }} onRetry={() => loadAvailability(selectedStaffId, date, totalMinutes || 30, availabilitySelectionVersionRef.current)} /> : dateStatusPending || dateStatusLoading ? <p className="py-4 text-sm text-ink-500" role="status">Checking whether the salon is open…</p> : selectedDateClosed ? <p className="rounded-xl border border-gold-600 bg-gold-100 px-4 py-3 text-sm font-semibold text-ink-900" role="status">The salon is closed on this date. Choose another date to see available times.</p> : dateStatusError ? <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert"><p>{dateStatusError}</p><button type="button" onClick={() => setDateStatusRetryKey((current) => current + 1)} className="mt-3 min-h-11 rounded-lg border border-danger/40 px-3 text-xs font-bold">Retry date check</button></div> : <SlotGrid slots={slots} loading={slotsLoading} error={slotsError} selectedTime={time} onSelect={(value) => { setTime(value); setFieldErrors((current) => ({ ...current, time: '' })); setFormError(''); }} onRetry={() => loadAvailability(selectedStaffId, date, totalMinutes || 30, availabilitySelectionVersionRef.current)} />}{fieldErrors.time && <p className="mt-2 text-sm font-semibold text-danger" role="alert">{fieldErrors.time}</p>}</div>
          </div>
        </Card>
        <Card className="p-5 sm:p-7"><h2 id="booking-services-heading" tabIndex={-1} className="font-display text-xl font-medium text-ink-900">Select services</h2><p className="mt-1 text-sm text-ink-500">Choose treatments for your visit.</p>{fieldErrors.services && <p className="mt-3 text-sm font-semibold text-danger" role="alert">{fieldErrors.services}</p>}<div className="pt-5">{date && (dateStatusPending || dateStatusLoading) ? <p className="text-sm text-ink-500" role="status">Checking date availability before showing services…</p> : date && selectedDateClosed ? <p className="rounded-xl border border-gold-600 bg-gold-100 px-4 py-3 text-sm font-semibold text-ink-900" role="status">Service choices are unavailable because the salon is closed on this date.</p> : date && dateStatusError ? <p className="text-sm text-danger" role="alert">Confirm the date status above before choosing services.</p> : <ServiceCatalog services={services} loading={!services && !servicesError} error={servicesError} onToggle={(id) => { toggleService(id); setFieldErrors((current) => ({ ...current, services: '' })); }} selectable selectedIds={selectedIdsForServices} />}</div></Card>
        <Card className="p-5 sm:p-7"><CardHeader title="Choose a team preference" subtitle="Optional — leave No preference to match any available team member. Availability is checked for your selected time and full service duration." /><div id="booking-staff-heading" tabIndex={-1} className="pt-5">{fieldErrors.staff && <p className="mb-3 text-sm font-semibold text-danger" role="alert">{fieldErrors.staff}</p>}<StaffPicker availability={currentStaffAvailability} hasTime={Boolean(time)} notice={staffNotice} onRetry={() => { setStaffAvailability({ status: 'loading' }); setStaffAvailabilityRetry((value) => value + 1); }} staff={staff} loading={!staff && !staffError} error={staffError} selectedId={selectedStaffId} onSelect={selectStaff} /></div></Card>
        <Card className="p-5 sm:p-7"><CardHeader title="Next step" subtitle="Review your name, services, and appointment time before confirming." /><div className="mt-5 hidden lg:block"><Button type="submit" size="lg" block>{isAuthenticated ? (editingReview ? 'Save' : 'Continue') : 'Sign in'}</Button><p className="mt-3 flex items-center justify-center gap-2 text-xs text-ink-500"><IconCalendar size={13} />Nothing is booked until you confirm on the review screen.</p></div></Card>
      </div>
      <div className="hidden lg:block"><Summary selectedServices={selectedServices} totalPrice={totalPrice} totalMinutes={totalMinutes} prettyDate={prettyDate} time={time} staffName={selectedStaff?.name} /></div>
    </div>
    <div className="mt-6 lg:hidden"><Summary compact selectedServices={selectedServices} totalPrice={totalPrice} totalMinutes={totalMinutes} prettyDate={prettyDate} time={time} staffName={selectedStaff?.name} /></div>
    <div className="sticky bottom-0 z-20 -mx-5 mt-6 border-t border-line bg-canvas/95 px-5 py-4 backdrop-blur-sm sm:-mx-8 sm:px-8 lg:hidden"><div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-ink-900">{selectedIdsForServices.length} service{selectedIdsForServices.length === 1 ? '' : 's'}</span><span className="font-display font-semibold text-brand-800">{formatPeso(totalPrice)}</span></div><Button type="submit" block size="lg">{isAuthenticated ? (editingReview ? 'Save' : 'Continue') : 'Sign in'}</Button>{formError && <p className="mt-2 text-center text-xs font-semibold text-danger">{formError}</p>}</div>
  </form>;
}
