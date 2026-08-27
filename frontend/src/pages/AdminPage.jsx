import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusPill } from '../components/ui/StatusPill';
import { formatPeso } from '../utils/format';
import { deleteFaq, getAdminAbout, getCustomerHistory, inviteStaff, listAdminAppointments, listAdminFaqs, listAdminProfiles, listAdminServices, resetStaffPassword, rescheduleAppointment, saveFaq, saveService, setServiceActive, updateAdminAbout, updateAdminProfile, updateAppointmentStatus, uploadServiceImage } from '../api/admin';

const STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

function AppointmentRow({ appointment, onStatus, onReschedule }) {
  const [busy, setBusy] = useState(false);
  const customer = appointment.customer || {};
  const change = async (status) => {
    setBusy(true);
    try { await onStatus(appointment.id, status); } finally { setBusy(false); }
  };
  return (
    <li className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-ink-900">{appointment.reference_no} · {customer.first_name} {customer.last_name}</p>
        <p className="text-xs text-ink-500">{customer.email} · {appointment.local_date} at {appointment.local_time?.slice(0, 5)} · {appointment.services.map((s) => s.service_name).join(', ')}</p>
        <p className="mt-1 text-sm font-semibold text-brand-800">{formatPeso(appointment.total_price)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={appointment.status} />
        {appointment.status !== 'Cancelled' && appointment.status !== 'Completed' && (
          <>
            <select className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold" value={appointment.status} disabled={busy} onChange={(event) => change(event.target.value)} aria-label={`Update ${appointment.reference_no}`}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
            <Button type="button" size="sm" variant="soft" disabled={busy} onClick={() => onReschedule(appointment)}>Reschedule</Button>
          </>
        )}
      </div>
    </li>
  );
}

function ServiceRow({ service, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const updateImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setMessage('');
    try { await uploadServiceImage(service.id, file); setMessage('Image saved.'); onSaved(); } catch (error) { setMessage(error.message); } finally { setBusy(false); event.target.value = ''; }
  };
  const toggle = async () => {
    setBusy(true); setMessage('');
    try { await setServiceActive(service.id, !service.is_active); onSaved(); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <div><p className="font-semibold">{service.name}</p><p className="text-xs text-ink-500">{service.category} · {formatPeso(service.price)} · {service.duration_minutes} min</p></div>
      <div className="flex items-center gap-2"><label className="cursor-pointer rounded-lg border border-line px-2 py-1.5 text-xs font-semibold hover:border-brand-300">{busy ? 'Saving…' : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={updateImage} /></label><Button type="button" size="sm" variant="soft" disabled={busy} onClick={toggle}>{service.is_active ? 'Deactivate' : 'Activate'}</Button></div>
      {message && <p className="basis-full text-xs text-ink-500">{message}</p>}
    </li>
  );
}

function FaqRow({ faq, onSaved }) {
  const [form, setForm] = useState({ question: faq.question, answer: faq.answer, display_order: faq.display_order, is_published: faq.is_published });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { const result = await saveFaq({ id: faq.id, ...form }); if (!result.success) throw new Error(result.error); onSaved(); } catch (error) { onSaved(error.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this FAQ?')) return;
    setBusy(true);
    try { const result = await deleteFaq(faq.id); if (!result.success) throw new Error(result.error); onSaved(); } catch (error) { onSaved(error.message); } finally { setBusy(false); }
  };
  return (
    <li className="grid gap-2 border-b border-line py-3 last:border-b-0 sm:grid-cols-[1fr_1.5fr_auto]">
      <input value={form.question} onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))} className="rounded-lg border border-line px-3 py-2 text-sm" aria-label="FAQ question" disabled={busy} />
      <textarea value={form.answer} onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))} className="rounded-lg border border-line px-3 py-2 text-sm" aria-label="FAQ answer" disabled={busy} />
      <div className="flex items-center gap-2 sm:flex-col sm:items-stretch"><input type="number" min="0" value={form.display_order} onChange={(event) => setForm((current) => ({ ...current, display_order: event.target.value }))} className="w-20 rounded-lg border border-line px-2 py-2 text-sm" aria-label="FAQ order" disabled={busy} /><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.is_published} onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))} disabled={busy} /> Published</label><Button type="button" size="sm" onClick={save} disabled={busy}>Save</Button><Button type="button" size="sm" variant="soft" onClick={remove} disabled={busy}>Delete</Button></div>
    </li>
  );
}

function ProfileRow({ profile, onChange, onReset, isAdmin }) {
  const [busy, setBusy] = useState(false);
  const update = async (fields) => {
    setBusy(true);
    try { await onChange(profile.id, fields); } finally { setBusy(false); }
  };
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0"><p className="font-semibold">{profile.first_name} {profile.last_name}</p><p className="truncate text-xs text-ink-500">{profile.email} · {profile.phone || 'No phone'}</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${profile.is_active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{profile.is_active ? 'Active' : 'Inactive'}</span>{isAdmin && <select value={profile.role} disabled={busy} onChange={(event) => update({ role: event.target.value })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"><option value="staff">Staff</option><option value="admin">Admin</option></select>} {isAdmin && <Button type="button" size="sm" variant="soft" disabled={busy} onClick={() => update({ is_active: !profile.is_active })}>{profile.is_active ? 'Deactivate' : 'Activate'}</Button>} {isAdmin && <Button type="button" size="sm" variant="soft" disabled={busy} onClick={() => onReset(profile)}>Reset password</Button>}</div>
    </li>
  );
}

export function AdminPage() {
  const { customer, logout } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [error, setError] = useState('');
  const [serviceForm, setServiceForm] = useState({ id: '', name: '', category: '', price: '', duration_minutes: 60, description: '' });
  const [inviteForm, setInviteForm] = useState({ email: '', first_name: '', last_name: '', role: 'staff' });
  const [aboutForm, setAboutForm] = useState({});
  const [customerForm, setCustomerForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', display_order: 0 });
  const [reschedule, setReschedule] = useState(null);
  const [tab, setTab] = useState('appointments');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextAppointments, nextServices, nextFaqs, nextAbout, nextProfiles] = await Promise.all([listAdminAppointments(), listAdminServices(), listAdminFaqs(), getAdminAbout(), listAdminProfiles()]);
      setAppointments(nextAppointments); setServices(nextServices); setFaqs(nextFaqs); setAboutForm(nextAbout || {});
      setCustomers(nextProfiles.filter((profile) => profile.role === 'customer')); setStaff(nextProfiles.filter((profile) => ['staff', 'admin'].includes(profile.role)));
    } catch (loadError) { setError(loadError.message || 'Could not load staff workspace.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const status = async (id, nextStatus) => { try { await updateAppointmentStatus(id, nextStatus); await load(); } catch (statusError) { setError(statusError.message); } };
  const save = async (event) => { event.preventDefault(); setNotice(''); try { const result = await saveService(serviceForm); if (!result.success) throw new Error(result.error); setServiceForm({ id: '', name: '', category: '', price: '', duration_minutes: 60, description: '' }); setNotice('Service saved.'); await load(); } catch (saveError) { setError(saveError.message); } };
  const invite = async (event) => { event.preventDefault(); setNotice(''); try { const result = await inviteStaff(inviteForm); if (!result.success) throw new Error(result.error); setInviteForm({ email: '', first_name: '', last_name: '', role: 'staff' }); setNotice('Invitation sent.'); await load(); } catch (inviteError) { setError(inviteError.message); } };
  const selectCustomer = async (profile) => { setSelectedCustomer(profile); setCustomerForm({ first_name: profile.first_name || '', last_name: profile.last_name || '', phone: profile.phone || '' }); try { setCustomerHistory(await getCustomerHistory(profile.id)); } catch (historyError) { setError(historyError.message); } };
  const saveCustomer = async (event) => { event.preventDefault(); if (!selectedCustomer) return; try { await updateAdminProfile(selectedCustomer.id, customerForm); setNotice('Customer details saved.'); await load(); const refreshed = { ...selectedCustomer, ...customerForm }; setSelectedCustomer(refreshed); } catch (customerError) { setError(customerError.message); } };
  const saveAbout = async (event) => { event.preventDefault(); try { await updateAdminAbout(aboutForm); setNotice('Business information saved.'); await load(); } catch (aboutError) { setError(aboutError.message); } };
  const addFaq = async (event) => { event.preventDefault(); try { const result = await saveFaq(newFaq); if (!result.success) throw new Error(result.error); setNewFaq({ question: '', answer: '', display_order: 0 }); setNotice('FAQ saved.'); await load(); } catch (faqError) { setError(faqError.message); } };
  const saveReschedule = async (event) => { event.preventDefault(); if (!reschedule) return; try { await rescheduleAppointment(reschedule.id, reschedule.date, reschedule.time); setReschedule(null); setNotice('Appointment rescheduled.'); await load(); } catch (rescheduleError) { setError(rescheduleError.message); } };
  const updateProfile = async (id, fields) => { try { await updateAdminProfile(id, fields); setNotice('Account updated.'); await load(); } catch (profileError) { setError(profileError.message); } };
  const resetPassword = async (profile) => { try { const result = await resetStaffPassword(profile.id); if (!result.success) throw new Error(result.error); setNotice(`Password reset sent to ${profile.email}.`); } catch (resetError) { setError(resetError.message); } };

  const tabs = [['appointments', 'Appointments'], ['catalog', 'Services'], ['customers', 'Customers'], ['faqs', 'FAQs'], ['about', 'Business info'], ...(customer?.role === 'admin' ? [['staff', 'Staff accounts']] : [])];

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-brand-800">Supabase staff workspace</p><h1 className="mt-1 font-display text-3xl font-bold">Welcome, {customer?.first_name || 'staff'}</h1><p className="mt-1 text-sm text-ink-500">Appointment status and catalog changes are protected by database RLS.</p></div><Button type="button" variant="soft" onClick={logout}>Sign out</Button></header>
        {error && <p className="mb-5 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        {notice && <p className="mb-5 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">{notice}</p>}
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Staff sections">{tabs.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-brand-800 text-white' : 'border border-line bg-surface text-ink-700'}`}>{label}</button>)}</nav>
        {tab === 'appointments' && <div className="grid gap-6"><Card className="p-6"><CardHeader title="Appointments" subtitle={`${appointments.length} booking${appointments.length === 1 ? '' : 's'} · Manila local time`} /><ul className="mt-4">{appointments.length ? appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onStatus={status} onReschedule={(item) => setReschedule({ id: item.id, reference: item.reference_no, date: item.local_date, time: item.local_time?.slice(0, 5) })} />) : <li className="py-8 text-center text-sm text-ink-500">No appointments yet.</li>}</ul></Card>{reschedule && <Card className="p-6"><CardHeader title={`Reschedule ${reschedule.reference}`} subtitle="Choose a Manila-local 30-minute slot; the database checks overlaps atomically." /><form onSubmit={saveReschedule} className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">Date<input type="date" required value={reschedule.date} onChange={(event) => setReschedule((current) => ({ ...current, date: event.target.value }))} className="mt-1 block rounded-lg border border-line px-3 py-2" /></label><label className="text-sm font-semibold">Time<input type="time" required step="1800" value={reschedule.time} onChange={(event) => setReschedule((current) => ({ ...current, time: event.target.value }))} className="mt-1 block rounded-lg border border-line px-3 py-2" /></label><Button type="submit">Save reschedule</Button><Button type="button" variant="soft" onClick={() => setReschedule(null)}>Cancel</Button></form></Card>}</div>}
        {tab === 'catalog' && <Card className="p-6"><CardHeader title="Service catalog" subtitle="Images upload directly to the service-images Storage bucket." /><ul className="mt-3">{services.map((service) => <ServiceRow key={service.id} service={service} onSaved={load} />)}</ul><form onSubmit={save} className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2"><p className="sm:col-span-2 text-sm font-bold">Add or update service</p>{[['id', 'ID'], ['name', 'Name'], ['category', 'Category'], ['price', 'Price'], ['duration_minutes', 'Minutes']].map(([key, label]) => <input key={key} required placeholder={label} type={key === 'price' || key === 'duration_minutes' ? 'number' : 'text'} value={serviceForm[key]} onChange={(event) => setServiceForm((form) => ({ ...form, [key]: event.target.value }))} className="rounded-lg border border-line px-3 py-2 text-sm" />)}<textarea placeholder="Description" value={serviceForm.description} onChange={(event) => setServiceForm((form) => ({ ...form, description: event.target.value }))} className="sm:col-span-2 rounded-lg border border-line px-3 py-2 text-sm" /><Button type="submit">Save service</Button></form></Card>}
        {tab === 'customers' && <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]"><Card className="p-6"><CardHeader title="Customers" subtitle={`${customers.length} customer accounts`} /><ul className="mt-3">{customers.map((profile) => <li key={profile.id} className="border-b border-line py-3 last:border-b-0"><button type="button" onClick={() => selectCustomer(profile)} className="w-full text-left"><p className="font-semibold">{profile.first_name} {profile.last_name}</p><p className="text-xs text-ink-500">{profile.email} · {profile.phone || 'No phone'}</p></button></li>)}</ul></Card>{selectedCustomer ? <Card className="p-6"><CardHeader title={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`} subtitle="Customer contact details and appointment history" /><form onSubmit={saveCustomer} className="mt-4 grid gap-3 sm:grid-cols-3"><input required value={customerForm.first_name} onChange={(event) => setCustomerForm((form) => ({ ...form, first_name: event.target.value }))} placeholder="First name" className="rounded-lg border border-line px-3 py-2 text-sm" /><input value={customerForm.last_name} onChange={(event) => setCustomerForm((form) => ({ ...form, last_name: event.target.value }))} placeholder="Last name" className="rounded-lg border border-line px-3 py-2 text-sm" /><input required value={customerForm.phone} onChange={(event) => setCustomerForm((form) => ({ ...form, phone: event.target.value }))} placeholder="Phone" className="rounded-lg border border-line px-3 py-2 text-sm" /><Button type="submit">Save contact</Button></form><ul className="mt-5 divide-y divide-line">{customerHistory.map((row) => <li key={row.id} className="py-3 text-sm"><span className="font-semibold">{row.reference_no}</span> · {row.local_date} {row.local_time?.slice(0, 5)} · {row.status} · {formatPeso(row.total_price)}<p className="text-xs text-ink-500">{row.services.map((service) => service.service_name).join(', ')}</p></li>)}</ul></Card> : <Card className="p-6"><p className="text-sm text-ink-500">Select a customer to view details.</p></Card>}</div>}
        {tab === 'faqs' && <Card className="p-6"><CardHeader title="FAQs" subtitle="Edit or remove the questions shown on the public site." /><ul className="mt-3">{faqs.map((faq) => <FaqRow key={faq.id} faq={faq} onSaved={(message) => { if (message) setError(message); else load(); }} />)}</ul><form onSubmit={addFaq} className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_1.5fr_auto]"><input required placeholder="Question" value={newFaq.question} onChange={(event) => setNewFaq((form) => ({ ...form, question: event.target.value }))} className="rounded-lg border border-line px-3 py-2 text-sm" /><textarea required placeholder="Answer" value={newFaq.answer} onChange={(event) => setNewFaq((form) => ({ ...form, answer: event.target.value }))} className="rounded-lg border border-line px-3 py-2 text-sm" /><Button type="submit">Add FAQ</Button></form></Card>}
        {tab === 'about' && <Card className="p-6"><CardHeader title="Business information" subtitle="This content is visible on the public site." /><form onSubmit={saveAbout} className="mt-4 grid gap-3 sm:grid-cols-2">{[['business_name', 'Business name'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address'], ['description', 'Description'], ['mission_statement', 'Mission statement'], ['business_hours', 'Business hours'], ['salon_policies', 'Salon policies']].map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}{['description', 'mission_statement', 'business_hours', 'salon_policies'].includes(key) ? <textarea value={aboutForm[key] || ''} onChange={(event) => setAboutForm((form) => ({ ...form, [key]: event.target.value }))} className="mt-1 block min-h-24 w-full rounded-lg border border-line px-3 py-2 text-sm" /> : <input required={key === 'business_name'} type={key === 'email' ? 'email' : 'text'} value={aboutForm[key] || ''} onChange={(event) => setAboutForm((form) => ({ ...form, [key]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-line px-3 py-2 text-sm" />}</label>)}<Button type="submit">Save business info</Button></form></Card>}
        {tab === 'staff' && customer?.role === 'admin' && <div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><Card className="p-6"><CardHeader title="Staff accounts" subtitle="Activate, deactivate, change roles, or send a recovery link." /><ul className="mt-3">{staff.map((profile) => <ProfileRow key={profile.id} profile={profile} onChange={updateProfile} onReset={resetPassword} isAdmin />)}</ul></Card><Card className="p-6"><CardHeader title="Invite staff" subtitle="Only admins can provision staff Auth users." /><form onSubmit={invite} className="mt-4 flex flex-col gap-3">{[['email', 'Staff email'], ['first_name', 'First name'], ['last_name', 'Last name']].map(([key, label]) => <input key={key} required type={key === 'email' ? 'email' : 'text'} placeholder={label} value={inviteForm[key]} onChange={(event) => setInviteForm((form) => ({ ...form, [key]: event.target.value }))} className="rounded-lg border border-line px-3 py-2 text-sm" />)}<select value={inviteForm.role} onChange={(event) => setInviteForm((form) => ({ ...form, role: event.target.value }))} className="rounded-lg border border-line px-3 py-2 text-sm"><option value="staff">Staff</option><option value="admin">Admin</option></select><Button type="submit">Send invitation</Button></form></Card></div>}
      </div>
    </main>
  );
}
