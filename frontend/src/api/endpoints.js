import { apiGet, apiPost } from './client';

/* ── Auth ─────────────────────────────────────────────────────── */
export const checkSession = () => apiGet('includes/auth/session_check.php');
export const loginCustomer = (email, password) =>
  apiPost('includes/auth/login.php', { email, password });
export const loginStaff = (username, password) =>
  apiPost('includes/admin-auth/login.php', { username, password });
export const registerCustomer = (fields) =>
  apiPost('includes/auth/register.php', fields);
export const verifyOtp = (otp) => apiPost('includes/auth/verify.php', { otp });
export const resendOtp = () => apiPost('includes/auth/resend_otp.php');
export const requestPasswordReset = (email) =>
  apiPost('includes/auth/request_password_reset.php', { email });
export const completePasswordReset = ({ email, code, password, confirmPassword }) =>
  apiPost('includes/auth/complete_password_reset.php', {
    email,
    code,
    password,
    confirm_password: confirmPassword,
  });
export const logoutCustomer = () => apiPost('includes/auth/logout.php');

/* ── Public marketing content ─────────────────────────────────── */
export const getServices = () => apiGet('includes/services/list.php');
export const getReviews = () => apiGet('includes/reviews/list.php');
export const getFaqs = () => apiGet('includes/faqs/list.php');
export const getAbout = () => apiGet('includes/about/get.php');

/* ── Customer dashboard (single aggregated payload) ───────────── */
export const getDashboard = () => apiGet('includes/customers/my_dashboard.php');

/* ── Notifications ────────────────────────────────────────────── */
export const markNotificationRead = (notificationId) =>
  apiPost('includes/notifications/mark_read.php', { notification_id: notificationId });
export const markAllNotificationsRead = () =>
  apiPost('includes/notifications/mark_read.php', { mark_all: '1' });

/* ── Reviews ──────────────────────────────────────────────────── */
export const getRatableAppointments = () => apiGet('includes/reviews/ratable.php');
export const createReview = (appointmentId, rating, reviewText) =>
  apiPost('includes/reviews/create.php', {
    appointment_id: appointmentId,
    rating,
    review_text: reviewText,
  });

/* ── Profile ──────────────────────────────────────────────────── */
export const updateCustomerProfile = ({ firstName, lastName, phone, newPassword }) =>
  apiPost('includes/customers/update_profile.php', {
    first_name: firstName,
    last_name: lastName,
    phone,
    ...(newPassword ? { new_password: newPassword } : {}),
  });

/* ── Booking ──────────────────────────────────────────────────── */
export const getAvailableSlots = (date, durationMinutes) =>
  apiGet(`includes/appointments/available_slots.php?date=${encodeURIComponent(date)}&duration_minutes=${durationMinutes}`);

/** Mirrors the legacy payload exactly — create.php processes it unchanged. */
export const createAppointment = ({ serviceIds, date, time }) =>
  apiPost('includes/appointments/create.php', {
    service_ids: JSON.stringify(serviceIds),
    date,
    time,
  });
