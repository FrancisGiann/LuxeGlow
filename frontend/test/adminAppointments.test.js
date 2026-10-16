import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appointmentFilterPreset,
  appointmentQueueEmptyMessage,
  createInitialAppointmentFilters,
  getAdminAppointmentQueue,
  getAppointmentStaffName,
  manilaDateKey,
} from '../src/utils/adminAppointments.js';

test('Appointments defaults to all dates and History defaults to Completed', () => {
  const justAfterManilaMidnight = new Date('2026-09-12T16:05:00.000Z');
  assert.equal(manilaDateKey(justAfterManilaMidnight), '2026-09-13');
  assert.deepEqual(createInitialAppointmentFilters(), {
    date: '',
    status: 'Pending',
    search: '',
  });
  assert.deepEqual(appointmentFilterPreset('today', '2026-09-13'), {
    date: '2026-09-13',
    status: 'Pending',
    search: '',
  });
  assert.deepEqual(appointmentFilterPreset('appointments'), {
    date: '',
    status: 'Pending',
    search: '',
  });
  assert.deepEqual(appointmentFilterPreset('history'), { date: '', status: 'Completed', search: '' });
});

test('appointment staff labels use new roster identities and preserve legacy history', () => {
  assert.equal(getAppointmentStaffName({ staff_name: '  Jhona Hael Amparado  ', staff_id: 'roster-id' }), 'Jhona Hael Amparado');
  assert.equal(getAppointmentStaffName({ staff_member_id: 'roster-id', staff_member: { full_name: 'Jen Reyes' } }), 'Jen Reyes');
  assert.equal(getAppointmentStaffName({ staff_id: 'legacy-id', staff: [{ first_name: 'Sam', last_name: 'Lee' }] }), 'Sam Lee');
  assert.equal(getAppointmentStaffName({}), 'Unassigned');
});

test('appointment search is case-insensitive across reference, customer, service, and assigned staff fields', () => {
  const appointment = {
    reference_no: 'AST-1042',
    status: 'Confirmed',
    customer: { first_name: 'Mae', last_name: 'Santos', email: 'mae@example.com', phone: '+639171234567' },
    services: [{ service_name: 'Gel Manicure' }],
    staff: { first_name: 'Rina', last_name: 'Lopez' },
  };
  for (const search of ['ast-1042', 'MAE', 'SANTOS', 'MAE@EXAMPLE.COM', '+639171234567', 'gel manicure', 'rina lopez']) {
    assert.deepEqual(getAdminAppointmentQueue([appointment], { date: '', status: 'Confirmed', search }), [appointment], search);
  }
  assert.deepEqual(getAdminAppointmentQueue([appointment], { search: 'not present' }), []);
});

test('Appointments always combines Pending and Confirmed, ignores stale status, and sorts by local schedule', () => {
  const newest = { id: 'newest', local_date: '2026-09-13', local_time: '11:00', status: 'Pending' };
  const overdue = { id: 'overdue', local_date: '2026-09-12', local_time: '12:00', status: 'Pending' };
  const confirmed = { id: 'confirmed', local_date: '2026-09-10', local_time: '10:00', status: 'Confirmed' };
  const completed = { id: 'completed', local_date: '2026-09-11', local_time: '09:00', status: 'Completed' };
  const cancelled = { id: 'cancelled', local_date: '2026-09-09', local_time: '09:00', status: 'Cancelled' };
  const apiOrder = [newest, overdue, confirmed, completed, cancelled];
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, createInitialAppointmentFilters()), [confirmed, overdue, newest]);
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, { date: '', status: 'Completed' }), [confirmed, overdue, newest]);
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, { date: '', status: 'Cancelled' }), [confirmed, overdue, newest]);
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, { date: '2026-09-13', status: 'Completed' }), [newest]);
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, { date: '', status: 'Confirmed' }, 'history'), [confirmed]);
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, { date: '', status: 'Completed' }, 'history'), [completed]);
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, { date: '', status: 'Cancelled' }, 'history'), [cancelled]);
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, { date: '2026-09-13', status: 'Pending' }, 'history'), [newest]);
  assert.deepEqual(appointmentFilterPreset('history'), { date: '', status: 'Completed', search: '' });
  assert.deepEqual(appointmentFilterPreset('today', '2026-09-13'), { date: '2026-09-13', status: 'Pending', search: '' });
});

test('selected-day queues sort valid local times and preserve source order for ties and invalid times', () => {
  const late = { id: 'late', local_date: '2026-09-13', reference_no: 'REF-C', local_time: '11:30:00', status: 'Pending' };
  const tiedIdB = { id: 'b', local_date: '2026-09-13', reference_no: 'REF-A', local_time: '10:00:00', status: 'Pending' };
  const tiedIdA = { id: 'a', local_date: '2026-09-13', reference_no: 'REF-A', local_time: '10:00', status: 'Pending' };
  const earlierReference = { id: 'z', local_date: '2026-09-13', reference_no: 'REF-B', local_time: '10:00:00', status: 'Pending' };
  const laterSeconds = { id: 'later-seconds', local_date: '2026-09-13', local_time: '10:00:30', status: 'Pending' };
  const earlierSeconds = { id: 'earlier-seconds', local_date: '2026-09-13', local_time: '10:00:05', status: 'Pending' };
  const malformed = { id: 'invalid', local_date: '2026-09-13', reference_no: 'REF-0', local_time: 'not-a-time', status: 'Pending' };
  const missingTime = { id: 'missing', local_date: '2026-09-13', reference_no: 'REF-1', status: 'Pending' };
  const source = [late, tiedIdB, malformed, earlierReference, laterSeconds, tiedIdA, earlierSeconds, missingTime];
  const before = source.slice();
  const visible = getAdminAppointmentQueue(source, { date: '2026-09-13', status: 'Completed' });
  assert.deepEqual(visible, [tiedIdA, tiedIdB, earlierReference, earlierSeconds, laterSeconds, late, malformed, missingTime]);
  assert.deepEqual(source, before);
});

test('null, malformed, or missing appointment fields are safe to filter', () => {
  const partial = { id: 'partial', local_date: '2026-09-13', status: 'Pending', services: null, customer: null, staff: null };
  assert.deepEqual(getAdminAppointmentQueue(null, { date: '', status: 'Pending' }), []);
  assert.deepEqual(getAdminAppointmentQueue([null, undefined, {}, partial], { status: 'Cancelled' }), [partial]);
  assert.deepEqual(getAdminAppointmentQueue([partial], { date: '2026-09-13', status: 'Completed', search: 'partial' }), []);
  assert.deepEqual(getAdminAppointmentQueue([partial], { date: '2026-09-13', status: 'Cancelled' }), [partial]);
});

test('an appointment preset clears other filters and keeps its target visible', () => {
  const target = { id: 'target', reference_no: 'A-1', local_date: '2026-09-11', status: 'Completed' };
  const other = { id: 'other', local_date: '2026-09-13', status: 'Pending' };
  const filters = appointmentFilterPreset('appointment', '2026-09-13', target);
  assert.deepEqual(filters, { date: '', status: 'Completed', search: '' });
  assert.deepEqual(getAdminAppointmentQueue([other, target], filters, 'history'), [target]);
  assert.deepEqual(appointmentFilterPreset('appointment', '2026-09-13', { status: 'Unknown' }), { date: '', status: 'Pending', search: '' });
  const conflict = appointmentFilterPreset('conflict', '2026-09-13', { local_date: '2026-09-11', status: 'Confirmed', reference_no: 'A-2' });
  assert.deepEqual(conflict, { date: '2026-09-11', status: 'Confirmed', search: 'A-2' });
});

test('empty queue copy reflects active filters', () => {
  assert.equal(appointmentQueueEmptyMessage(0, {}), 'No appointments yet.');
  assert.equal(appointmentQueueEmptyMessage(0, { date: '', status: 'Completed', search: '' }, 'history'), 'No appointment history yet.');
  assert.equal(appointmentQueueEmptyMessage(5, { date: '', status: 'Completed', search: '' }, 'history'), 'No completed appointments yet.');
  assert.equal(appointmentQueueEmptyMessage(5, { date: '', status: 'Completed', search: '' }), 'No active appointments.');
  assert.equal(appointmentQueueEmptyMessage(5, { date: '', status: 'Cancelled', search: '' }), 'No active appointments.');
  assert.equal(appointmentQueueEmptyMessage(5, { date: '2026-09-13', status: 'Cancelled', search: '' }), 'No appointments match these filters.');
  assert.equal(appointmentQueueEmptyMessage(0, { date: '2026-09-13', status: 'Pending', search: '' }), 'No appointments match these filters.');
});
