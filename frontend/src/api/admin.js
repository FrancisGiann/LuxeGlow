import { requireSupabase } from '../lib/supabase';
import { isMissingServiceCatalogMetadataError } from './endpoints';
import { isCanonicalServiceMetadata } from '../utils/serviceMetadata';
import { normalizeStaffNotification, STAFF_NOTIFICATION_LIMIT } from '../utils/staffNotifications';
import { isStaffRole, isSupportedProfileRole } from '../utils/roles';
import { isStaffPositionTitleWithinLimit, normalizeStaffPositionTitle } from '../utils/staffPositionTitle';
import { isValidReviewPublicationUpdate, normalizeReviewModerationRows } from '../utils/reviewModeration';

const STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
const REVIEW_MODERATION_PAGE_SIZE = 25;

function isMissingHomepageCurationError(error) {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLocaleLowerCase();
  return /\bis_homepage_featured\b/.test(message) && (code === '42703' || code === 'PGRST204' || /schema cache|column .* does not exist|could not find .*column/.test(message));
}

function isMissingStaffRosterMetadataError(error) {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLocaleLowerCase();
  const referencesRosterAssignment = /staff_member_id|appointments_staff_member_id_fkey|staff_members/.test(message);
  return referencesRosterAssignment && (
    code === '42703' || code === 'PGRST200' || code === 'PGRST204' ||
    /schema cache|column .* does not exist|could not find .*relationship|could not find .*column/.test(message)
  );
}

const throwIfError = (result, fallback) => {
  if (result.error) throw new Error(result.error.message || fallback);
  return result.data;
};

async function functionErrorMessage(error, fallback) {
  const response = error?.context;
  if (response && typeof response.json === 'function') {
    try {
      const payload = await response.json();
      if (payload?.error) return String(payload.error);
    } catch {
      // FunctionsHttpError responses are not always JSON (for example, on a
      // gateway failure), so fall through to the SDK message below.
    }
  }
  return String(error?.message || fallback);
}

async function assertStaff() {
  const client = requireSupabase();
  const { data: auth, error } = await client.auth.getUser();
  if (error || !auth.user) throw new Error('Staff authentication required.');
  const profile = throwIfError(await client.from('profiles').select('role,is_active').eq('id', auth.user.id).single(), 'Could not verify staff access.');
  if (!profile.is_active || !isStaffRole(profile.role)) throw new Error('Staff access required.');
  return client;
}

async function assertStaffIdentity() {
  const client = requireSupabase();
  const { data: auth, error } = await client.auth.getUser();
  if (error || !auth.user) throw new Error('Staff authentication required.');
  const profile = throwIfError(await client.from('profiles').select('role,is_active').eq('id', auth.user.id).single(), 'Could not verify staff access.');
  if (!profile.is_active || !isStaffRole(profile.role)) throw new Error('Staff access required.');
  return { client, userId: auth.user.id };
}

async function assertAdmin() {
  const client = requireSupabase();
  const { data: auth, error } = await client.auth.getUser();
  if (error || !auth.user) throw new Error('Administrator authentication required.');
  const profile = throwIfError(await client.from('profiles').select('role,is_active').eq('id', auth.user.id).single(), 'Could not verify administrator access.');
  if (!profile.is_active || profile.role !== 'admin') throw new Error('Administrator access required.');
  return client;
}

export async function listAdminAppointments() {
  const client = await assertStaff();
  throwIfError(
    await client.rpc('reconcile_expired_pending_appointments'),
    'Could not refresh expired appointments. Confirm the latest database migration is applied and try again.',
  );
  const appointmentSelection = 'id,reference_no,staff_id,staff_member_id,local_date,local_time,start_at,total_duration_minutes,total_price,status,arrived_at,no_show_reviewed_at,cancellation_reason,customer_cancellation_reason,customer_reschedule_reason,created_at,profiles!appointments_customer_id_fkey(first_name,last_name,email,phone),staff:profiles!appointments_staff_id_fkey(first_name,last_name),staff_member:staff_members!appointments_staff_member_id_fkey(full_name),appointment_services(service_name,unit_price)';
  const orderAppointments = (query) => query.order('created_at', { ascending: false }).order('id', { ascending: false });
  let appointmentResult = await orderAppointments(client.from('appointments').select(appointmentSelection));
  if (appointmentResult.error && isMissingStaffRosterMetadataError(appointmentResult.error)) {
    appointmentResult = await orderAppointments(client.from('appointments').select('id,reference_no,staff_id,local_date,local_time,start_at,total_duration_minutes,total_price,status,arrived_at,no_show_reviewed_at,cancellation_reason,customer_cancellation_reason,customer_reschedule_reason,created_at,profiles!appointments_customer_id_fkey(first_name,last_name,email,phone),staff:profiles!appointments_staff_id_fkey(first_name,last_name),appointment_services(service_name,unit_price)'));
  }
  const aggregateResult = await client.rpc('get_staff_rating_aggregates');
  const rows = throwIfError(appointmentResult, 'Could not load appointments.');
  const aggregates = throwIfError(aggregateResult, 'Could not load staff ratings.') || [];
  const ratingByStaff = new Map(aggregates.map((row) => [String(row.staff_id), { average_rating: row.average_rating == null ? 0 : Number(row.average_rating), rating_count: Number(row.rating_count || 0) }]));
  return (rows || []).map((row) => {
    const staffId = row.staff_member_id || row.staff_id || null;
    const staffName = row.staff_member?.full_name || (row.staff ? [row.staff.first_name, row.staff.last_name].filter(Boolean).join(' ') : staffId ? 'Assigned team member' : 'Unassigned');
    const rating = ratingByStaff.get(String(staffId));
    return { ...row, legacy_staff_id: row.staff_id || null, staff_id: staffId, staff_name: staffName || 'Assigned team member', staff_average_rating: rating?.average_rating || 0, staff_rating_count: rating?.rating_count || 0, total_price: Number(row.total_price), customer: row.profiles, services: row.appointment_services || [] };
  });
}

export async function updateAppointmentStatus(appointmentId, status, cancellationReason) {
  if (!/^[0-9a-f-]{36}$/i.test(String(appointmentId))) return { success: false, error: 'Invalid appointment.' };
  if (!STATUSES.includes(status)) return { success: false, error: 'Invalid appointment status.' };
  const reason = typeof cancellationReason === 'string' ? cancellationReason.trim() : '';
  if (status === 'Cancelled' && (!reason || reason.length > 500)) return { success: false, error: 'Enter a cancellation reason between 1 and 500 characters.' };
  const client = await assertStaff();
  const patch = status === 'Cancelled' ? { status, cancellation_reason: reason } : { status };
  throwIfError(await client.from('appointments').update(patch).eq('id', appointmentId), 'Could not update appointment status.');
  return { success: true };
}

export async function markAppointmentArrived(appointmentId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(appointmentId))) return { success: false, error: 'Invalid appointment.' };
  const client = await assertStaff();
  const { data, error } = await client.rpc('mark_appointment_arrived', { p_appointment_id: appointmentId });
  if (error) throw new Error(error.message || 'Could not record the arrival.');
  return { success: true, arrived_at: data };
}

export async function respondToNoShow(appointmentId, shouldCancel) {
  if (!/^[0-9a-f-]{36}$/i.test(String(appointmentId))) return { success: false, error: 'Invalid appointment.' };
  if (typeof shouldCancel !== 'boolean') return { success: false, error: 'Choose whether to keep or cancel the appointment.' };
  const client = await assertStaff();
  const { data, error } = await client.rpc('respond_to_no_show', {
    p_appointment_id: appointmentId,
    p_cancel: shouldCancel,
  });
  if (error) throw new Error(error.message || 'Could not update the no-show appointment.');
  return { success: true, outcome: data };
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

export async function listAdminReviewModeration({ isPublished = false, page = 1 } = {}) {
  if (typeof isPublished !== 'boolean' || !Number.isSafeInteger(page) || page < 1) {
    throw new Error('Choose a valid review status and page.');
  }
  const client = await assertAdmin();
  const from = (page - 1) * REVIEW_MODERATION_PAGE_SIZE;
  const selection = 'id,rating,staff_rating,review_text,is_published,created_at,profiles!reviews_customer_id_fkey(first_name,last_name),appointments!reviews_appointment_id_fkey(local_date,local_time,staff_id,staff_member_id,staff:profiles!appointments_staff_id_fkey(first_name,last_name),staff_member:staff_members!appointments_staff_member_id_fkey(full_name),appointment_services(service_name))';
  const legacySelection = 'id,rating,staff_rating,review_text,is_published,created_at,profiles!reviews_customer_id_fkey(first_name,last_name),appointments!reviews_appointment_id_fkey(local_date,local_time,staff_id,staff:profiles!appointments_staff_id_fkey(first_name,last_name),appointment_services(service_name))';
  const runQuery = (fields) => client.from('reviews').select(fields, { count: 'exact' })
    .eq('is_published', isPublished)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + REVIEW_MODERATION_PAGE_SIZE - 1);
  let result = await runQuery(selection);
  if (result.error && isMissingStaffRosterMetadataError(result.error)) result = await runQuery(legacySelection);
  const rows = throwIfError(result, 'Could not load review approvals.') || [];
  return {
    reviews: normalizeReviewModerationRows(rows),
    total: Number.isSafeInteger(result.count) && result.count >= 0 ? result.count : rows.length,
    pageSize: REVIEW_MODERATION_PAGE_SIZE,
  };
}

export async function setAdminReviewPublication(reviewId, isPublished) {
  if (!isValidReviewPublicationUpdate(reviewId, isPublished)) {
    return { success: false, error: 'Choose a valid review and publication status.' };
  }
  const client = await assertAdmin();
  const result = await client.from('reviews')
    .update({ is_published: isPublished })
    .eq('id', reviewId)
    .select('id,is_published')
    .maybeSingle();
  const saved = throwIfError(result, 'Could not update review publication.');
  if (!saved || saved.is_published !== isPublished) {
    return { success: false, error: 'This review is no longer available.' };
  }
  return { success: true, is_published: saved.is_published };
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
  let query = client.from('profiles').select('id,email,first_name,last_name,phone,position_title,username,role,is_active,accepts_appointments,created_at,legacy_customer_id,legacy_staff_id').order('last_name').order('first_name');
  if (role) query = query.eq('role', role);
  const [profileResult, aggregateResult] = await Promise.all([query, client.rpc('get_staff_rating_aggregates')]);
  const profiles = throwIfError(profileResult, 'Could not load accounts.') || [];
  const aggregates = throwIfError(aggregateResult, 'Could not load staff ratings.') || [];
  const ratingsByStaff = new Map(aggregates.map((row) => [String(row.staff_id), { average_rating: Number(row.average_rating || 0), rating_count: Number(row.rating_count || 0) }]));
  return profiles.map((profile) => {
    const positionTitle = normalizeStaffPositionTitle(profile.position_title);
    return {
      ...profile,
      position_title: isStaffPositionTitleWithinLimit(positionTitle) ? positionTitle : null,
      average_rating: ratingsByStaff.get(String(profile.id))?.average_rating || 0,
      rating_count: ratingsByStaff.get(String(profile.id))?.rating_count || 0,
    };
  });
}

export async function listAdminStaffMembers() {
  const client = await assertStaff();
  const [memberResult, aggregateResult] = await Promise.all([
    client.from('staff_members').select('id,roster_key,record_kind,full_name,position_title,is_active,is_bookable,created_at').order('record_kind').order('full_name'),
    client.rpc('get_staff_rating_aggregates'),
  ]);
  const members = throwIfError(memberResult, 'Could not load staff details.') || [];
  const aggregates = throwIfError(aggregateResult, 'Could not load staff ratings.') || [];
  const ratingsByStaff = new Map(aggregates.map((row) => [String(row.staff_id), { average_rating: Number(row.average_rating || 0), rating_count: Number(row.rating_count || 0) }]));
  return members.map((member) => {
    const positionTitle = normalizeStaffPositionTitle(member.position_title);
    return {
      ...member,
      position_title: isStaffPositionTitleWithinLimit(positionTitle) ? positionTitle : null,
      average_rating: ratingsByStaff.get(String(member.id))?.average_rating || 0,
      rating_count: ratingsByStaff.get(String(member.id))?.rating_count || 0,
    };
  });
}

export async function updateAdminStaffMember(id, fields) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id))) return { success: false, error: 'Invalid staff member.' };
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return { success: false, error: 'Choose valid staff changes.' };
  const patch = {};
  if (fields.is_active !== undefined) {
    if (typeof fields.is_active !== 'boolean') return { success: false, error: 'Choose a valid staff status.' };
    patch.is_active = fields.is_active;
  }
  if (fields.is_bookable !== undefined) {
    if (typeof fields.is_bookable !== 'boolean') return { success: false, error: 'Choose a valid booking status.' };
    patch.is_bookable = fields.is_bookable;
  }
  if (fields.position_title !== undefined) {
    if (fields.position_title !== null && typeof fields.position_title !== 'string') return { success: false, error: 'Enter a valid position title.' };
    const positionTitle = normalizeStaffPositionTitle(fields.position_title);
    if (!isStaffPositionTitleWithinLimit(positionTitle)) return { success: false, error: 'Position title must be 100 characters or fewer.' };
    patch.position_title = positionTitle;
  }
  if (!Object.keys(patch).length) return { success: false, error: 'No staff changes supplied.' };
  const client = await assertAdmin();
  const result = await client.from('staff_members').update(patch).eq('id', id).select('id,is_active,is_bookable,position_title').maybeSingle();
  const saved = throwIfError(result, 'Could not update staff details.');
  if (!saved) return { success: false, error: 'Staff member not found.' };
  const savedTitle = normalizeStaffPositionTitle(saved.position_title);
  return {
    success: true,
    is_active: saved.is_active,
    is_bookable: saved.is_bookable,
    position_title: isStaffPositionTitleWithinLimit(savedTitle) ? savedTitle : null,
  };
}

export async function getCustomerHistory(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw new Error('Invalid customer account.');
  const client = await assertStaff();
  const selection = 'id,reference_no,staff_id,staff_member_id,local_date,local_time,total_price,total_duration_minutes,status,created_at,staff:profiles!appointments_staff_id_fkey(first_name,last_name),staff_member:staff_members!appointments_staff_member_id_fkey(full_name),appointment_services(service_name)';
  const legacySelection = 'id,reference_no,staff_id,local_date,local_time,total_price,total_duration_minutes,status,created_at,staff:profiles!appointments_staff_id_fkey(first_name,last_name),appointment_services(service_name)';
  const runQuery = (fields) => client.from('appointments').select(fields).eq('customer_id', id).order('local_date', { ascending: false }).order('local_time', { ascending: false });
  let result = await runQuery(selection);
  if (result.error && isMissingStaffRosterMetadataError(result.error)) result = await runQuery(legacySelection);
  const rows = throwIfError(result, 'Could not load customer history.');
  return (rows || []).map((row) => {
    const staffId = row.staff_member_id || row.staff_id || null;
    const staffName = row.staff_member?.full_name || (row.staff ? [row.staff.first_name, row.staff.last_name].filter(Boolean).join(' ') : staffId ? 'Assigned team member' : 'Unassigned');
    return { ...row, legacy_staff_id: row.staff_id || null, staff_id: staffId, staff_name: staffName || 'Assigned team member', total_price: Number(row.total_price), services: [{ service_name: `Team member: ${staffName || 'Assigned team member'}` }, ...(row.appointment_services || [])] };
  });
}

export async function updateAdminProfile(id, fields) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return { success: false, error: 'Invalid account.' };
  const patch = {};
  if (fields.position_title !== undefined) {
    if (fields.position_title !== null && typeof fields.position_title !== 'string') return { success: false, error: 'Enter a valid position title.' };
    const positionTitle = normalizeStaffPositionTitle(fields.position_title);
    if (!isStaffPositionTitleWithinLimit(positionTitle)) return { success: false, error: 'Position title must be 100 characters or fewer.' };
    patch.position_title = positionTitle;
  }
  if (fields.first_name !== undefined) patch.first_name = String(fields.first_name).trim().slice(0, 100);
  if (fields.last_name !== undefined) patch.last_name = String(fields.last_name).trim().slice(0, 100);
  if (fields.phone !== undefined) patch.phone = String(fields.phone).trim().slice(0, 50) || null;
  if (fields.role !== undefined) {
    if (!isSupportedProfileRole(fields.role)) return { success: false, error: 'Invalid role.' };
    patch.role = fields.role;
  }
  if (fields.is_active !== undefined) patch.is_active = !!fields.is_active;
  if (fields.accepts_appointments !== undefined) patch.accepts_appointments = !!fields.accepts_appointments;
  if (!Object.keys(patch).length) return { success: false, error: 'No account changes supplied.' };
  const client = await assertAdmin();
  if (patch.position_title !== undefined) {
    const result = await client.from('profiles').update(patch).eq('id', id).select('position_title').maybeSingle();
    const saved = throwIfError(result, 'Could not update account.');
    if (!saved) return { success: false, error: 'Staff account not found.' };
    const savedTitle = normalizeStaffPositionTitle(saved.position_title);
    return { success: true, position_title: isStaffPositionTitleWithinLimit(savedTitle) ? savedTitle : null };
  }
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
  if (error) throw new Error(await functionErrorMessage(error, 'Could not send password reset.'));
  return data;
}

export async function saveService(fields = {}, { existingId = null } = {}) {
  const input = fields && typeof fields === 'object' ? fields : {};
  const requestedId = String(existingId || input.id || '').trim();
  const id = requestedId || globalThis.crypto?.randomUUID?.();
  const name = String(input.name || '').trim();
  const category = String(input.category || '').trim();
  const subcategory = String(input.subcategory || '').trim();
  const itemType = String(input.item_type || '').trim();
  const price = Number(input.price);
  const duration = Number(input.duration_minutes);
  if (!/^[a-z0-9][a-z0-9_-]{0,49}$/i.test(String(id || '')) || !name || name.length > 255 || category.length > 100 || subcategory.length > 100 || itemType.length > 30 || !Number.isFinite(price) || price < 0 || price > 1000000 || !Number.isInteger(duration) || duration < 5 || duration > 1440) return { success: false, error: 'Check the service name, type, category, subcategory, price, and duration.' };
  const client = await assertStaff();
  let existing = null;
  if (existingId) {
    const existingResult = await client.from('services').select('id,category,subcategory,item_type').eq('id', id).maybeSingle();
    const noRows = existingResult.error?.code === 'PGRST116' && /0 rows/i.test(String(existingResult.error.details || ''));
    if (!noRows) existing = throwIfError(existingResult, 'Could not verify the existing service.');
  }
  if (existingId && !existing) return { success: false, error: 'This service could not be found. Refresh the list and try again.' };
  const canonicalMetadata = isCanonicalServiceMetadata({ item_type: itemType, category, subcategory });
  const preservesLegacyMetadata = existing && String(existing.category || '') === category && String(existing.subcategory || '') === subcategory && String(existing.item_type || '') === itemType;
  if (!canonicalMetadata && !preservesLegacyMetadata) return { success: false, error: 'Choose a supported service type, category, and subcategory combination.' };
  const row = { id, name, category: category || null, subcategory: subcategory || null, item_type: itemType || null, description: String(input.description || '').slice(0, 5000) || null, price, duration_minutes: duration, is_active: input.is_active !== false };
  if (existingId) {
    const updateResult = await client.from('services').update(row).eq('id', id).select('id').maybeSingle();
    if (updateResult.error?.code === 'PGRST116' && /0 rows/i.test(String(updateResult.error.details || ''))) {
      return { success: false, error: 'This service could not be found. Refresh the list and try again.' };
    }
    const updated = throwIfError(updateResult, 'Could not save service.');
    if (!updated) return { success: false, error: 'This service could not be found. Refresh the list and try again.' };
    return { success: true, id };
  }
  const insertResult = await client.from('services').insert(row).select('id').single();
  if (insertResult.error?.code === '23505') return { success: false, error: 'Could not create this service. Refresh the list and try again.' };
  throwIfError(insertResult, 'Could not save service.');
  return { success: true, id };
}

export async function uploadServiceImage(serviceId, file) {
  if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type) || !Number.isFinite(file.size) || file.size <= 0 || file.size > 5 * 1024 * 1024) return { success: false, error: 'Use a JPEG, PNG, or WebP image up to 5 MB.' };
  if (!/^[a-z0-9][a-z0-9_-]{0,49}$/i.test(String(serviceId))) return { success: false, error: 'Invalid service ID.' };
  const client = await assertStaff();
  const body = new FormData();
  body.append('service_id', String(serviceId));
  body.append('image', file, file.name || 'service-image');
  const { data, error } = await client.functions.invoke('upload-service-image', { body });
  if (error) throw new Error(await functionErrorMessage(error, 'Could not upload service image.'));
  if (!data?.success || !data.image_url) return { success: false, error: String(data?.error || 'Could not upload service image.') };
  return { success: true, image_url: data.image_url, image_path: data.image_url, image_public_id: data.image_public_id || null };
}

export async function setServiceActive(serviceId, isActive) {
  const client = await assertStaff();
  throwIfError(await client.from('services').update({ is_active: !!isActive }).eq('id', serviceId), 'Could not update service.');
  return { success: true };
}

export async function setServiceHomepageFeatured(serviceId, isFeatured) {
  if (!/^[a-z0-9][a-z0-9_-]{0,49}$/i.test(String(serviceId))) return { success: false, error: 'Invalid service ID.' };
  const client = await assertStaff();
  const result = await client.from('services').update({ is_homepage_featured: !!isFeatured }).eq('id', String(serviceId)).select('id,is_homepage_featured').maybeSingle();
  if (result.error) {
    if (isMissingHomepageCurationError(result.error)) return { success: false, error: 'Homepage selection needs the latest database migration.' };
    if (String(result.error.code || '') === '23514' || /at most 6 services/i.test(result.error.message || '')) return { success: false, error: 'The homepage already has 6 featured services. Remove one before adding another.' };
    throw new Error(result.error.message || 'Could not update homepage selection.');
  }
  if (!result.data) return { success: false, error: 'Service not found.' };
  const requestedState = !!isFeatured;
  const actualState = result.data.is_homepage_featured === true;
  if (actualState !== requestedState) {
    return {
      success: false,
      error: requestedState
        ? 'This service became inactive before it could be added to the homepage. Refresh and try again.'
        : 'The homepage selection changed before it could be removed. Refresh and try again.',
    };
  }
  return { success: true, is_homepage_featured: actualState };
}

export async function getAdminAbout() {
  const client = await assertStaff();
  return throwIfError(await client.from('about_content').select('*').order('id').limit(1).maybeSingle(), 'Could not load business information.');
}

export async function updateAdminAbout(fields) {
  const client = await assertStaff();
  const data = Object.fromEntries(['business_name', 'description', 'mission_statement', 'phone', 'email', 'address', 'salon_policies', 'map_embed_url'].map((key) => [key, String(fields[key] || '').slice(0, 10000) || null]));
  const current = await getAdminAbout();
  if (!current?.id) throw new Error('Business information has not been seeded.');
  throwIfError(await client.from('about_content').update(data).eq('id', current.id), 'Could not save business information.');
  return { success: true };
}

export async function inviteStaff(fields) {
  const client = await assertStaff();
  const { data, error } = await client.functions.invoke('invite-staff', { body: fields });
  if (error) throw new Error(await functionErrorMessage(error, 'Could not invite staff member.'));
  return data;
}

export async function listAdminNotifications() {
  const client = await assertStaff();
  const rows = throwIfError(
    await client
      .from('staff_notifications')
      .select('id,recipient_id,appointment_id,type,title,message,is_read,created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(STAFF_NOTIFICATION_LIMIT),
    'Could not load staff notifications.'
  ) || [];
  return rows.map(normalizeStaffNotification).filter(Boolean);
}

export async function listAdminSchedule() {
  const client = await assertStaff();
  const schedule = throwIfError(await client.rpc('get_salon_schedule'), 'Could not load salon hours.') || [];
  return schedule.map((row) => ({ day_of_week: Number(row.day_of_week), open_time: row.open_time ? String(row.open_time).slice(0, 5) : '', close_time: row.close_time ? String(row.close_time).slice(0, 5) : '', is_closed: !!row.is_closed }));
}

export async function listAdminClosures(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to))) throw new Error('Choose a valid closure date range.');
  const client = await assertStaff();
  return throwIfError(await client.rpc('get_salon_closures', { p_from: from, p_to: to }), 'Could not load salon closures.') || [];
}

export async function saveAdminSchedule({ dayOfWeek, openTime, closeTime, isClosed }) {
  if (!Number.isInteger(Number(dayOfWeek)) || Number(dayOfWeek) < 1 || Number(dayOfWeek) > 7 || (isClosed ? openTime || closeTime : !/^\d{2}:\d{2}$/.test(String(openTime)) || !/^\d{2}:\d{2}$/.test(String(closeTime)))) return { success: false, error: 'Check the day and opening hours.' };
  const client = await assertStaff();
  const result = await client.rpc('save_salon_hours', { p_day_of_week: Number(dayOfWeek), p_open_time: isClosed ? null : openTime, p_close_time: isClosed ? null : closeTime, p_is_closed: !!isClosed });
  if (result.error) throw new Error(result.error.message || 'Could not save salon hours.');
  return { success: true, schedule: result.data };
}

export async function saveAdminClosure(closureDate, reason = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(closureDate)) || String(reason).length > 500) return { success: false, error: 'Check the closure date and reason.' };
  const client = await assertStaff();
  const result = await client.rpc('save_salon_closure', { p_closure_date: closureDate, p_reason: String(reason).trim() || null });
  if (result.error) throw new Error(result.error.message || 'Could not save closure.');
  return { success: true, closure: result.data };
}

export async function deleteAdminClosure(closureDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(closureDate))) return { success: false, error: 'Choose a valid closure date.' };
  const client = await assertStaff();
  const result = await client.rpc('delete_salon_closure', { p_closure_date: closureDate });
  if (result.error) throw new Error(result.error.message || 'Could not remove closure.');
  return { success: true };
}

export async function listScheduleConflicts(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to))) throw new Error('Choose a valid conflict range.');
  const client = await assertStaff();
  return throwIfError(await client.rpc('get_schedule_conflicts', { p_from: from, p_to: to }), 'Could not load schedule conflicts.') || [];
}

export async function markAdminNotificationRead(notificationId) {
  const id = Number(notificationId);
  if (!Number.isSafeInteger(id) || id < 1) return { success: false, error: 'Invalid notification.' };
  const { client, userId } = await assertStaffIdentity();
  const result = await client
    .from('staff_notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('recipient_id', userId)
    .select('id,is_read')
    .maybeSingle();
  if (result.error) throw new Error(result.error.message || 'Could not mark notification as read.');
  return { success: true, updated: !!result.data };
}

export async function markAllAdminNotificationsRead() {
  const { client, userId } = await assertStaffIdentity();
  const result = await client
    .from('staff_notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false)
    .select('id');
  if (result.error) throw new Error(result.error.message || 'Could not mark notifications as read.');
  return { success: true, updated: result.data?.length || 0 };
}

// Keep the API vocabulary useful to focused hooks without weakening the
// explicit admin authorization boundary above.
export const listStaffNotifications = listAdminNotifications;
export const markStaffNotificationRead = markAdminNotificationRead;
export const markAllStaffNotificationsRead = markAllAdminNotificationsRead;
