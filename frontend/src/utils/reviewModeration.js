import { normalizeReviewRating } from './reviewRatings.js';

function relatedRecord(value) {
  if (Array.isArray(value)) return value[0] && typeof value[0] === 'object' ? value[0] : null;
  return value && typeof value === 'object' ? value : null;
}

function displayName(profile, fallback) {
  const name = [profile?.first_name, profile?.last_name]
    .filter((part) => typeof part === 'string')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
  return name || fallback;
}

export function normalizeReviewModerationId(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function normalizeReviewModerationRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const id = normalizeReviewModerationId(row.id);
  const rating = normalizeReviewRating(row.rating);
  if (id === null || rating === null || typeof row.is_published !== 'boolean') return null;

  const customer = relatedRecord(row.profiles);
  const appointment = relatedRecord(row.appointments);
  const staff = relatedRecord(appointment?.staff);
  const services = Array.isArray(appointment?.appointment_services)
    ? appointment.appointment_services
      .map((service) => typeof service?.service_name === 'string' ? service.service_name.trim() : '')
      .filter(Boolean)
    : [];

  return {
    id,
    rating,
    staff_rating: row.staff_rating == null ? null : normalizeReviewRating(row.staff_rating),
    is_published: row.is_published,
    review_text: typeof row.review_text === 'string' ? row.review_text : '',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    customer_name: displayName(customer, 'Customer'),
    appointment_date: typeof appointment?.local_date === 'string' ? appointment.local_date : '',
    appointment_time: typeof appointment?.local_time === 'string' ? appointment.local_time.slice(0, 5) : '',
    staff_name: appointment?.staff_id ? displayName(staff, 'Assigned team member') : 'Unassigned',
    service_names: services.length ? services.join(', ') : 'Beauty service',
  };
}

export function normalizeReviewModerationRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeReviewModerationRow)
    .filter(Boolean);
}

export function isValidReviewPublicationUpdate(reviewId, isPublished) {
  return normalizeReviewModerationId(reviewId) !== null && typeof isPublished === 'boolean';
}
