import assert from 'node:assert/strict';
import test from 'node:test';
import { loadStaffAvailability, staffAvailabilityKey, staffChoiceState } from '../src/utils/staffAvailability.js';

const staff = [{ id: 'a' }, { id: 'b' }];
test('uses server slot booleans for the full duration without exposing appointments', async () => {
  const calls = [];
  const available = await loadStaffAvailability(staff, '2026-11-01', '11:00 AM', 90, async (...args) => {
    calls.push(args);
    return [{ time: '11:00 AM', available: args[2] === 'b' }, { time: '11:30 AM', available: true }];
  });
  assert.deepEqual(available, { a: false, b: true });
  assert.deepEqual(calls, [['2026-11-01', 90, 'a'], ['2026-11-01', 90, 'b']]);
  assert.deepEqual(staffChoiceState('a', { status: 'ready', available }, true), { disabled: true, label: 'Not available at this time' });
  assert.equal(staffChoiceState('b', { status: 'ready', available }, true).disabled, false);
});
test('loading, failed checks and missing staff fail closed; pre-time preference is allowed', async () => {
  for (const status of ['loading', 'error', 'idle']) assert.equal(staffChoiceState('a', { status }, true).disabled, true);
  assert.equal(staffChoiceState('removed', { status: 'ready', available: {} }, true).disabled, true);
  assert.equal(staffChoiceState('a', { status: 'idle' }, false).disabled, false);
  await assert.rejects(loadStaffAvailability(staff, '2026-11-01', '11:00 AM', 30, async () => { throw new Error('offline'); }), /offline/);
});
test('date, time, duration and service changes invalidate snapshots, independent of browser timezone', () => {
  const args = ['2026-11-01', '11:00 AM', 30, ['short']];
  const key = staffAvailabilityKey(...args);
  for (const change of [ ['2026-11-02', args[1], 30, args[3]], [args[0], '11:30 AM', 30, args[3]], [args[0], args[1], 90, args[3]], [args[0], args[1], 30, ['another']] ]) {
    assert.notEqual(staffAvailabilityKey(...change), key);
  }
  assert.equal(staffAvailabilityKey(args[0], args[1], 30, ['b', 'a']), staffAvailabilityKey(args[0], args[1], 30, ['a', 'b']));
});

test('a stale roster member becoming inactive does not disable available colleagues', async () => {
  const available = await loadStaffAvailability(staff, '2026-11-01', '11:00 AM', 30, async (_date, _duration, id) => {
    if (id === 'a') throw new Error('Choose an available team member');
    return [{ time: '11:00 AM', available: true }];
  });
  assert.deepEqual(available, { a: false, b: true });
});
