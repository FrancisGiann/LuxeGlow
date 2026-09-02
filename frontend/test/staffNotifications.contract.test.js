import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = resolve(projectRoot, 'supabase/migrations/20260902000000_staff_notifications.sql');
const mirrorPath = resolve(projectRoot, 'database/supabase/migrations/20260902000000_staff_notifications.sql');
const bellPath = resolve(projectRoot, 'frontend/src/components/admin/StaffNotificationBell.jsx');
const migration = readFileSync(migrationPath, 'utf8');
const bell = readFileSync(bellPath, 'utf8');

test('staff notification migration keeps recipient isolation and insert-only delivery', () => {
  assert.match(migration, /create table if not exists public\.staff_notifications/i);
  assert.match(migration, /recipient_id uuid not null references public\.profiles\(id\)/i);
  assert.match(migration, /constraint staff_notifications_recipient_appointment_type_key unique \(recipient_id, appointment_id, type\)/i);
  assert.match(migration, /constraint staff_notifications_type_check check \(type in \('new_booking'\)\)/i);
  assert.match(migration, /alter table public\.staff_notifications enable row level security/i);
  assert.match(migration, /using \(recipient_id = auth\.uid\(\) and public\.is_staff\(\)\)/i);
  assert.match(migration, /grant select, update \(is_read\) on public\.staff_notifications to authenticated/i);
  assert.match(migration, /create trigger appointments_enqueue_staff_notifications after insert on public\.appointments/i);
  assert.match(migration, /session_user in \('postgres', 'supabase_admin'\)/i);
  assert.match(migration, /alter publication supabase_realtime add table public\.staff_notifications/i);
});

test('database migration mirror stays byte-for-byte identical', () => {
  assert.equal(readFileSync(mirrorPath, 'utf8'), migration);
});

test('staff notification bell uses non-modal disclosure semantics', () => {
  assert.match(bell, /aria-expanded=\{open\}/);
  assert.match(bell, /aria-controls=\{NOTIFICATION_PANEL_ID\}/);
  assert.match(bell, /id=\{NOTIFICATION_PANEL_ID\} role="region" aria-labelledby=\{NOTIFICATION_HEADING_ID\}/);
  assert.doesNotMatch(bell, /role="dialog"|aria-haspopup="dialog"/);
});
