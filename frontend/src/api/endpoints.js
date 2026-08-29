import { publicServiceImage, requireSupabase } from '../lib/supabase';
import { serviceImageUrl } from '../utils/serviceImages';

const asError = (error, fallback = 'Request failed.') => {
  const result = new Error(String(error?.message || fallback));
  result.code = error?.code;
  result.status = error?.status;
  return result;
};

const unwrap = ({ data, error }, fallback) => {
  if (error) throw asError(error, fallback);
  return data;
};

export const isMissingServiceCatalogMetadataError = (error) => {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLocaleLowerCase();
  const referencesCatalogColumn = /\b(display_order|subcategory|item_type)\b/.test(message);
  const knownMissingColumnCode = code === '42703' || code === 'PGRST204';
  const schemaCacheMessage = /schema cache|column .* does not exist|could not find .*column/.test(message);
  return referencesCatalogColumn && (knownMissingColumnCode || schemaCacheMessage);
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const manilaInstant = (date, time = '00:00:00') => new Date(`${date}T${time}+08:00`);
const manilaDateLabel = (date, time) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(manilaInstant(date, time));
const manilaTimeLabel = (date, time) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true }).format(manilaInstant(date, time));

const formatDuration = (minutes) => {
  const value = Number(minutes || 0);
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return `${hours ? `${hours}${hours === 1 ? ' hour' : ' hours'} ` : ''}${rest ? `${rest} minutes` : ''}`.trim();
};

const profilePayload = (profile, user) => {
  if (!profile && !user) return null;
  const meta = user?.user_metadata || {};
  const firstName = profile?.first_name ?? meta.first_name ?? '';
  const lastName = profile?.last_name ?? meta.last_name ?? '';
  return {
    id: profile?.id || user?.id,
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    email: profile?.email || user?.email || '',
    phone: profile?.phone || meta.phone || '',
    role: profile?.role || 'customer',
    is_active: profile?.is_active !== false,
    joined_at: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) : '',
  };
};

/* ── Supabase Auth ───────────────────────────────────────────── */
export async function checkSession() {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw asError(sessionError, 'Could not load the current session.');
  const user = sessionData.session?.user;
  if (!user) return { loggedIn: false, customer: null };
  const { data: profile, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw asError(error, 'Could not load your profile.');
  return { loggedIn: true, customer: profilePayload(profile, user), user };
}

export async function loginCustomer(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password: String(password || '') });
  if (error) {
    const needsVerification = /email not confirmed|confirm your email/i.test(error.message || '');
    if (needsVerification) return { success: false, needs_verification: true, error: 'Please verify your email before signing in.' };
    return { success: false, error: 'Invalid email or password.' };
  }
  const { data: profile } = await client.from('profiles').select('role,is_active').eq('id', data.user.id).maybeSingle();
  if (!profile || profile.role !== 'customer' || !profile.is_active) {
    await client.auth.signOut();
    return { success: false, error: 'Use the staff sign-in for this account.' };
  }
  return { success: true, user: data.user };
}

export async function loginStaff(identifier, password) {
  const email = normalizeEmail(identifier);
  if (!email.includes('@')) return { success: false, error: 'Staff sign-in uses the staff email address.' };
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password: String(password || '') });
  if (error) return { success: false, error: 'Invalid staff credentials.' };
  const { data: profile, error: profileError } = await client.from('profiles').select('role,is_active').eq('id', data.user.id).maybeSingle();
  if (profileError || !profile || !profile.is_active || !['staff', 'admin'].includes(profile.role)) {
    await client.auth.signOut();
    return { success: false, error: 'This account is not authorized for staff access.' };
  }
  return { success: true, redirect: '/admin' };
}

export async function registerCustomer(fields) {
  const firstName = String(fields.first_name || '').trim();
  const lastName = String(fields.last_name || '').trim();
  const email = normalizeEmail(fields.email);
  const phone = String(fields.phone || '').trim();
  const password = String(fields.password || '');
  if (!firstName || !lastName || !phone || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return { success: false, error: 'Enter a valid name, email, phone number, and password of at least 8 characters.' };
  }
  if (password !== String(fields.confirm_password || '')) return { success: false, error: 'Passwords do not match.' };
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({ email, password, options: { data: { first_name: firstName, last_name: lastName, phone } } });
  if (error) return { success: false, error: error.message || 'Registration failed.' };
  return { success: true, needs_verification: !data.session, user: data.user };
}

export async function verifyOtp(otp, email) {
  const { data, error } = await requireSupabase().auth.verifyOtp({ email: normalizeEmail(email), token: String(otp || ''), type: 'signup' });
  if (error) return { success: false, error: 'That verification code is invalid or expired.' };
  return { success: true, user: data.user };
}

export async function resendOtp(email) {
  const { error } = await requireSupabase().auth.resend({ type: 'signup', email: normalizeEmail(email) });
  if (error) return { success: false, error: error.message || 'Could not resend the code.' };
  return { success: true, retry_after: 60 };
}

export async function requestPasswordReset(email) {
  const routerBase = String(import.meta.env.VITE_ROUTER_BASE || '/').replace(/\/+$/, '');
  const { error } = await requireSupabase().auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: `${window.location.origin}${routerBase}/reset-password`,
  });
  if (error) return { success: false, error: error.message || 'Could not process that request.' };
  return { success: true, message: 'If an account exists, a password reset email has been sent.' };
}

export async function completePasswordReset({ email, code, password, confirmPassword }) {
  if (String(password || '').length < 8 || password !== confirmPassword) return { success: false, error: 'Use a matching password of at least 8 characters.' };
  const client = requireSupabase();
  if (String(code || '').trim()) {
    const { error: verifyError } = await client.auth.verifyOtp({ email: normalizeEmail(email), token: String(code), type: 'recovery' });
    if (verifyError) return { success: false, error: 'That reset code is invalid or expired.' };
  } else {
    const { data: session } = await client.auth.getSession();
    if (!session.session) return { success: false, error: 'Open the password-reset link from your email first.' };
  }
  const { error } = await client.auth.updateUser({ password: String(password) });
  if (error) return { success: false, error: error.message || 'Could not update the password.' };
  await client.auth.signOut();
  return { success: true, message: 'Password reset successful.' };
}

export async function logoutCustomer() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw asError(error, 'Could not sign out.');
  return { success: true };
}

/* ── Public content ───────────────────────────────────────────── */
export async function getServices() {
  const client = requireSupabase();
  let result = await client.from('services').select('*').eq('is_active', true).order('display_order').order('name');
  if (result.error && isMissingServiceCatalogMetadataError(result.error)) {
    result = await client.from('services').select('*').eq('is_active', true).order('name');
  }
  const data = unwrap(result, 'Could not load services.');
  return (data || []).map((row) => ({
    id: row.id, name: row.name, category: row.category, subcategory: row.subcategory, item_type: row.item_type,
    display_order: Number(row.display_order || 0), description: row.description,
    price: Number(row.price), duration: formatDuration(row.duration_minutes), minutes: Number(row.duration_minutes),
    rating: Number(row.rating || 0), image_path: row.image_path ? publicServiceImage(row.image_path) : '',
  }));
}

export async function getReviews() {
  const query = await requireSupabase().from('published_reviews').select('*').order('created_at', { ascending: false }).limit(20);
  const data = unwrap(query, 'Could not load reviews.') || [];
  const reviews = data.map((row) => ({ review_id: row.review_id, rating: Number(row.rating), review_text: row.review_text || '', created_at: row.created_at, customer_name: row.customer_name || 'Valued Customer', service_names: row.service_names || 'Beauty Service' }));
  return { success: true, stats: { total_reviews: reviews.length, average_rating: reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0 }, reviews };
}

export async function getFaqs() {
  const data = unwrap(await requireSupabase().from('faqs').select('id,question,answer,display_order').eq('is_published', true).order('display_order').order('id'), 'Could not load FAQs.') || [];
  return data.map((row) => ({ id: row.id, q: row.question, a: row.answer }));
}

export async function getAbout() {
  const data = unwrap(await requireSupabase().from('about_content').select('*').order('id').limit(1).maybeSingle(), 'Could not load business information.');
  return data ? { ...data, salon_name: data.business_name } : {};
}

/* ── Customer dashboard ──────────────────────────────────────── */
const dashboardAppointment = (row) => {
  const services = row.appointment_services || [];
  const review = Array.isArray(row.reviews) ? row.reviews[0] : row.reviews;
  const firstService = services.find((service) => service?.services) || services[0];
  return {
    id: row.id, appointment_id: row.id, reference_no: row.reference_no,
    date: manilaDateLabel(row.local_date, row.local_time),
    time: manilaTimeLabel(row.local_date, row.local_time), raw_date: row.local_date, raw_time: row.local_time,
    service: services.map((s) => s.service_name).join(', ') || 'N/A', service_image: serviceImageUrl(firstService?.services),
    price: Number(row.total_price), total_price: Number(row.total_price), status: row.status, created_at: row.created_at,
    has_rating: !!review, rating_given: review?.rating ? Number(review.rating) : null, review_text: review?.review_text || '',
  };
};

export async function getDashboard() {
  const client = requireSupabase();
  const session = await checkSession();
  if (!session.loggedIn) throw Object.assign(new Error('Not logged in'), { status: 401 });
  const [profileResult, appointmentsResult, notificationsResult] = await Promise.all([
    client.from('profiles').select('*').eq('id', session.user.id).single(),
    client.from('appointments').select('id,reference_no,local_date,local_time,total_price,status,created_at,appointment_services(service_name,services(image_path,category)),reviews(id,rating,review_text,created_at)').eq('customer_id', session.user.id).order('local_date', { ascending: false }).order('local_time', { ascending: false }),
    client.from('user_notifications').select('id,appointment_id,type,title,message,is_read,created_at').eq('customer_id', session.user.id).order('created_at', { ascending: false }).limit(30),
  ]);
  const profile = unwrap(profileResult, 'Could not load your profile.');
  const appointmentRows = unwrap(appointmentsResult, 'Could not load appointments.') || [];
  const appointments = appointmentRows.map(dashboardAppointment);
  const notifications = (unwrap(notificationsResult, 'Could not load notifications.') || []).map((row) => ({ ...row, id: Number(row.id), is_read: !!row.is_read, created_at: new Date(row.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }));
  const reviews = appointmentRows
    .flatMap((row) => {
      const nestedReviews = Array.isArray(row.reviews) ? row.reviews : row.reviews ? [row.reviews] : [];
      return nestedReviews.map((review) => ({ review, appointment: row }));
    })
    .sort((a, b) => Date.parse(b.review.created_at || '') - Date.parse(a.review.created_at || ''))
    .map(({ review, appointment }) => ({ review_id: Number(review.id), appointment_id: appointment.id, rating: Number(review.rating), review_text: review.review_text || '', service_names: (appointment.appointment_services || []).map((s) => s.service_name).join(', ') || 'Beauty Service', created_at: new Date(review.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) }));
  const summary = { pending_count: 0, confirmed_count: 0, completed_count: 0, cancelled_count: 0, unread_notifications: notifications.filter((n) => !n.is_read).length };
  appointments.forEach((row) => { const key = `${row.status.toLowerCase()}_count`; if (key in summary) summary[key] += 1; });
  return { success: true, customer: profilePayload(profile, session.user), summary, appointments, notifications, reviews };
}

export async function markNotificationRead(notificationId) {
  const client = requireSupabase();
  const user = (await client.auth.getUser()).data.user;
  if (!user) throw Object.assign(new Error('Not logged in'), { status: 401 });
  const query = notificationId
    ? client.from('user_notifications').update({ is_read: true }).eq('id', notificationId).eq('customer_id', user.id)
    : client.from('user_notifications').update({ is_read: true }).eq('customer_id', user.id).eq('is_read', false);
  unwrap(await query, 'Could not update notifications.');
  return { success: true };
}

export const markAllNotificationsRead = () => markNotificationRead(null);

/* ── Reviews/profile ─────────────────────────────────────────── */
export async function getRatableAppointments() {
  const client = requireSupabase();
  const user = (await client.auth.getUser()).data.user;
  if (!user) throw Object.assign(new Error('Not logged in'), { status: 401 });
  const data = unwrap(await client.from('appointments').select('id,reference_no,local_date,local_time,total_price,appointment_services(service_name),reviews(id)').eq('customer_id', user.id).eq('status', 'Completed').order('local_date', { ascending: false }), 'Could not load visits.') || [];
  return { success: true, appointments: data.filter((row) => { const review = Array.isArray(row.reviews) ? row.reviews[0] : row.reviews; return !review; }).map((row) => ({ appointment_id: row.id, appointment_date: row.local_date, appointment_time: manilaTimeLabel(row.local_date, row.local_time), service_names: (row.appointment_services || []).map((s) => s.service_name).join(', '), total_price: Number(row.total_price) })) };
}

export async function createReview(appointmentId, rating, reviewText) {
  const client = requireSupabase();
  const user = (await client.auth.getUser()).data.user;
  if (!user) throw Object.assign(new Error('Not logged in'), { status: 401 });
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5 || String(reviewText || '').length > 2000) return { success: false, error: 'Enter a rating from 1 to 5 and keep the review under 2,000 characters.' };
  const data = unwrap(await client.from('reviews').insert({ appointment_id: appointmentId, customer_id: user.id, rating: value, review_text: String(reviewText || '').trim() }).select('id').single(), 'Could not submit your review.');
  return { success: true, review_id: data.id };
}

export async function updateCustomerProfile({ firstName, lastName, phone, newPassword }) {
  const client = requireSupabase();
  const user = (await client.auth.getUser()).data.user;
  if (!user) throw Object.assign(new Error('Not logged in'), { status: 401 });
  if (!String(firstName || '').trim() || String(firstName).length > 100 || String(lastName || '').length > 100 || String(phone || '').length > 50) return { success: false, error: 'Please check the profile field lengths.' };
  unwrap(await client.from('profiles').update({ first_name: String(firstName).trim(), last_name: String(lastName || '').trim(), phone: String(phone).trim() }).eq('id', user.id), 'Could not update your profile.');
  if (newPassword) {
    if (String(newPassword).length < 8) return { success: false, error: 'New password must be at least 8 characters.' };
    unwrap(await client.auth.updateUser({ password: String(newPassword) }), 'Could not update your password.');
  }
  return { success: true, message: 'Profile updated.' };
}

/* ── Race-safe booking ───────────────────────────────────────── */
export async function getAvailableSlots(date, durationMinutes) {
  const data = unwrap(await requireSupabase().rpc('get_available_slots', { p_date: date, p_duration_minutes: Number(durationMinutes) }), 'Could not load availability.');
  return (data || []).map((row) => ({ time: row.time, available: !!row.available }));
}

export async function createAppointment({ serviceIds, date, time }) {
  const cleanIds = [...new Set((serviceIds || []).map(String))].filter((id) => /^[a-z0-9][a-z0-9_-]{0,49}$/i.test(id));
  if (!cleanIds.length || cleanIds.length > 8 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)$/i.test(time)) return { success: false, error: 'Invalid appointment details.' };
  try {
    const rows = unwrap(await requireSupabase().rpc('book_appointment', { p_service_ids: cleanIds, p_date: date, p_time: time }), 'Could not place the booking.');
    const row = rows?.[0];
    if (!row) return { success: false, error: 'Could not place the booking.' };
    return { success: true, appointment_id: row.reference_no, appointment_uuid: row.appointment_id, total_price: Number(row.total_price), total_duration_minutes: row.total_duration_minutes };
  } catch (error) {
    return { success: false, error: /no longer available|exclusion|overlap/i.test(error.message) ? 'That slot is no longer available.' : error.message };
  }
}
