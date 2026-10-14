import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAFF_NOTIFICATION_LIMIT,
  formatStaffNotificationTimestamp,
  mergeStaffNotifications,
  normalizeStaffNotification,
} from '../src/utils/staffNotifications.js';

test('normalizes staff notification timestamps consistently for Manila', () => {
  const notification = normalizeStaffNotification({
    id: 7,
    type: 'new_booking',
    title: 'New appointment request',
    message: 'Booking received.',
    created_at: '2026-09-02T04:30:00.000Z',
    is_read: 1,
  });
  assert.equal(notification.id, 7);
  assert.equal(notification.is_read, true);
  assert.equal(notification.created_at, 'Sep 2, 2026, 12:30 PM');
  assert.equal(formatStaffNotificationTimestamp('not-a-date'), 'Date unavailable');
});

test('merges realtime rows without duplicates, preserves read state, and caps the feed', () => {
  const current = Array.from({ length: STAFF_NOTIFICATION_LIMIT }, (_, index) => ({
    id: index + 1,
    type: 'new_booking',
    title: `Booking ${index + 1}`,
    message: 'Received.',
    created_at: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
    is_read: index === 1,
  }));
  const merged = mergeStaffNotifications(current, [
    { ...current[1], is_read: false },
    { id: 100, type: 'new_booking', title: 'Newest', message: 'Received.', created_at: '2026-09-03T00:00:00Z' },
  ]);
  assert.equal(merged.length, STAFF_NOTIFICATION_LIMIT);
  assert.equal(merged[0].id, 100);
  assert.equal(merged.some((row) => row.id === 2 && row.is_read), true);
  assert.equal(new Set(merged.map((row) => row.id)).size, STAFF_NOTIFICATION_LIMIT);
});

test('a newer customer reschedule refresh reopens the existing notification as unread', () => {
  const current = [{
    id: 9,
    type: 'customer_rescheduled',
    title: 'Customer rescheduled an appointment',
    message: 'Appointment LG-1 was moved to Sep 3.',
    created_at: '2026-09-03T00:00:00.000Z',
    is_read: true,
  }];
  const refreshed = {
    ...current[0],
    message: 'Appointment LG-1 was moved to Sep 4.',
    created_at: '2026-09-04T00:00:00.000Z',
    is_read: false,
  };

  const merged = mergeStaffNotifications(current, [refreshed]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].message, refreshed.message);
  assert.equal(merged[0].is_read, false);

  const staleFetch = mergeStaffNotifications(merged, [{ ...current[0], is_read: true }]);
  assert.equal(staleFetch[0].message, refreshed.message);
  assert.equal(staleFetch[0].is_read, false);
});
