import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusPill } from '../components/ui/StatusPill';
import { Spinner } from '../components/ui/Spinner';
import { AdminDialog } from '../components/admin/AdminDialog';
import { formatPeso } from '../utils/format';
import { curateHomepageServices, supportsHomepageCuration } from '../utils/services';
import { serviceImageUrl } from '../utils/serviceImages';
import { serviceCategoryOptions as categoryOptionsForType, serviceSubcategoryOptions as subcategoryOptionsFor, serviceTypeOptions } from '../utils/serviceMetadata';
import { deleteFaq, getAdminAbout, getCustomerHistory, inviteStaff, listAdminAppointments, listAdminFaqs, listAdminProfiles, listAdminServices, resetStaffPassword, rescheduleAppointment, saveFaq, saveService, setServiceActive, setServiceHomepageFeatured, updateAdminAbout, updateAdminProfile, updateAppointmentStatus, uploadServiceImage } from '../api/admin';
import { getAvailableSlots } from '../api/endpoints';
import { IconArrowRight, IconCalendar, IconCheckCircle, IconClock, IconGrid, IconSearch, IconSparkle, IconUser } from '../components/icons';

const TERMINAL_APPOINTMENT_STATUSES = new Set(['Completed', 'Cancelled']);
const APPOINTMENT_ACTIONS = {
  Pending: [
    { status: 'Confirmed', label: 'Confirm', variant: 'primary' },
    { status: 'Cancelled', label: 'Cancel', variant: 'danger' },
  ],
  Confirmed: [
    { status: 'Completed', label: 'Mark completed', variant: 'primary' },
    { status: 'Cancelled', label: 'Cancel', variant: 'danger' },
  ],
};
const TABS = [
  ['overview', 'Overview', IconGrid],
  ['appointments', 'Appointments', IconCalendar],
  ['catalog', 'Services', IconSparkle],
  ['customers', 'Customers', IconUser],
  ['faqs', 'FAQs', IconCheckCircle],
  ['about', 'Business info', IconGrid],
];
const SERVICE_PAGE_SIZE = 10;
const CUSTOMER_PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 5;

function AdminRail({ tab, setTab, isAdmin, onLogout }) {
  const items = isAdmin ? [...TABS, ['staff', 'Staff accounts', IconUser]] : TABS;
  return <aside className="hidden border-r border-line bg-surface lg:block"><div className="sticky top-0 flex h-screen w-[210px] flex-col"><div className="flex items-center gap-3 border-b border-line px-5 py-7"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500 font-display text-xl font-medium text-gold-600">A</span><span className="font-display text-sm font-semibold leading-[0.95] text-ink-900">Astrid Nails<br /><span className="font-sans text-[8px] font-bold uppercase tracking-[0.15em] text-ink-500">&amp; Beauty Bar</span></span></div><nav aria-label="Staff sections" className="flex flex-col gap-1 px-3 py-6">{items.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors ${tab === key ? 'bg-blush-100 font-bold text-brand-800 before:absolute before:inset-y-2 before:-left-3 before:w-1 before:bg-brand-800 before:content-[""]' : 'font-medium text-ink-600 hover:bg-canvas hover:text-ink-900'}`}><Icon size={18} />{label}</button>)}</nav><div className="mt-auto border-t border-line p-4"><p className="text-xs text-ink-500">Protected staff workspace</p><Link to="/" className="mt-3 flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"><IconArrowRight size={16} className="rotate-180" />Back to homepage</Link><button type="button" onClick={onLogout} className="mt-1 flex min-h-11 w-full items-center rounded-lg px-3 text-sm font-semibold text-danger hover:bg-blush-50">Log out</button></div></div></aside>;
}
function MobileSectionNav({ tab, setTab, isAdmin }) {
  const items = isAdmin ? [...TABS, ['staff', 'Staff accounts', IconUser]] : TABS;
  return <label className="flex items-center gap-3 lg:hidden"><span className="sr-only">Staff section</span><select value={tab} onChange={(event) => setTab(event.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink-900">{items.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>;
}

function isTerminalAppointment(appointment) {
  return TERMINAL_APPOINTMENT_STATUSES.has(appointment?.status);
}

function appointmentActions(status) {
  return APPOINTMENT_ACTIONS[status] || [];
}

function statusConfirmationCopy(status) {
  if (status === 'Confirmed') return { title: 'Confirm appointment?', button: 'Confirm appointment' };
  if (status === 'Completed') return { title: 'Mark appointment completed?', button: 'Mark completed' };
  if (status === 'Cancelled') return { title: 'Cancel appointment?', button: 'Cancel appointment' };
  return { title: 'Update appointment?', button: 'Update status' };
}

function serviceNames(appointment) {
  return (appointment?.services || []).map((service) => service.service_name).filter(Boolean);
}

function appointmentStaffName(appointment) {
  const staff = appointment?.staff;
  if (!staff) return appointment?.staff_id ? 'Assigned team member' : 'Unassigned';
  return [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Assigned team member';
}

function manilaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftManilaDate(date, days) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return manilaDateKey();
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function staffDisplayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.email || 'Team member';
}

function isBookableStaff(profile) {
  return Boolean(profile?.is_active && ['staff', 'admin'].includes(profile?.role) && profile?.accepts_appointments);
}

function localDateLabel(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00+08:00`));
}

function localWeekday(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'short' }).format(new Date(`${date}T12:00:00+08:00`));
}

function appointmentSortKey(appointment) {
  return `${appointment?.local_date || ''}T${appointment?.local_time || ''}`;
}

function recentBookingCompare(a, b) {
  const aCreated = Date.parse(a?.created_at || '');
  const bCreated = Date.parse(b?.created_at || '');
  if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) return bCreated - aCreated;
  if (Number.isFinite(aCreated) !== Number.isFinite(bCreated)) return Number.isFinite(bCreated) ? 1 : -1;
  return appointmentSortKey(b).localeCompare(appointmentSortKey(a)) || String(b?.id || '').localeCompare(String(a?.id || ''));
}

function countedBooking(appointment) {
  return appointment?.status !== 'Cancelled';
}

function PaginationControls({ page, pageCount, total, pageSize, label, onPageChange }) {
  if (!total) return null;
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4" aria-label={`${label} pages`}><p className="text-sm text-ink-500">Showing {start}–{end} of {total}</p><div className="flex items-center gap-2"><button type="button" className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-ink-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:opacity-45" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>Previous</button><span className="min-w-20 text-center text-sm font-semibold text-ink-600">Page {currentPage} of {pageCount}</span><button type="button" className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-ink-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:opacity-45" onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))} disabled={currentPage >= pageCount}>Next</button></div></div>;
}

function AppointmentRow({ appointment, selected, onSelect }) {
  const customer = appointment.customer || {};
  return <li className="border-b border-line last:border-b-0"><button type="button" onClick={() => onSelect(appointment)} className={`grid min-h-20 w-full items-center gap-3 py-4 text-left leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-800 sm:grid-cols-[0.9fr_1.3fr_minmax(0,1fr)_auto] ${selected ? 'bg-blush-50' : 'hover:bg-canvas'}`}><span className="min-w-0"><span className="block font-display text-base font-medium leading-snug text-ink-900">{appointment.local_time?.slice(0, 5) || '—'}</span><span className="block text-xs leading-snug text-ink-500">{appointment.local_date || 'Date unavailable'}</span></span><span className="min-w-0 overflow-hidden"><span className="block break-words text-sm font-bold leading-snug text-ink-900">{customer.first_name} {customer.last_name}</span><span className="block break-all text-xs leading-snug text-ink-500">{customer.email || 'No email'}</span><span className="block break-words text-xs leading-snug text-ink-500">{appointmentStaffName(appointment)}</span></span><span className="min-w-0 break-words text-sm leading-snug text-ink-600">{serviceNames(appointment).join(', ') || 'No services'}</span><span className="justify-self-start sm:justify-self-end sm:whitespace-nowrap"><StatusPill status={appointment.status} size="sm" /></span></button></li>;
}

function AppointmentInspector({ appointment, onRequestStatus, onReschedule }) {
  if (!appointment) return <Card className="h-full p-6"><p className="text-sm leading-relaxed text-ink-500">Select an appointment to inspect its customer, services, status, or reschedule action.</p></Card>;
  const customer = appointment.customer || {};
  const terminal = isTerminalAppointment(appointment);
  return <Card className="h-full p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500">Appointment details</p><h2 className="mt-2 break-all font-display text-2xl font-medium text-ink-900">{appointment.reference_no}</h2></div><StatusPill status={appointment.status} /></div><div className="mt-6 border-t border-line pt-5"><h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">Customer</h3><p className="mt-3 font-semibold text-ink-900">{customer.first_name} {customer.last_name}</p><p className="mt-1 break-all text-sm text-ink-600">{customer.email || 'No email'}</p>{customer.phone && <p className="mt-1 text-sm text-ink-600">{customer.phone}</p>}</div><div className="mt-6 border-t border-line pt-5"><h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">When</h3><p className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink-900"><IconCalendar size={16} className="text-brand-600" />{localDateLabel(appointment.local_date)}</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink-900"><IconClock size={16} className="text-brand-600" />{appointment.local_time?.slice(0, 5) || 'Time unavailable'} · {appointment.total_duration_minutes || '—'} min</p><p className="mt-2 text-sm text-ink-600">Team member: <span className="font-semibold text-ink-900">{appointmentStaffName(appointment)}</span></p></div><div className="mt-6 border-t border-line pt-5"><h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">Services</h3><ul className="mt-3 divide-y divide-line">{(appointment.services || []).map((service, index) => <li key={`${appointment.id}-${service.service_name}-${index}`} className="flex justify-between gap-3 py-2 text-sm"><span className="min-w-0 text-ink-700">{service.service_name || 'Unnamed service'}</span><span className="shrink-0 font-semibold text-ink-900">{formatPeso(service.unit_price)}</span></li>)}</ul><p className="mt-3 flex justify-between border-t border-line pt-3 text-sm font-bold"><span>Total</span><span className="font-display text-lg text-brand-800">{formatPeso(appointment.total_price)}</span></p></div>{terminal ? <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-ink-500">Completed and cancelled appointments are read-only.</p> : <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5"><Button type="button" size="sm" variant="soft" className="min-h-11" onClick={() => onReschedule(appointment)}>Reschedule</Button>{appointmentActions(appointment.status).map((action) => <Button key={action.status} type="button" size="sm" variant={action.variant} className="min-h-11" onClick={() => onRequestStatus(appointment, action.status)}>{action.label}</Button>)}</div>}</Card>;
}

function serviceTypeLabel(service) {
  if (service.item_type === 'package') return 'Package · fixed price';
  if (service.item_type === 'add_on') return 'Add-on';
  return 'Service';
}

function customerDisplayName(profile) {
  const fullName = String(profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')).trim();
  return fullName || String(profile?.email || '').trim() || 'Customer details';
}

function ServiceRow({ service, onSaved, onEdit, editing, homepageCurated, homepageCurationSupported, onToggleHomepage }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const imageUrl = serviceImageUrl(service);
  const updateImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await uploadServiceImage(service.id, file);
      if (!result.success) throw new Error(result.error);
      setMessage('Image saved.');
      await onSaved();
    } catch (uploadError) {
      setMessage(uploadError.message);
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };
  const toggle = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await setServiceActive(service.id, !service.is_active);
      if (!result.success) throw new Error(result.error);
      await onSaved();
    } catch (toggleError) {
      setMessage(toggleError.message);
    } finally {
      setBusy(false);
    }
  };
  const toggleHomepage = async () => {
    if (homepageCurationSupported === false) {
      setMessage('Homepage selection needs the latest database migration.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await onToggleHomepage(service.id, !homepageCurated);
      if (!result.success) throw new Error(result.error);
      setMessage(homepageCurated ? 'Removed from homepage.' : 'Added to homepage.');
      await onSaved();
    } catch (homepageError) {
      setMessage(homepageError.message);
    } finally {
      setBusy(false);
    }
  };
  const homepageDisabled = homepageCurationSupported === false || busy || (!homepageCurated && service.is_active === false);
  const homepageActionLabel = homepageCurated ? 'Remove from homepage' : service.is_active === false ? 'Activate to add' : 'Add to homepage';
  return (
    <li className={`border-b border-line py-4 last:border-b-0 ${editing ? 'bg-blush-50/60' : ''}`}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(20rem,22rem)] md:items-start md:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-blush-50 text-brand-300">
            {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <IconSparkle size={20} aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 break-words font-display text-lg font-medium text-ink-900">{service.name}</p>
              {homepageCurated && <span className="rounded-full border border-gold-500/50 bg-gold-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-gold-600">Homepage preview</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-500"><span>{service.category || 'Other'}</span><span aria-hidden="true">·</span><span>{service.subcategory || 'General'}</span><span aria-hidden="true">·</span><span>{serviceTypeLabel(service)}</span></div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span className="font-display font-semibold text-brand-800">{formatPeso(service.price)}</span><span className="text-ink-600">{service.duration_minutes ? `${service.duration_minutes} min` : 'Duration unavailable'}</span><span className={`font-semibold ${service.is_active ? 'text-success' : 'text-danger'}`}>{service.is_active ? 'Active' : 'Inactive'}</span></div>
          </div>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 md:justify-self-end md:w-full">
          <Button type="button" size="sm" variant="soft" className="min-h-11 w-full" disabled={busy} onClick={() => onEdit(service)}>Edit</Button>
          <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-line px-3.5 text-center text-xs font-bold text-ink-700 transition-colors hover:border-brand-300 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-800">{busy ? 'Saving…' : service.image_path ? 'Replace image' : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={updateImage} /></label>
          <Button type="button" size="sm" variant="soft" className="min-h-11 w-full" disabled={busy} onClick={toggle}>{service.is_active ? 'Deactivate' : 'Activate'}</Button>
          {homepageCurationSupported === false ? <Button type="button" size="sm" variant="soft" className="min-h-11 w-full sm:col-span-2" disabled title="Apply the homepage curation migration to enable this control.">Homepage setup needed</Button> : <Button type="button" size="sm" variant={homepageCurated ? 'soft' : 'primary'} className="min-h-11 w-full sm:col-span-2" disabled={homepageDisabled} loading={busy} title={!homepageCurated && service.is_active === false ? 'Activate this service before adding it to the homepage.' : undefined} onClick={toggleHomepage}>{homepageActionLabel}</Button>}
        </div>
      </div>
      {message && <p className="mt-2 text-xs font-semibold text-ink-500 md:col-span-2" role="status">{message}</p>}
    </li>
  );
}

function ServiceMetadataFields({ form, setForm }) {
  const typeOptions = useMemo(() => {
    const currentType = String(form.item_type || '');
    const options = serviceTypeOptions();
    if (currentType && !options.some((option) => option.value === currentType)) options.push({ value: currentType, label: `Legacy type: ${currentType}` });
    return options;
  }, [form.item_type]);
  const categoryOptions = useMemo(() => {
    const currentCategory = String(form.category || '');
    const options = categoryOptionsForType(form.item_type);
    if (currentCategory && !options.some((option) => option.value === currentCategory)) options.push({ value: currentCategory, label: `Legacy category: ${currentCategory}` });
    return options;
  }, [form.item_type, form.category]);
  const subcategoryOptions = useMemo(() => {
    const currentSubcategory = String(form.subcategory || '');
    const options = subcategoryOptionsFor(form.item_type, form.category).map((value) => ({ value, label: value }));
    if (currentSubcategory && !options.some((option) => option.value === currentSubcategory)) options.push({ value: currentSubcategory, label: `Legacy subcategory: ${currentSubcategory}` });
    return options;
  }, [form.item_type, form.category, form.subcategory]);
  const updateType = (event) => {
    const itemType = event.target.value;
    const categories = categoryOptionsForType(itemType);
    const category = itemType === 'service' ? '' : categories[0]?.value || '';
    const subcategory = subcategoryOptionsFor(itemType, category)[0] || '';
    setForm((current) => ({ ...current, item_type: itemType, category, subcategory }));
  };
  const updateCategory = (event) => {
    const category = event.target.value;
    const subcategory = subcategoryOptionsFor(form.item_type, category)[0] || '';
    setForm((current) => ({ ...current, category, subcategory }));
  };
  return <fieldset className="admin-service-form__classification grid gap-4 rounded-xl border border-line bg-canvas/60 p-4 sm:grid-cols-2">
    <legend className="px-1 font-display text-lg font-medium text-ink-900">Classification</legend>
    <p className="-mt-2 text-xs leading-relaxed text-ink-500 sm:col-span-2">Choose a type first, then its category and subcategory. Legacy values remain available while editing existing records.</p>
    <label className="text-sm font-semibold text-ink-900">Type<select required={!form.id} value={form.item_type} onChange={updateType} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"><option value="">{form.id ? 'Legacy type not specified' : 'Select a type'}</option>{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="text-sm font-semibold text-ink-900">Category<select required={!form.id} value={form.category} onChange={updateCategory} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"><option value="">{form.id ? 'Legacy category not specified' : 'Select a category'}</option>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}</select></label>
    <label className="text-sm font-semibold text-ink-900 sm:col-span-2">Subcategory<select required={!form.id} value={form.subcategory} onChange={(event) => setForm((current) => ({ ...current, subcategory: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"><option value="">{form.id ? 'Legacy subcategory not specified' : 'Select a subcategory'}</option>{subcategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
  </fieldset>;
}

function ServiceViewTabs({ view, count, onChange }) {
  return <div role="tablist" aria-label="Service workspace view" className="mt-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-canvas p-1">
    {[['all', 'All services'], ['homepage', `Homepage preview (${count}/6)`]].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={view === value} aria-controls="service-list-panel" onClick={() => onChange(value)} className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 ${view === value ? 'bg-surface text-brand-800 shadow-sm' : 'text-ink-500 hover:bg-surface/70 hover:text-ink-800'}`}>{label}</button>)}
  </div>;
}

function ServiceListEmpty({ homepageView, onViewAll }) {
  return <li className="py-10 text-center text-sm text-ink-500">
    <p>{homepageView ? 'No featured services match these filters.' : 'No services match these filters.'}</p>
    {homepageView && <button type="button" className="mt-3 min-h-11 rounded-lg px-3 text-sm font-bold text-brand-800 underline decoration-line underline-offset-4 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800" onClick={onViewAll}>View all services</button>}
  </li>;
}

function FaqRow({ faq, onSaved }) {
  const [form, setForm] = useState({ question: faq.question, answer: faq.answer, display_order: faq.display_order, is_published: faq.is_published });
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { const result = await saveFaq({ id: faq.id, ...form }); if (!result.success) throw new Error(result.error); onSaved(); } catch (saveError) { onSaved(saveError.message); } finally { setBusy(false); } };
  const remove = async () => { if (!window.confirm('Delete this FAQ?')) return; setBusy(true); try { const result = await deleteFaq(faq.id); if (!result.success) throw new Error(result.error); onSaved(); } catch (removeError) { onSaved(removeError.message); } finally { setBusy(false); } };
  return <li className="grid gap-3 border-b border-line py-4 last:border-b-0 sm:grid-cols-[1fr_1.4fr_auto]"><input value={form.question} onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))} className="min-h-11 rounded-lg border border-line px-3 text-sm" aria-label="FAQ question" disabled={busy} /><textarea value={form.answer} onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))} className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm" aria-label="FAQ answer" disabled={busy} /><div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch"><input type="number" min="0" value={form.display_order} onChange={(event) => setForm((current) => ({ ...current, display_order: event.target.value }))} className="min-h-10 w-20 rounded-lg border border-line px-2 text-sm" aria-label="FAQ order" disabled={busy} /><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={form.is_published} onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))} disabled={busy} />Published</label><Button type="button" size="sm" onClick={save} disabled={busy}>Save</Button><Button type="button" size="sm" variant="soft" onClick={remove} disabled={busy}>Delete</Button></div></li>;
}

function ProfileRow({ profile, selected, onSelect }) {
  const name = staffDisplayName(profile);
  const accountSummary = !profile.is_active ? 'Inactive' : profile.accepts_appointments ? 'Accepts appointments' : 'Appointments off';
  return <li className="border-b border-line last:border-b-0">
    <button type="button" onClick={() => onSelect(profile.id)} aria-pressed={selected} className={`flex min-h-20 w-full items-center justify-between gap-3 rounded-xl px-3 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 ${selected ? 'bg-blush-50' : 'hover:bg-canvas'}`}>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink-900">{name}</span>
        <span className="mt-1 block truncate text-xs text-ink-500">{profile.email}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-bold uppercase sm:inline-flex ${profile.is_active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{profile.is_active ? 'Active' : 'Inactive'}</span>
        <span className="text-xs font-semibold text-ink-500">{accountSummary}</span>
        <IconArrowRight size={16} className={`text-ink-400 transition-transform ${selected ? 'translate-x-0.5 text-brand-700' : ''}`} />
      </span>
    </button>
  </li>;
}

function StaffAvailabilityPanel({ staffMember, date, minDate, maxDate, onDateChange, onShiftDate, slots, loading, error, onRetry, appointments, onRequestAction, actionBusy, canManage }) {
  const bookable = isBookableStaff(staffMember);
  const selectedStaffKey = String(staffMember?.id || '');
  const dayAppointments = appointments.filter((appointment) => String(appointment.staff_id || '') === selectedStaffKey && appointment.local_date === date);
  const blockingAppointments = dayAppointments.filter((appointment) => ['Pending', 'Confirmed'].includes(appointment.status));
  const otherAppointments = dayAppointments.filter((appointment) => !['Pending', 'Confirmed'].includes(appointment.status));
  const slotCount = slots.filter((slot) => slot.available).length;
  return <Card className="p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500">Daily availability</p><h2 className="mt-2 font-display text-2xl font-medium text-ink-900">{staffMember ? staffDisplayName(staffMember) : 'Choose a staff account'}</h2><p className="mt-1 text-sm text-ink-500">{staffMember ? (bookable ? '30-minute availability from the booking schedule.' : 'This account is not bookable for new appointments.') : 'Select an account to inspect its schedule.'}</p></div>
      {staffMember && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${bookable ? 'bg-success/10 text-success' : 'bg-canvas text-ink-500'}`}>{bookable ? 'Bookable' : staffMember.is_active ? 'Not bookable' : 'Inactive'}</span>}
    </div>
    {staffMember && canManage && <div className="mt-5 border-y border-line py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div><h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">Account controls</h3><p className="mt-1 text-xs text-ink-500">Changes apply to {staffDisplayName(staffMember)} after confirmation.</p></div>
        {actionBusy && <span className="text-xs font-semibold text-brand-800" role="status">Saving account change…</span>}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-sm font-semibold text-ink-900">Role<select value={staffMember.role} disabled={actionBusy} onChange={(event) => onRequestAction({ type: 'role', nextRole: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" aria-label={`Role for ${staffDisplayName(staffMember)}`}><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
        <Button type="button" size="sm" variant={staffMember.accepts_appointments ? 'primary' : 'soft'} disabled={actionBusy} onClick={() => onRequestAction({ type: 'appointments', enabled: !staffMember.accepts_appointments })} aria-pressed={staffMember.accepts_appointments} className="min-h-11 self-end">{staffMember.accepts_appointments ? 'Disable appointments' : 'Enable appointments'}</Button>
        <Button type="button" size="sm" variant="soft" disabled={actionBusy} onClick={() => onRequestAction({ type: 'active', enabled: !staffMember.is_active })} className="min-h-11">{staffMember.is_active ? 'Deactivate account' : 'Activate account'}</Button>
        <Button type="button" size="sm" variant="soft" disabled={actionBusy} onClick={() => onRequestAction({ type: 'reset' })} className="min-h-11">Send password reset</Button>
      </div>
    </div>}
    <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-line py-4">
      <button type="button" onClick={() => onShiftDate(-1)} disabled={date <= minDate} aria-label="Previous day" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface text-ink-700 transition-colors hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:opacity-45"><IconArrowRight size={16} className="rotate-180" /></button>
      <label className="min-w-[12rem] flex-1 text-sm font-semibold text-ink-900"><span className="sr-only">Availability date</span><input type="date" min={minDate} max={maxDate} value={date} onChange={(event) => onDateChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></label>
      <button type="button" onClick={() => onShiftDate(1)} disabled={date >= maxDate} aria-label="Next day" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface text-ink-700 transition-colors hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:opacity-45"><IconArrowRight size={16} /></button>
    </div>
    {!staffMember ? <p className="py-8 text-sm text-ink-500">Choose a staff account to see its 30-minute availability and assigned appointments.</p> : !bookable ? <div className="mt-5 rounded-xl border border-gold-600 bg-gold-100 px-4 py-4 text-sm text-ink-900" role="status"><p className="font-semibold">{staffMember.is_active ? 'Appointments are disabled for this account.' : 'Inactive accounts cannot receive new appointments.'}</p><p className="mt-1 text-ink-600">An administrator can activate the account and enable “Accepts appointments” before it appears to customers.</p></div> : loading ? <div className="flex items-center gap-2 py-8 text-sm text-ink-500"><Spinner size="sm" tone="brand" />Loading 30-minute availability…</div> : error ? <div className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-4 text-sm text-danger" role="alert"><p className="font-semibold">{error}</p><Button type="button" size="sm" variant="soft" className="mt-3 min-h-11" onClick={onRetry}>Try again</Button></div> : <div className="mt-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">30-minute availability</h3><span className="text-xs font-semibold text-ink-500">{slotCount} open slot{slotCount === 1 ? '' : 's'}</span></div>{slots.length ? <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map((slot) => { const status = slot.available ? 'Available' : 'Booked or unavailable'; return <div key={slot.time} className={`min-h-11 rounded-lg border px-2 py-2 text-center text-xs font-bold ${slot.available ? 'border-line bg-surface text-ink-700' : 'border-line bg-canvas text-ink-400 line-through'}`} aria-label={`${slot.time}: ${status}`} title={status}><span>{slot.time}</span><span className="sr-only"> — {status}</span></div>; })}</div> : <p className="mt-3 rounded-xl border border-gold-600 bg-gold-100 px-4 py-3 text-sm font-semibold text-ink-900" role="status">No 30-minute times are available on this date.</p>}</div>}
    <div className="mt-6 border-t border-line pt-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-display text-lg font-medium text-ink-900">Assigned appointments</h3><span className="text-xs text-ink-500">{dayAppointments.length} record{dayAppointments.length === 1 ? '' : 's'}</span></div>{dayAppointments.length ? <ul className="mt-3 divide-y divide-line">{blockingAppointments.map((appointment) => <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink-900">{appointment.reference_no}</p><p className="mt-1 text-xs text-ink-500">{appointment.local_time?.slice(0, 5) || 'Time unavailable'} · {appointment.total_duration_minutes || '—'} min</p></div><StatusPill status={appointment.status} size="sm" /></li>)}{otherAppointments.map((appointment) => <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink-900">{appointment.reference_no}</p><p className="mt-1 text-xs text-ink-500">{appointment.local_time?.slice(0, 5) || 'Time unavailable'} · {appointment.total_duration_minutes || '—'} min</p></div><StatusPill status={appointment.status} size="sm" /></li>)}</ul> : <p className="py-5 text-sm text-ink-500">No appointments assigned to this team member on this date.</p>}</div>
  </Card>;
}

function AdminOverview({ appointments, onSelectAppointment }) {
  const today = manilaDateKey();
  const month = today.slice(0, 7);
  const activeAppointments = appointments.filter(countedBooking);
  const todayBookings = activeAppointments.filter((appointment) => appointment.local_date === today);
  const pendingRequests = appointments.filter((appointment) => appointment.status === 'Pending');
  const monthBookings = activeAppointments.filter((appointment) => String(appointment.local_date || '').startsWith(month));
  const weekendBookings = monthBookings.filter((appointment) => ['Sat', 'Sun'].includes(localWeekday(appointment.local_date)));
  const recentBookings = appointments.slice().sort(recentBookingCompare).slice(0, 5);
  const popularServices = [...monthBookings.reduce((counts, appointment) => {
    serviceNames(appointment).forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
    return counts;
  }, new Map())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  const metrics = [
    ['Today’s bookings', todayBookings.length, 'Lucena City local date'],
    ['Pending requests', pendingRequests.length, 'Awaiting staff action'],
    ['Bookings this month', monthBookings.length, 'Cancelled excluded'],
    ['Weekend bookings this month', weekendBookings.length, 'Saturday and Sunday'],
  ];
  return <div className="space-y-6"><div><p className="text-sm text-ink-500">A live operational view for {localDateLabel(today)}. Appointment totals are not payment or revenue figures.</p><dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, detail]) => <div key={label} className="rounded-xl border border-line bg-surface p-5"><dt className="text-sm font-semibold text-ink-600">{label}</dt><dd className="mt-3 font-display text-3xl font-medium text-brand-800">{value}</dd><p className="mt-1 text-xs text-ink-500">{detail}</p></div>)}</dl></div><div className="grid gap-6 xl:grid-cols-2"><Card className="p-5 sm:p-7"><CardHeader title="Recent bookings" subtitle="Latest appointment requests and their service snapshots." />{recentBookings.length ? <ul className="mt-2 divide-y divide-line">{recentBookings.map((appointment) => <li key={appointment.id}><button type="button" onClick={() => onSelectAppointment(appointment)} className="flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"><span className="min-w-0"><span className="block truncate text-sm font-bold text-ink-900">{appointment.reference_no}</span><span className="block truncate text-xs text-ink-500">{localDateLabel(appointment.local_date)} · {appointment.local_time?.slice(0, 5) || 'Time unavailable'} · {appointmentStaffName(appointment)} · {serviceNames(appointment).join(', ') || 'No services'}</span></span><StatusPill status={appointment.status} size="sm" /></button></li>)}</ul> : <p className="py-8 text-sm text-ink-500">No bookings yet.</p>}</Card><Card className="p-5 sm:p-7"><CardHeader title="Popular services this month" subtitle="Counted from appointment service snapshots; cancelled bookings excluded." />{popularServices.length ? <ol className="mt-2 divide-y divide-line">{popularServices.map(([name, count]) => <li key={name} className="flex items-center justify-between gap-4 py-3"><span className="min-w-0 truncate text-sm font-semibold text-ink-800">{name}</span><span className="shrink-0 text-sm font-bold text-brand-800">{count} booking{count === 1 ? '' : 's'}</span></li>)}</ol> : <p className="py-8 text-sm text-ink-500">No non-cancelled bookings this month.</p>}</Card></div></div>;
}

export function AdminPage() {
  const { customer, logout } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [serviceForm, setServiceForm] = useState({ id: '', name: '', category: '', subcategory: '', item_type: 'service', price: '', duration_minutes: 60, description: '', is_active: true });
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategory, setServiceCategory] = useState('All categories');
  const [serviceVisibility, setServiceVisibility] = useState('active');
  const [serviceView, setServiceView] = useState('all');
  const [servicePage, setServicePage] = useState(1);
  const [inviteForm, setInviteForm] = useState({ email: '', first_name: '', last_name: '', role: 'staff' });
  const [aboutForm, setAboutForm] = useState({});
  const [customerForm, setCustomerForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [customerBusy, setCustomerBusy] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [customerHistoryPage, setCustomerHistoryPage] = useState(1);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', display_order: 0 });
  const [reschedule, setReschedule] = useState(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleDialogError, setRescheduleDialogError] = useState('');
  const [statusConfirm, setStatusConfirm] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusDialogError, setStatusDialogError] = useState('');
  const [customerDialogError, setCustomerDialogError] = useState('');
  const [tab, setTab] = useState('overview');
  const historyRequestRef = useRef(0);
  const availabilityRequestRef = useRef(0);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [availabilityDate, setAvailabilityDate] = useState(() => manilaDateKey());
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteDialogError, setInviteDialogError] = useState('');
  const [staffAction, setStaffAction] = useState(null);
  const [staffActionBusy, setStaffActionBusy] = useState(false);
  const [staffActionError, setStaffActionError] = useState('');

  const load = useCallback(async (initialLoad = false) => {
    if (initialLoad) setLoading(true);
    setError('');
    try {
      const [nextAppointments, nextServices, nextFaqs, nextAbout, nextProfiles] = await Promise.all([listAdminAppointments(), listAdminServices(), listAdminFaqs(), getAdminAbout(), listAdminProfiles()]);
      setAppointments(nextAppointments);
      setSelectedAppointment((current) => current ? nextAppointments.find((appointment) => appointment.id === current.id) || null : current);
      setServices(nextServices);
      setFaqs(nextFaqs);
      setAboutForm(nextAbout || {});
      setCustomers(nextProfiles.filter((profile) => profile.role === 'customer'));
      const nextStaff = nextProfiles.filter((profile) => ['staff', 'admin'].includes(profile.role));
      setStaff(nextStaff);
      setSelectedStaffId((current) => nextStaff.some((profile) => profile.id === current) ? current : nextStaff[0]?.id || '');
      return nextAppointments;
    } catch (loadError) {
      setError(loadError.message || 'Could not load staff workspace.');
      return [];
    } finally {
      if (initialLoad) setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  const selectedStaff = useMemo(() => staff.find((profile) => profile.id === selectedStaffId) || null, [staff, selectedStaffId]);
  const availabilityMinDate = manilaDateKey();
  const availabilityMaxDate = shiftManilaDate(availabilityMinDate, 60);
  const loadAvailability = useCallback(() => {
    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;
    if (!selectedStaff || !availabilityDate || !isBookableStaff(selectedStaff)) {
      setAvailabilitySlots([]);
      setAvailabilityError('');
      setAvailabilityLoading(false);
      return Promise.resolve();
    }
    setAvailabilityLoading(true);
    setAvailabilityError('');
    return getAvailableSlots(availabilityDate, 30, selectedStaff.id)
      .then((slots) => {
        if (requestId === availabilityRequestRef.current) setAvailabilitySlots(Array.isArray(slots) ? slots : []);
      })
      .catch((availabilityLoadError) => {
        if (requestId === availabilityRequestRef.current) {
          setAvailabilitySlots([]);
          setAvailabilityError(availabilityLoadError?.message || 'Could not load this day’s availability.');
        }
      })
      .finally(() => {
        if (requestId === availabilityRequestRef.current) setAvailabilityLoading(false);
      });
  }, [availabilityDate, selectedStaff]);

  useEffect(() => { loadAvailability(); }, [loadAvailability]);

  const requestStatus = (appointment, nextStatus) => {
    const current = appointments.find((item) => item.id === appointment?.id);
    if (!current || isTerminalAppointment(current) || !appointmentActions(current.status).some((action) => action.status === nextStatus)) return;
    setError('');
    setStatusDialogError('');
    setStatusConfirm({ id: current.id, reference: current.reference_no, from: current.status, to: nextStatus });
  };

  const closeStatusDialog = () => {
    if (statusBusy) return;
    setStatusConfirm(null);
    setStatusDialogError('');
  };

  const confirmStatus = async () => {
    if (!statusConfirm || statusBusy) return;
    const current = appointments.find((item) => item.id === statusConfirm.id);
    if (!current || isTerminalAppointment(current) || !appointmentActions(current.status).some((action) => action.status === statusConfirm.to)) {
      setStatusConfirm(null);
      setStatusDialogError('');
      return;
    }
    setStatusBusy(true);
    setError('');
    setStatusDialogError('');
    try {
      await updateAppointmentStatus(current.id, statusConfirm.to);
      const refreshed = await load();
      setSelectedAppointment((selected) => selected?.id === current.id ? refreshed.find((item) => item.id === current.id) || null : selected);
      setNotice(`Appointment ${current.reference_no} marked ${statusConfirm.to.toLowerCase()}.`);
      setStatusDialogError('');
      setStatusConfirm(null);
    } catch (statusError) {
      const message = statusError?.message || 'Could not update appointment status.';
      setError(message);
      setStatusDialogError(message);
    } finally {
      setStatusBusy(false);
    }
  };

  const resetServiceForm = () => {
    setServiceForm({ id: '', name: '', category: '', subcategory: '', item_type: 'service', price: '', duration_minutes: 60, description: '', is_active: true });
    setEditingServiceId(null);
    setError('');
    setNotice('');
  };
  const openNewService = () => { resetServiceForm(); setServiceDialogOpen(true); };
  const editService = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({ id: service.id, name: service.name || '', category: service.category || '', subcategory: service.subcategory || '', item_type: service.item_type ?? '', price: service.price ?? '', duration_minutes: service.duration_minutes || 60, description: service.description || '', is_active: service.is_active !== false });
    setError('');
    setNotice('');
    setServiceDialogOpen(true);
  };
  const save = async (event) => {
    event.preventDefault();
    setNotice('');
    try {
      const result = await saveService(editingServiceId ? { ...serviceForm, id: editingServiceId } : serviceForm);
      if (!result.success) throw new Error(result.error);
      resetServiceForm();
      setServiceDialogOpen(false);
      setNotice('Service saved.');
      await load();
    } catch (saveError) {
      setError(saveError.message);
    }
  };
  const resetInviteForm = () => setInviteForm({ email: '', first_name: '', last_name: '', role: 'staff' });
  const openInvite = () => { setInviteDialogError(''); setInviteDialogOpen(true); };
  const closeInvite = () => {
    if (inviteBusy) return;
    setInviteDialogOpen(false);
    setInviteDialogError('');
    resetInviteForm();
  };
  const invite = async (event) => {
    event.preventDefault();
    if (inviteBusy) return;
    setNotice('');
    setInviteDialogError('');
    setInviteBusy(true);
    try {
      const result = await inviteStaff(inviteForm);
      if (!result.success) throw new Error(result.error);
      resetInviteForm();
      setInviteDialogOpen(false);
      setNotice('Invitation sent.');
      await load();
    } catch (inviteError) {
      setInviteDialogError(inviteError?.message || 'Could not send the invitation. Check the details and try again.');
    } finally {
      setInviteBusy(false);
    }
  };
  const selectCustomer = async (profile) => {
    const requestId = historyRequestRef.current + 1;
    historyRequestRef.current = requestId;
    setSelectedCustomer(profile);
    setCustomerForm({ first_name: profile.first_name || '', last_name: profile.last_name || '', phone: profile.phone || '' });
    setCustomerHistory([]);
    setCustomerHistoryPage(1);
    setCustomerHistoryLoading(true);
    setError('');
    setCustomerDialogError('');
    try {
      const history = await getCustomerHistory(profile.id);
      if (historyRequestRef.current === requestId) setCustomerHistory(history);
    } catch (historyError) {
      const message = historyError?.message || 'Could not load appointment history.';
      if (historyRequestRef.current === requestId) {
        setError(message);
        setCustomerDialogError(message);
      }
    } finally {
      if (historyRequestRef.current === requestId) setCustomerHistoryLoading(false);
    }
  };
  const closeCustomer = () => { historyRequestRef.current += 1; setSelectedCustomer(null); setCustomerHistory([]); setCustomerDialogError(''); };
  const saveCustomer = async (event) => {
    event.preventDefault();
    if (!selectedCustomer || customerBusy) return;
    setCustomerBusy(true);
    setError('');
    setCustomerDialogError('');
    try {
      await updateAdminProfile(selectedCustomer.id, customerForm);
      setCustomerDialogError('');
      setNotice('Customer details saved.');
      await load();
      setSelectedCustomer((current) => current ? { ...current, ...customerForm } : current);
    } catch (customerError) {
      const message = customerError?.message || 'Could not save customer details.';
      setError(message);
      setCustomerDialogError(message);
    } finally {
      setCustomerBusy(false);
    }
  };
  const saveAbout = async (event) => { event.preventDefault(); try { await updateAdminAbout(aboutForm); setNotice('Business information saved.'); await load(); } catch (aboutError) { setError(aboutError.message); } };
  const addFaq = async (event) => { event.preventDefault(); try { const result = await saveFaq(newFaq); if (!result.success) throw new Error(result.error); setNewFaq({ question: '', answer: '', display_order: 0 }); setNotice('FAQ saved.'); await load(); } catch (faqError) { setError(faqError.message); } };
  const saveReschedule = async (event) => {
    event.preventDefault();
    if (!reschedule || rescheduleBusy) return;
    const current = appointments.find((appointment) => appointment.id === reschedule.id);
    if (isTerminalAppointment(current)) { setReschedule(null); setRescheduleDialogError(''); return; }
    setRescheduleBusy(true);
    setError('');
    setRescheduleDialogError('');
    try {
      const result = await rescheduleAppointment(reschedule.id, reschedule.date, reschedule.time);
      if (!result.success) throw new Error(result.error);
      setRescheduleDialogError('');
      setReschedule(null);
      setNotice('Appointment rescheduled.');
      await load();
    } catch (rescheduleError) {
      const message = rescheduleError?.message || 'Could not reschedule appointment.';
      setError(message);
      setRescheduleDialogError(message);
    } finally {
      setRescheduleBusy(false);
    }
  };
  const openReschedule = (appointment) => {
    setError('');
    setRescheduleDialogError('');
    setReschedule({ id: appointment.id, reference: appointment.reference_no, date: appointment.local_date, time: appointment.local_time?.slice(0, 5) });
  };
  const closeReschedule = () => {
    if (rescheduleBusy) return;
    setReschedule(null);
    setRescheduleDialogError('');
  };
  const requestStaffAction = (action) => {
    if (!selectedStaff || customer?.role !== 'admin' || staffActionBusy) return;
    const name = staffDisplayName(selectedStaff);
    let nextAction = null;
    if (action.type === 'role' && ['staff', 'admin'].includes(action.nextRole) && action.nextRole !== selectedStaff.role) {
      nextAction = {
        type: 'role',
        fields: { role: action.nextRole },
        title: `Change ${name} to ${action.nextRole === 'admin' ? 'admin' : 'staff'}?`,
        description: `This changes the account role after confirmation. The selector will keep ${selectedStaff.role} until the update succeeds.`,
        confirmLabel: `Change to ${action.nextRole === 'admin' ? 'admin' : 'staff'}`,
        variant: 'primary',
      };
    } else if (action.type === 'appointments') {
      nextAction = {
        type: 'appointments',
        fields: { accepts_appointments: action.enabled === true },
        title: `${action.enabled ? 'Enable' : 'Disable'} appointments for ${name}?`,
        description: action.enabled ? 'This account will be eligible for new customer bookings once it is active.' : 'New customer bookings will no longer offer this account. Existing assigned bookings are unchanged.',
        confirmLabel: action.enabled ? 'Enable appointments' : 'Disable appointments',
        variant: 'primary',
      };
    } else if (action.type === 'active') {
      nextAction = {
        type: 'active',
        fields: { is_active: action.enabled === true },
        title: `${action.enabled ? 'Activate' : 'Deactivate'} ${name}?`,
        description: action.enabled ? 'This account will be able to sign in again, subject to its role.' : 'This prevents sign-in and removes the account from customer-facing staff choices. Existing assigned bookings are unchanged.',
        confirmLabel: action.enabled ? 'Activate account' : 'Deactivate account',
        variant: action.enabled ? 'primary' : 'danger',
      };
    } else if (action.type === 'reset') {
      nextAction = {
        type: 'reset',
        title: `Send a password reset to ${name}?`,
        description: `A recovery email will be sent to ${selectedStaff.email}. The account will not be changed until the recipient uses that link.`,
        confirmLabel: 'Send reset email',
        variant: 'primary',
      };
    }
    if (!nextAction) return;
    setStaffAction({ id: selectedStaff.id, email: selectedStaff.email, name, ...nextAction });
    setStaffActionError('');
    setError('');
  };
  const closeStaffAction = () => {
    if (staffActionBusy) return;
    setStaffAction(null);
    setStaffActionError('');
  };
  const confirmStaffAction = async () => {
    if (!staffAction || staffActionBusy) return;
    setStaffActionBusy(true);
    setStaffActionError('');
    setError('');
    try {
      if (staffAction.type === 'reset') {
        const result = await resetStaffPassword(staffAction.id);
        if (!result.success) throw new Error(result.error);
        setNotice(`Password reset sent to ${staffAction.email}.`);
      } else {
        const result = await updateAdminProfile(staffAction.id, staffAction.fields);
        if (!result.success) throw new Error(result.error);
        setNotice('Account updated.');
        await load();
      }
      setStaffAction(null);
      setStaffActionError('');
    } catch (staffError) {
      const message = staffError?.message || 'Could not update this account.';
      setError(message);
      setStaffActionError(message);
    } finally {
      setStaffActionBusy(false);
    }
  };

  const serviceCategories = useMemo(() => ['All categories', ...new Set(services.map((service) => service.category || 'Other'))], [services]);
  const homepageCurationSupported = supportsHomepageCuration(services);
  const homepagePreviewServices = useMemo(() => curateHomepageServices(services, 6), [services]);
  const homepagePreviewIds = useMemo(() => new Set(homepagePreviewServices.map((service) => service.id)), [homepagePreviewServices]);
  const servicesInView = useMemo(() => serviceView === 'homepage' ? services.filter((service) => homepagePreviewIds.has(service.id)) : services, [services, serviceView, homepagePreviewIds]);
  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLocaleLowerCase();
    return servicesInView.filter((service) => {
      const categoryMatches = serviceCategory === 'All categories' || (service.category || 'Other') === serviceCategory;
      const visibilityMatches = serviceVisibility === 'all' || (serviceVisibility === 'active' ? service.is_active : !service.is_active);
      const searchable = [service.name, service.category, service.subcategory, service.item_type, service.description].filter(Boolean).join(' ').toLocaleLowerCase();
      return categoryMatches && visibilityMatches && (!term || searchable.includes(term));
    });
  }, [servicesInView, serviceSearch, serviceCategory, serviceVisibility]);
  const servicePageCount = Math.max(1, Math.ceil(filteredServices.length / SERVICE_PAGE_SIZE));
  useEffect(() => { setServicePage(1); }, [serviceSearch, serviceCategory, serviceVisibility, serviceView]);
  useEffect(() => { setServicePage((current) => Math.min(current, servicePageCount)); }, [servicePageCount]);
  const visibleServicePage = Math.min(servicePage, servicePageCount);
  const visibleServices = filteredServices.slice((visibleServicePage - 1) * SERVICE_PAGE_SIZE, visibleServicePage * SERVICE_PAGE_SIZE);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLocaleLowerCase();
    return customers.filter((profile) => [profile.first_name, profile.last_name, profile.email, profile.phone].filter(Boolean).join(' ').toLocaleLowerCase().includes(term));
  }, [customers, customerSearch]);
  const customerPageCount = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMER_PAGE_SIZE));
  useEffect(() => { setCustomerPage(1); }, [customerSearch]);
  useEffect(() => { setCustomerPage((current) => Math.min(current, customerPageCount)); }, [customerPageCount]);
  const visibleCustomerPage = Math.min(customerPage, customerPageCount);
  const visibleCustomers = filteredCustomers.slice((visibleCustomerPage - 1) * CUSTOMER_PAGE_SIZE, visibleCustomerPage * CUSTOMER_PAGE_SIZE);
  const customerHistoryPageCount = Math.max(1, Math.ceil(customerHistory.length / HISTORY_PAGE_SIZE));
  useEffect(() => { setCustomerHistoryPage((current) => Math.min(current, customerHistoryPageCount)); }, [customerHistoryPageCount]);
  const visibleHistoryPage = Math.min(customerHistoryPage, customerHistoryPageCount);
  const visibleHistory = customerHistory.slice((visibleHistoryPage - 1) * HISTORY_PAGE_SIZE, visibleHistoryPage * HISTORY_PAGE_SIZE);
  const appointmentCountLabel = useMemo(() => `${appointments.length} booking${appointments.length === 1 ? '' : 's'} · Lucena City local time`, [appointments.length]);
  const rescheduleTarget = reschedule ? appointments.find((appointment) => appointment.id === reschedule.id) : null;
  const pageTitle = TABS.find(([key]) => key === tab)?.[1] || (tab === 'staff' ? 'Staff accounts' : 'Overview');
  const statusCopy = statusConfirmationCopy(statusConfirm?.to);

  return <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[210px_1fr]"><AdminRail tab={tab} setTab={setTab} isAdmin={customer?.role === 'admin'} onLogout={logout} /><main className="min-w-0"><header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-sm"><div className="mx-auto flex min-h-20 max-w-[1500px] items-center justify-between gap-5 px-4 sm:px-7 lg:px-10"><div><p className="hidden text-xs font-bold uppercase tracking-[0.16em] text-ink-400 sm:block">Staff workspace</p><h1 className="font-display text-2xl font-medium text-ink-900">{pageTitle}</h1></div><div className="flex items-center gap-2"><span className="hidden text-sm text-ink-500 sm:block">{customer?.first_name || 'Staff'}</span><div className="flex items-center gap-2"><Link to="/" aria-label="Back to homepage" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-brand-800 hover:border-brand-300 focus-visible:outline-2 lg:hidden focus-visible:outline-offset-2 focus-visible:outline-brand-800"><IconArrowRight size={15} className="rotate-180" /><span className="hidden sm:inline">Back to homepage</span></Link><button type="button" onClick={logout} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 lg:hidden">Log out</button></div></div></div></header><div className="mx-auto max-w-[1500px] space-y-6 px-4 pb-16 pt-6 sm:px-7 lg:px-10"><MobileSectionNav tab={tab} setTab={setTab} isAdmin={customer?.role === 'admin'} />{error && <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</p>}{notice && <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success" role="status">{notice}</p>}{loading ? <Card className="p-8"><div className="flex items-center gap-3 text-sm text-ink-500"><span className="h-4 w-4 animate-pulse rounded-full bg-brand-300" />Loading staff workspace…</div></Card> : tab === 'overview' ? <AdminOverview appointments={appointments} onSelectAppointment={(appointment) => { setSelectedAppointment(appointment); setTab('appointments'); }} /> : tab === 'appointments' ? <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]"><Card className="overflow-hidden p-5 sm:p-7"><CardHeader title="Appointments" subtitle={appointmentCountLabel} /><div className="mt-5 grid min-h-12 items-center gap-2 border-b border-line bg-canvas py-3 text-xs font-bold uppercase leading-snug tracking-[0.12em] text-ink-500 sm:grid-cols-[0.9fr_1.3fr_1fr_auto]"><span>Time</span><span>Customer</span><span>Services</span><span className="sm:text-right">Status</span></div><ul className="mt-1">{appointments.length ? appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} selected={selectedAppointment?.id === appointment.id} onSelect={setSelectedAppointment} />) : <li className="py-12 text-center text-sm text-ink-500">No appointments yet.</li>}</ul></Card><AppointmentInspector appointment={selectedAppointment} onRequestStatus={requestStatus} onReschedule={openReschedule} /></div> : tab === 'catalog' ? <Card className="p-5 sm:p-7"><CardHeader title="Service menu" subtitle="Uploaded images appear in the homepage and compact admin, public-menu, and booking previews; the menu stays easy to scan." action={<Button type="button" size="sm" className="min-h-11" onClick={openNewService}>Add service</Button>} /><ServiceViewTabs view={serviceView} count={homepagePreviewIds.size} onChange={setServiceView} /><div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_minmax(10rem,13rem)]"><label className="text-sm font-semibold text-ink-900"><span className="sr-only">Search services</span><span className="relative block"><IconSearch size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" /><input type="search" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Search services" className="min-h-11 w-full rounded-xl border border-line bg-surface px-4 pl-11 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></span></label><label className="text-sm font-semibold text-ink-900"><span className="sr-only">Filter by category</span><select value={serviceCategory} onChange={(event) => setServiceCategory(event.target.value)} className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">{serviceCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-sm font-semibold text-ink-900"><span className="sr-only">Filter by service status</span><select value={serviceVisibility} onChange={(event) => setServiceVisibility(event.target.value)} className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"><option value="active">Active only</option><option value="inactive">Inactive only</option><option value="all">All statuses</option></select></label></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-ink-500">{filteredServices.length} matching service{filteredServices.length === 1 ? '' : 's'}</p>{(serviceSearch || serviceCategory !== 'All categories' || serviceVisibility !== 'active') && <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-bold text-brand-800 underline decoration-line underline-offset-4 hover:text-brand-900" onClick={() => { setServiceSearch(''); setServiceCategory('All categories'); setServiceVisibility('active'); }}>Clear filters</button>}</div><ul id="service-list-panel" role="tabpanel" aria-label={serviceView === 'homepage' ? 'Homepage preview services' : 'All services'} className="mt-2">{visibleServices.length ? visibleServices.map((service) => <ServiceRow key={service.id} service={service} onSaved={load} onEdit={editService} homepageCurated={homepagePreviewIds.has(service.id)} homepageCurationSupported={homepageCurationSupported} onToggleHomepage={setServiceHomepageFeatured} />) : <ServiceListEmpty homepageView={serviceView === 'homepage'} onViewAll={() => setServiceView('all')} />}</ul><PaginationControls page={servicePage} pageCount={servicePageCount} total={filteredServices.length} pageSize={SERVICE_PAGE_SIZE} label="Service" onPageChange={setServicePage} /></Card> : tab === 'customers' ? <Card className="p-5 sm:p-7"><CardHeader title="Customers" subtitle={`${customers.length} customer account${customers.length === 1 ? '' : 's'}`} /><div className="mt-5"><label htmlFor="admin-customer-search" className="sr-only">Search customers</label><div className="relative"><IconSearch size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" /><input id="admin-customer-search" type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search by name, email, or phone" className="min-h-11 w-full rounded-xl border border-line bg-surface px-4 pl-11 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></div></div><ul className="mt-3">{visibleCustomers.length ? visibleCustomers.map((profile) => <li key={profile.id} className="border-b border-line last:border-b-0"><div className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="truncate font-semibold text-ink-900">{customerDisplayName(profile)}</p><p className="truncate text-xs text-ink-500">{profile.email} · {profile.phone || 'No phone'}</p></div><Button type="button" size="sm" variant="soft" className="min-h-11 shrink-0" onClick={() => selectCustomer(profile)}>View / edit</Button></div></li>) : <li className="py-10 text-center text-sm text-ink-500">{customers.length ? 'No customers match this search.' : 'No customer accounts yet.'}</li>}</ul><PaginationControls page={customerPage} pageCount={customerPageCount} total={filteredCustomers.length} pageSize={CUSTOMER_PAGE_SIZE} label="Customer" onPageChange={setCustomerPage} /></Card> : tab === 'faqs' ? <Card className="p-5 sm:p-7"><CardHeader title="FAQs" subtitle="Edit or remove the questions shown on the public site." /><ul className="mt-2">{faqs.map((faq) => <FaqRow key={faq.id} faq={faq} onSaved={(message) => { if (message) setError(message); else load(); }} />)}</ul><form onSubmit={addFaq} className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_1.4fr_auto]"><input required placeholder="Question" value={newFaq.question} onChange={(event) => setNewFaq((form) => ({ ...form, question: event.target.value }))} className="min-h-11 rounded-lg border border-line px-3 text-sm" /><textarea required placeholder="Answer" value={newFaq.answer} onChange={(event) => setNewFaq((form) => ({ ...form, answer: event.target.value }))} className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm" /><Button type="submit">Add FAQ</Button></form></Card> : tab === 'about' ? <Card className="p-5 sm:p-7"><CardHeader title="Business information" subtitle="This content is visible on the public site." /><form onSubmit={saveAbout} className="mt-5 grid gap-4 sm:grid-cols-2">{[['business_name', 'Business name'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address'], ['description', 'Description'], ['mission_statement', 'Mission statement'], ['business_hours', 'Business hours'], ['salon_policies', 'Salon policies']].map(([key, label]) => <label key={key} className="text-sm font-semibold text-ink-900">{label}{['description', 'mission_statement', 'business_hours', 'salon_policies'].includes(key) ? <textarea value={aboutForm[key] || ''} onChange={(event) => setAboutForm((form) => ({ ...form, [key]: event.target.value }))} className="mt-1 block min-h-24 w-full rounded-lg border border-line px-3 py-2 text-sm" /> : <input required={key === 'business_name'} type={key === 'email' ? 'email' : 'text'} value={aboutForm[key] || ''} onChange={(event) => setAboutForm((form) => ({ ...form, [key]: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line px-3 text-sm" />}</label>)}<Button type="submit">Save business info</Button></form></Card> : tab === 'staff' ? <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-ink-500">Select an account to inspect its real 30-minute schedule and assigned appointments.</p></div><Button type="button" size="sm" className="min-h-11" onClick={openInvite}>Invite staff</Button></div><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]"><Card className="p-5 sm:p-7"><CardHeader title="Staff accounts" subtitle="Select an account to inspect availability, update access, or send a recovery link." /><ul className="mt-2">{staff.length ? staff.map((profile) => <ProfileRow key={profile.id} profile={profile} selected={selectedStaffId === profile.id} onSelect={setSelectedStaffId} />) : <li className="py-10 text-center text-sm text-ink-500">No staff accounts yet.</li>}</ul></Card><StaffAvailabilityPanel staffMember={selectedStaff} date={availabilityDate} minDate={availabilityMinDate} maxDate={availabilityMaxDate} onDateChange={(nextDate) => { if (/^\\d{4}-\\d{2}-\\d{2}$/.test(nextDate) && nextDate >= availabilityMinDate && nextDate <= availabilityMaxDate) setAvailabilityDate(nextDate); }} onShiftDate={(days) => setAvailabilityDate((current) => { const next = shiftManilaDate(current, days); return next < availabilityMinDate ? availabilityMinDate : next > availabilityMaxDate ? availabilityMaxDate : next; })} slots={availabilitySlots} loading={availabilityLoading} error={availabilityError} onRetry={loadAvailability} appointments={appointments} onRequestAction={requestStaffAction} actionBusy={staffActionBusy} canManage={customer?.role === 'admin'} /></div></div> : <AdminOverview appointments={appointments} onSelectAppointment={(appointment) => { setSelectedAppointment(appointment); setTab('appointments'); }} />}</div></main><AdminDialog open={!!statusConfirm} title={statusCopy.title} description={`${statusConfirm?.reference || 'This appointment'} will move from ${statusConfirm?.from || 'its current status'} to ${statusConfirm?.to || 'the next status'}.`} closeDisabled={statusBusy} onClose={closeStatusDialog}><p className="text-sm leading-relaxed text-ink-600">{statusConfirm?.to === 'Cancelled' ? 'The cancellation stays in the appointment history and cannot be reversed from this workspace.' : 'Confirm this transition after checking the appointment details.'}</p>{statusDialogError && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">{statusDialogError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-2"><Button type="button" variant="soft" className="min-h-11" disabled={statusBusy} onClick={closeStatusDialog}>Keep appointment</Button><Button type="button" variant={statusConfirm?.to === 'Cancelled' ? 'danger' : 'primary'} className="min-h-11" loading={statusBusy} onClick={confirmStatus}>{statusCopy.button}</Button></div></AdminDialog><AdminDialog open={!!rescheduleTarget && !isTerminalAppointment(rescheduleTarget)} title={`Reschedule ${reschedule?.reference || 'appointment'}`} description="Choose a 30-minute slot in Lucena City local time." closeDisabled={rescheduleBusy} onClose={closeReschedule}><form onSubmit={saveReschedule} className="grid gap-4">{rescheduleDialogError && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">{rescheduleDialogError}</p>}<label className="text-sm font-semibold text-ink-900">Date<input type="date" required value={reschedule?.date || ''} onChange={(event) => setReschedule((current) => ({ ...current, date: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></label><label className="text-sm font-semibold text-ink-900">Time<input type="time" required step="1800" value={reschedule?.time || ''} onChange={(event) => setReschedule((current) => ({ ...current, time: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></label><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="soft" className="min-h-11" disabled={rescheduleBusy} onClick={closeReschedule}>Cancel</Button><Button type="submit" className="min-h-11" loading={rescheduleBusy}>Save reschedule</Button></div></form></AdminDialog><AdminDialog size="wide" open={serviceDialogOpen} title={editingServiceId ? `Edit ${serviceForm.name || 'service'}` : 'Add service'} description="Keep the live menu details current. Existing catalog grouping metadata is preserved when you edit a service." closeDisabled={false} onClose={() => { resetServiceForm(); setServiceDialogOpen(false); }}><form onSubmit={save} className="admin-service-form grid gap-4">{[['id', 'Service ID'], ['name', 'Name'], ['price', 'Price'], ['duration_minutes', 'Minutes']].map(([key, label]) => <label key={key} className="text-sm font-semibold text-ink-900">{label}<input required value={serviceForm[key]} readOnly={key === 'id' && !!editingServiceId} type={key === 'price' || key === 'duration_minutes' ? 'number' : 'text'} min={key === 'price' ? '0' : key === 'duration_minutes' ? '5' : undefined} onChange={(event) => setServiceForm((form) => ({ ...form, [key]: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></label>)}<ServiceMetadataFields form={serviceForm} setForm={setServiceForm} /><label className="admin-service-form__description text-sm font-semibold text-ink-900">Description<textarea value={serviceForm.description} onChange={(event) => setServiceForm((form) => ({ ...form, description: event.target.value }))} className="mt-1 block min-h-24 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></label><label className="admin-service-form__published flex items-center gap-3 text-sm font-semibold text-ink-900"><input type="checkbox" checked={serviceForm.is_active} onChange={(event) => setServiceForm((form) => ({ ...form, is_active: event.target.checked }))} className="h-5 w-5 accent-brand-800" />Published in booking menu</label>{error && <p className="admin-service-form__error rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">{error}</p>}<div className="admin-service-form__actions flex flex-wrap justify-end gap-2"><Button type="button" variant="soft" className="min-h-11" onClick={() => { resetServiceForm(); setServiceDialogOpen(false); }}>Cancel</Button><Button type="submit" className="min-h-11">Save service</Button></div></form></AdminDialog><AdminDialog open={!!selectedCustomer} title={customerDisplayName(selectedCustomer)} description="Contact details and bounded appointment history." closeDisabled={customerBusy} onClose={closeCustomer}>{customerDialogError && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">{customerDialogError}</p>}<form onSubmit={saveCustomer} className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold text-ink-900">First name<input required value={customerForm.first_name} onChange={(event) => setCustomerForm((form) => ({ ...form, first_name: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></label><label className="text-sm font-semibold text-ink-900">Last name<input value={customerForm.last_name} onChange={(event) => setCustomerForm((form) => ({ ...form, last_name: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></label><label className="text-sm font-semibold text-ink-900">Phone<input required value={customerForm.phone} onChange={(event) => setCustomerForm((form) => ({ ...form, phone: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></label><div className="flex flex-wrap justify-end gap-2 sm:col-span-3"><Button type="button" variant="soft" className="min-h-11" onClick={closeCustomer}>Close</Button><Button type="submit" className="min-h-11" loading={customerBusy}>Save contact</Button></div></form><div className="mt-7 border-t border-line pt-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-display text-lg font-medium text-ink-900">Appointment history</h3>{customerHistory.length > 0 && <span className="text-xs text-ink-500">{customerHistory.length} record{customerHistory.length === 1 ? '' : 's'}</span>}</div>{customerHistoryLoading ? <p className="py-7 text-sm text-ink-500">Loading appointment history…</p> : visibleHistory.length ? <ul className="mt-3 divide-y divide-line">{visibleHistory.map((row) => <li key={row.id} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-ink-900">{row.reference_no}</span><span className="font-semibold text-ink-700">{localDateLabel(row.local_date)} · {row.local_time?.slice(0, 5) || 'Time unavailable'}</span></div><p className="mt-1 break-words text-xs text-ink-500">{serviceNames(row).join(', ') || 'No services'} · {row.status} · {formatPeso(row.total_price)}</p></li>)}</ul> : <p className="py-7 text-sm text-ink-500">No appointment history.</p>}{!customerHistoryLoading && <PaginationControls page={customerHistoryPage} pageCount={customerHistoryPageCount} total={customerHistory.length} pageSize={HISTORY_PAGE_SIZE} label="Appointment history" onPageChange={setCustomerHistoryPage} />}</div></AdminDialog><AdminDialog open={inviteDialogOpen} title="Invite staff" description="Only administrators can provision staff accounts. New staff members accept appointments by default." closeDisabled={inviteBusy} onClose={closeInvite}><form onSubmit={invite} className="grid gap-4">{inviteDialogError && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">{inviteDialogError}</p>}<label className="text-sm font-semibold text-ink-900">Staff email<input required type="email" value={inviteForm.email} onChange={(event) => setInviteForm((form) => ({ ...form, email: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-ink-900">First name<input required value={inviteForm.first_name} onChange={(event) => setInviteForm((form) => ({ ...form, first_name: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" /></label><label className="text-sm font-semibold text-ink-900">Last name<input required value={inviteForm.last_name} onChange={(event) => setInviteForm((form) => ({ ...form, last_name: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" /></label></div><label className="text-sm font-semibold text-ink-900">Role<select value={inviteForm.role} onChange={(event) => setInviteForm((form) => ({ ...form, role: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"><option value="staff">Staff</option><option value="admin">Admin</option></select></label><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="soft" className="min-h-11" disabled={inviteBusy} onClick={closeInvite}>Cancel</Button><Button type="submit" className="min-h-11" loading={inviteBusy}>{inviteBusy ? 'Sending invitation…' : 'Send invitation'}</Button></div></form></AdminDialog><AdminDialog open={!!staffAction} title={staffAction?.title || 'Confirm account change'} description={staffAction?.description || ''} closeDisabled={staffActionBusy} onClose={closeStaffAction}>{staffActionError && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">{staffActionError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-2"><Button type="button" variant="soft" className="min-h-11" disabled={staffActionBusy} onClick={closeStaffAction}>Cancel</Button><Button type="button" variant={staffAction?.variant === 'danger' ? 'danger' : 'primary'} className="min-h-11" loading={staffActionBusy} onClick={confirmStaffAction}>{staffAction?.confirmLabel || 'Confirm change'}</Button></div></AdminDialog></div>;
}
