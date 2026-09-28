import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canRecordAppointmentArrival,
  findDueNoShowAppointment,
} from '../src/utils/noShowAppointments.js';

const now = Date.parse('2026-09-28T04:15:00.000Z');

test('arrival can be recorded any time on the scheduled Manila calendar date', () => {
  const arrivalNow = Date.parse('2026-09-27T16:15:00.000Z');
  const confirmed = { status: 'Confirmed', start_at: '2026-09-28T23:30:00+08:00' };
  assert.equal(canRecordAppointmentArrival(confirmed, arrivalNow), true);
  assert.equal(canRecordAppointmentArrival(confirmed, new Date(arrivalNow)), true);
  assert.equal(
    canRecordAppointmentArrival(confirmed, Date.parse('2026-09-27T15:59:59.999Z')),
    false,
  );
  assert.equal(
    canRecordAppointmentArrival(confirmed, Date.parse('2026-09-28T16:00:00.000Z')),
    false,
  );
  assert.equal(canRecordAppointmentArrival({ ...confirmed, status: 'Pending' }, now), false);
  assert.equal(canRecordAppointmentArrival({ ...confirmed, arrived_at: '2026-09-28T04:14:00Z' }, now), false);
  assert.equal(canRecordAppointmentArrival({ ...confirmed, start_at: 'invalid' }, now), false);
});

test('no-show prompt becomes due exactly 15 minutes after the stored start instant', () => {
  const appointment = { id: 'due', status: 'Confirmed', start_at: '2026-09-28T04:00:00.000Z' };
  assert.equal(findDueNoShowAppointment([appointment], now), appointment);
  assert.equal(findDueNoShowAppointment([appointment], now - 1), null);
});

test('no-show candidates exclude pending, terminal, arrived, reviewed, and invalid timestamps', () => {
  const candidates = [
    null,
    { id: 'pending', status: 'Pending', start_at: '2026-09-28T03:00:00Z' },
    { id: 'completed', status: 'Completed', start_at: '2026-09-28T03:00:00Z' },
    { id: 'cancelled', status: 'Cancelled', start_at: '2026-09-28T03:00:00Z' },
    { id: 'arrived', status: 'Confirmed', arrived_at: '2026-09-28T03:01:00Z', start_at: '2026-09-28T03:00:00Z' },
    { id: 'reviewed', status: 'Confirmed', no_show_reviewed_at: '2026-09-28T03:20:00Z', start_at: '2026-09-28T03:00:00Z' },
    { id: 'invalid', status: 'Confirmed', start_at: 'invalid' },
  ];
  assert.equal(findDueNoShowAppointment(candidates, now), null);
});

test('only the oldest due no-show appointment is offered at a time', () => {
  const earlier = { id: 'earlier', status: 'Confirmed', start_at: '2026-09-28T03:00:00.000Z' };
  const later = { id: 'later', status: 'Confirmed', start_at: '2026-09-28T03:30:00.000Z' };
  assert.equal(findDueNoShowAppointment([later, earlier], now), earlier);
  assert.equal(findDueNoShowAppointment(null, now), null);
});
