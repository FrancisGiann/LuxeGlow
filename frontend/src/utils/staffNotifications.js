export const STAFF_NOTIFICATION_LIMIT = 30;

export function formatStaffNotificationTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function normalizeStaffNotification(row) {
  if (!row || row.id === undefined || row.id === null) return null;
  const createdAt = String(row.created_at || '');
  return {
    id: Number(row.id),
    recipient_id: row.recipient_id || null,
    appointment_id: row.appointment_id || null,
    type: String(row.type || ''),
    title: String(row.title || 'New appointment request'),
    message: String(row.message || ''),
    is_read: !!row.is_read,
    created_at: formatStaffNotificationTimestamp(createdAt),
    created_at_iso: createdAt,
  };
}

function notificationSortValue(notification) {
  const timestamp = Date.parse(notification?.created_at_iso || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mergeStaffNotifications(current, incoming) {
  const byId = new Map();
  [...(Array.isArray(current) ? current : []), ...(Array.isArray(incoming) ? incoming : [])].forEach((row) => {
    const notification = normalizeStaffNotification(row);
    if (!notification || !Number.isSafeInteger(notification.id) || notification.id < 1) return;
    const existing = byId.get(notification.id);
    byId.set(notification.id, existing ? { ...existing, ...notification, is_read: existing.is_read || notification.is_read } : notification);
  });
  return [...byId.values()]
    .sort((a, b) => notificationSortValue(b) - notificationSortValue(a) || b.id - a.id)
    .slice(0, STAFF_NOTIFICATION_LIMIT);
}
