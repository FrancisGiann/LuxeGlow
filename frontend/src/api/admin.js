import { publicServiceImage, requireSupabase } from '../lib/supabase';
import { isMissingServiceCatalogMetadataError } from './endpoints';

const STAFF_ROLES = ['staff', 'admin'];
const STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

const throwIfError = (result, fallback) => {
  if (result.error) throw new Error(result.error.message || fallback);
  return result.data;
};

async function assertStaff() {
  const client = requireSupabase();
  const { data: auth, error } = await client.auth.getUser();
  if (error || !auth.user) throw new Error('Staff authentication required.');
  const profile = throwIfError(await client.from('profiles').select('role,is_active').eq('id', auth.user.id).single(), 'Could not verify staff access.');
  if (!profile.is_active || !STAFF_ROLES.includes(profile.role)) throw new Error('Staff access required.');
  return client;
}

export async function listAdminAppointments() {
  const client = await assertStaff();
  const rows = throwIfError(await client.from('appointments').select('id,reference_no,local_date,local_time,total_duration_minutes,total_price,status,created_at,profiles!appointments_customer_id_fkey(first_name,last_name,email,phone),appointment_services(service_name,unit_price)').order('local_date', { ascending: true }).order('local_time', { ascending: true }), 'Could not load appointments.');
  return (rows || []).map((row) => ({ ...row, total_price: Number(row.total_price), customer: row.profiles, services: row.appointment_services || [] }));
}

export async function updateAppointmentStatus(appointmentId, status) {
  if (!STATUSES.includes(status)) return { success: false, error: 'Invalid appointment status.' };
  const client = await assertStaff();
  throwIfError(await client.from('appointments').update({ status }).eq('id', appointmentId), 'Could not update appointment status.');
  return { success: true };
}

export async function listAdminServices() {
  const client = await assertStaff();
  let result = await client.from('services').select('*').order('display_order').order('name');
  if (result.error && isMissingServiceCatalogMetadataError(result.error)) {
    result = await client.from('services').select('*').order('name');
  }
  return throwIfError(result, 'Could not load services.') || [];
}

export async function listAdminFaqs() {
  const client = await assertStaff();
  return throwIfError(await client.from('faqs').select('*').order('display_order').order('id'), 'Could not load FAQs.') || [];
}

export async function saveFaq(fields) {
  const id = fields.id ? Number(fields.id) : undefined;
  const question = String(fields.question || '').trim();
  const answer = String(fields.answer || '').trim();
  const displayOrder = Number(fields.display_order || 0);
  if ((id !== undefined && (!Number.isInteger(id) || id < 1)) || !question || question.length > 500 || !answer || answer.length > 10000 || !Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 100000) return { success: false, error: 'Check the FAQ question, answer, and display order.' };
  const client = await assertStaff();
  const row = { question, answer, display_order: displayOrder, is_published: fields.is_published !== false };
  if (id !== undefined) row.id = id;
  throwIfError(await client.from('faqs').upsert(row).select().single(), 'Could not save FAQ.');
  return { success: true };
}

export async function deleteFaq(id) {
  if (!Number.isInteger(Number(id)) || Number(id) < 1) return { success: false, error: 'Invalid FAQ.' };
  const client = await assertStaff();
  throwIfError(await client.from('faqs').delete().eq('id', Number(id)), 'Could not delete FAQ.');
  return { success: true };
}

export async function listAdminProfiles(role) {
  const client = await assertStaff();
  let query = client.from('profiles').select('id,email,first_name,last_name,phone,username,role,is_active,created_at,legacy_customer_id,legacy_staff_id').order('last_name').order('first_name');
  if (role) query = query.eq('role', role);
  return throwIfError(await query, 'Could not load accounts.') || [];
}

export async function getCustomerHistory(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw new Error('Invalid customer account.');
  const client = await assertStaff();
  const rows = throwIfError(await client.from('appointments').select('id,reference_no,local_date,local_time,total_price,total_duration_minutes,status,created_at,appointment_services(service_name)').eq('customer_id', id).order('local_date', { ascending: false }).order('local_time', { ascending: false }), 'Could not load customer history.');
  return (rows || []).map((row) => ({ ...row, total_price: Number(row.total_price), services: row.appointment_services || [] }));
}

export async function updateAdminProfile(id, fields) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return { success: false, error: 'Invalid account.' };
  const patch = {};
  if (fields.first_name !== undefined) patch.first_name = String(fields.first_name).trim().slice(0, 100);
  if (fields.last_name !== undefined) patch.last_name = String(fields.last_name).trim().slice(0, 100);
  if (fields.phone !== undefined) patch.phone = String(fields.phone).trim().slice(0, 50) || null;
  if (fields.role !== undefined) {
    if (!['customer', 'staff', 'admin'].includes(fields.role)) return { success: false, error: 'Invalid role.' };
    patch.role = fields.role;
  }
  if (fields.is_active !== undefined) patch.is_active = !!fields.is_active;
  if (!Object.keys(patch).length) return { success: false, error: 'No account changes supplied.' };
  const client = await assertStaff();
  throwIfError(await client.from('profiles').update(patch).eq('id', id), 'Could not update account.');
  return { success: true };
}

export async function rescheduleAppointment(appointmentId, date, time) {
  if (!/^[0-9a-f-]{36}$/i.test(String(appointmentId)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^\d{2}:\d{2}$/.test(String(time))) return { success: false, error: 'Choose a valid date and 30-minute time.' };
  const client = await assertStaff();
  const { error } = await client.rpc('reschedule_appointment', { p_appointment_id: appointmentId, p_date: date, p_time: time });
  if (error) throw new Error(error.message || 'Could not reschedule appointment.');
  return { success: true };
}

export async function resetStaffPassword(userId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(userId))) return { success: false, error: 'Invalid staff account.' };
  const client = await assertStaff();
  const { data, error } = await client.functions.invoke('reset-staff-password', { body: { user_id: userId } });
  if (error) throw new Error(error.message || 'Could not send password reset.');
  return data;
}

export async function saveService(fields) {
  const id = String(fields.id || '').trim();
  const name = String(fields.name || '').trim();
  const category = String(fields.category || '').trim();
  const price = Number(fields.price);
  const duration = Number(fields.duration_minutes);
  if (!/^[a-z0-9][a-z0-9_-]{0,49}$/i.test(id) || !name || name.length > 255 || !category || category.length > 100 || !Number.isFinite(price) || price < 0 || price > 1000000 || !Number.isInteger(duration) || duration < 5 || duration > 1440) return { success: false, error: 'Check service ID, name, category, price, and duration.' };
  const client = await assertStaff();
  throwIfError(await client.from('services').upsert({ id, name, category, description: String(fields.description || '').slice(0, 5000) || null, price, duration_minutes: duration, is_active: fields.is_active !== false }).select().single(), 'Could not save service.');
  return { success: true };
}

export async function uploadServiceImage(serviceId, file) {
  if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 5 * 1024 * 1024) return { success: false, error: 'Use a JPEG, PNG, or WebP image up to 5 MB.' };
  if (!/^[a-z0-9][a-z0-9_-]{0,49}$/i.test(String(serviceId))) return { success: false, error: 'Invalid service ID.' };
  const client = await assertStaff();
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${serviceId}/${crypto.randomUUID()}.${ext}`;
  const upload = await client.storage.from('service-images').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (upload.error) throw new Error(upload.error.message || 'Could not upload service image.');
  const update = await client.from('services').update({ image_path: path }).eq('id', serviceId);
  if (update.error) {
    await client.storage.from('service-images').remove([path]);
    throw new Error(update.error.message || 'Could not attach service image.');
  }
  return { success: true, image_url: publicServiceImage(path), image_path: path };
}

export async function setServiceActive(serviceId, isActive) {
  const client = await assertStaff();
  throwIfError(await client.from('services').update({ is_active: !!isActive }).eq('id', serviceId), 'Could not update service.');
  return { success: true };
}

export async function getAdminAbout() {
  const client = await assertStaff();
  return throwIfError(await client.from('about_content').select('*').order('id').limit(1).maybeSingle(), 'Could not load business information.');
}

export async function updateAdminAbout(fields) {
  const client = await assertStaff();
  const data = Object.fromEntries(['business_name', 'description', 'mission_statement', 'phone', 'email', 'address', 'business_hours', 'salon_policies'].map((key) => [key, String(fields[key] || '').slice(0, 10000) || null]));
  const current = await getAdminAbout();
  if (!current?.id) throw new Error('Business information has not been seeded.');
  throwIfError(await client.from('about_content').update(data).eq('id', current.id), 'Could not save business information.');
  return { success: true };
}

export async function inviteStaff(fields) {
  const client = await assertStaff();
  const { data, error } = await client.functions.invoke('invite-staff', { body: fields });
  if (error) throw new Error(error.message || 'Could not invite staff member.');
  return data;
}
