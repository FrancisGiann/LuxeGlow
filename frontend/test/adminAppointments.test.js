import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appointmentFilterPreset,
  appointmentQueueEmptyMessage,
  createInitialAppointmentFilters,
  getAdminAppointmentQueue,
  initialAdminTab,
  manilaDateKey,
} from '../src/utils/adminAppointments.js';

test('appointment defaults use the current Asia/Manila date and show every status', () => {
  const justAfterManilaMidnight = new Date('2026-09-12T16:05:00.000Z');
  assert.equal(manilaDateKey(justAfterManilaMidnight), '2026-09-13');
  assert.deepEqual(createInitialAppointmentFilters(justAfterManilaMidnight), {
    date: '2026-09-13',
    status: 'all',
    search: '',
  });
  assert.equal(initialAdminTab('staff'), 'appointments');
  assert.equal(initialAdminTab('admin'), 'overview');
});

test('appointment search is case-insensitive across reference, customer, service, and assigned staff fields', () => {
  const appointment = {
    reference_no: 'AST-1042',
    customer: { first_name: 'Mae', last_name: 'Santos', email: 'mae@example.com', phone: '+639171234567' },
    services: [{ service_name: 'Gel Manicure' }],
    staff: { first_name: 'Rina', last_name: 'Lopez' },
  };
  for (const search of ['ast-1042', 'MAE', 'SANTOS', 'MAE@EXAMPLE.COM', '+639171234567', 'gel manicure', 'rina lopez']) {
    assert.deepEqual(getAdminAppointmentQueue([appointment], { date: '', status: 'all', search }), [appointment], search);
  }
  assert.deepEqual(getAdminAppointmentQueue([appointment], { search: 'not present' }), []);
});

test('date and status filters compose without changing the all-dates API order', () => {
  const newest = { id: 'newest', local_date: '2026-09-13', status: 'Pending' };
  const older = { id: 'older', local_date: '2026-09-12', status: 'Pending' };
  const confirmed = { id: 'confirmed', local_date: '2026-09-13', status: 'Confirmed' };
  const apiOrder = [newest, older, confirmed];
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, { date: '', status: 'all' }), apiOrder);
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, { date: '', status: 'Pending' }), [newest, older]);
  assert.deepEqual(getAdminAppointmentQueue(apiOrder, { date: '2026-09-13', status: 'Pending' }), [newest]);
});

test('selected-day queues sort valid local times and preserve source order for ties and invalid times', () => {
  const late = { id: 'late', local_date: '2026-09-13', reference_no: 'REF-C', local_time: '11:30:00' };
  const tiedIdB = { id: 'b', local_date: '2026-09-13', reference_no: 'REF-A', local_time: '10:00:00' };
  const tiedIdA = { id: 'a', local_date: '2026-09-13', reference_no: 'REF-A', local_time: '10:00' };
  const earlierReference = { id: 'z', local_date: '2026-09-13', reference_no: 'REF-B', local_time: '10:00:00' };
  const laterSeconds = { id: 'later-seconds', local_date: '2026-09-13', local_time: '10:00:30' };
  const earlierSeconds = { id: 'earlier-seconds', local_date: '2026-09-13', local_time: '10:00:05' };
  const malformed = { id: 'invalid', local_date: '2026-09-13', reference_no: 'REF-0', local_time: 'not-a-time' };
  const missingTime = { id: 'missing', local_date: '2026-09-13', reference_no: 'REF-1' };
  const source = [late, tiedIdB, malformed, earlierReference, laterSeconds, tiedIdA, earlierSeconds, missingTime];
  const before = source.slice();
  const visible = getAdminAppointmentQueue(source, { date: '2026-09-13', status: 'all' });
  assert.deepEqual(visible, [tiedIdB, earlierReference, tiedIdA, earlierSeconds, laterSeconds, late, malformed, missingTime]);
  assert.deepEqual(source, before);
});

test('null, malformed, or missing appointment fields are safe to filter', () => {
  const partial = { id: 'partial', local_date: '2026-09-13', status: 'Pending', services: null, customer: null, staff: null };
  assert.deepEqual(getAdminAppointmentQueue(null, { date: '', status: 'all' }), []);
  assert.deepEqual(getAdminAppointmentQueue([null, undefined, {}, partial], null), [{}, partial]);
  assert.deepEqual(getAdminAppointmentQueue([partial], { date: '2026-09-13', status: 'Pending', search: 'partial' }), []);
  assert.deepEqual(getAdminAppointmentQueue([partial], { date: '2026-09-13', status: 'Pending' }), [partial]);
});

test('an appointment preset clears other filters and keeps its target visible', () => {
  const target = { id: 'target', reference_no: 'A-1', local_date: '2026-09-11', status: 'Completed' };
  const other = { id: 'other', local_date: '2026-09-13', status: 'Pending' };
  const filters = appointmentFilterPreset('appointment', '2026-09-13', target);
  assert.deepEqual(filters, { date: '2026-09-11', status: 'all', search: '' });
  assert.deepEqual(getAdminAppointmentQueue([other, target], filters), [target]);
  assert.deepEqual(appointmentFilterPreset('appointment', '2026-09-13', { local_date: 'bad-date' }), { date: '', status: 'all', search: '' });
});

test('empty queue copy reflects active filters', () => {
  assert.equal(appointmentQueueEmptyMessage(0, {}), 'No appointments yet.');
  assert.equal(appointmentQueueEmptyMessage(0, { date: '2026-09-13', status: 'all', search: '' }), 'No appointments match these filters.');
});
