import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const migration = read('supabase/migrations/20261009000000_enforce_appointment_status_transitions.sql');
const migrationMirror = read('database/supabase/migrations/20261009000000_enforce_appointment_status_transitions.sql');
const adminPage = read('frontend/src/pages/AdminPage.jsx');
const attendanceMigration = read('supabase/migrations/20260928000000_confirmed_appointment_attendance.sql');

test('database appointment status transitions match the staff UI and stay mirrored', () => {
  assert.equal(migrationMirror, migration);
  assert.match(adminPage, /Pending:\s*\[\s*\{ status: "Confirmed"[\s\S]*?\{ status: "Cancelled"/);
  assert.match(adminPage, /Confirmed:\s*\[\s*\{ status: "Completed"[\s\S]*?\{ status: "Cancelled"/);
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
