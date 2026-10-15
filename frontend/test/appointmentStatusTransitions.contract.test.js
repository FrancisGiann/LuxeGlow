import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdminAppointmentActions } from '../src/utils/adminAppointmentActions.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const migration = read('supabase/migrations/20261009000000_enforce_appointment_status_transitions.sql');
const migrationMirror = read('database/supabase/migrations/20261009000000_enforce_appointment_status_transitions.sql');
const attendanceMigration = read('supabase/migrations/20260928000000_confirmed_appointment_attendance.sql');

test('database appointment status transitions match the staff UI and stay mirrored', () => {
  assert.equal(migrationMirror, migration);
  assert.deepEqual(getAdminAppointmentActions('Pending'), [
    { status: 'Confirmed', label: 'Confirm', variant: 'primary' },
    { status: 'Cancelled', label: 'Cancel appointment', variant: 'secondary' },
  ]);
  assert.deepEqual(getAdminAppointmentActions('Confirmed'), [
    { status: 'Completed', label: 'Mark completed', variant: 'primary' },
    { status: 'Cancelled', label: 'Cancel appointment', variant: 'secondary' },
  ]);
  assert.deepEqual(getAdminAppointmentActions('Cancelled'), []);
  assert.match(migration, /old\.status = 'Pending' and new\.status in \('Confirmed', 'Cancelled'\)/);
  assert.match(migration, /old\.status = 'Confirmed' and new\.status in \('Completed', 'Cancelled'\)/);
  assert.match(migration, /Appointment status must follow the booking workflow/);
  assert.match(migration, /old\.status in \('Completed', 'Cancelled'\).*?cannot be reopened/s);
});

test('status protection preserves controlled customer reschedules and service-role maintenance', () => {
  assert.match(migration, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/);
  assert.match(migration, /current_setting\('app\.allow_customer_appointment_action', true\) is distinct from 'true'/);
  assert.match(attendanceMigration, /revoke update on public\.appointments from authenticated;\s*grant update \(status\) on public\.appointments to authenticated;/);
});
