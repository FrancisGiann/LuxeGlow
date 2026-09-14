import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const readBuffer = (path) => readFileSync(resolve(projectRoot, path));
const migrationPath = 'supabase/migrations/20260914000000_reconcile_expired_pending_appointments.sql';
const mirroredMigrationPath = 'database/supabase/migrations/20260914000000_reconcile_expired_pending_appointments.sql';
const migration = read(migrationPath).toLowerCase();
const initialMigration = read('supabase/migrations/20260827000000_initial.sql').toLowerCase();
const dashboardApi = read('frontend/src/api/endpoints.js');
const adminApi = read('frontend/src/api/admin.js');

test('reconciliation migration is mirrored byte-for-byte', () => {
  assert.deepEqual(readBuffer(migrationPath), readBuffer(mirroredMigrationPath));
});

test('reconciliation RPC is zero-argument, authenticated, active-profile scoped, and idempotent', () => {
  assert.match(migration, /create or replace function public\.reconcile_expired_pending_appointments\(\)\s+returns integer\s+language plpgsql\s+security definer\s+set search_path = public/);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /from public\.profiles p\s+where p\.id = v_user_id\s+and p\.is_active = true/);
  assert.match(migration, /if not found then\s+raise exception 'active profile required' using errcode = '42501'/);
  assert.match(migration, /update public\.appointments\s+set status = 'cancelled'\s+where status = 'pending'\s+and start_at < now\(\) - interval '15 minutes'\s+and \(v_role in \('staff', 'admin'\) or customer_id = v_user_id\)/);
  assert.match(migration, /get diagnostics v_cancelled = row_count/);
  assert.match(migration, /return v_cancelled/);
  assert.match(migration, /revoke all on function public\.reconcile_expired_pending_appointments\(\) from public, anon, service_role/);
  assert.match(migration, /grant execute on function public\.reconcile_expired_pending_appointments\(\) to authenticated/);
  assert.doesNotMatch(migration, /reconcile_expired_pending_appointments\(\s*[^)]/, 'the RPC must not accept caller-supplied arguments');
  assert.doesNotMatch(migration, /\bp_now\b|\bp_user_id\b/, 'the RPC must use its authenticated identity and database clock');
  assert.doesNotMatch(migration, /insert into public\.(user_notifications|notification_outbox)/, 'the existing appointment status trigger owns notification side effects');
});

test('the existing appointment status trigger writes customer notification and outbox records', () => {
  assert.match(initialMigration, /create trigger appointments_enqueue_notification after insert or update of status on public\.appointments\s+for each row execute function public\.enqueue_appointment_notification\(\)/);
  const notificationFunction = initialMigration.match(/create or replace function public\.enqueue_appointment_notification\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/)?.[1] || '';
  assert.match(notificationFunction, /insert into public\.user_notifications/);
  assert.match(notificationFunction, /insert into public\.notification_outbox/);
});

test('customer dashboard reconciles after role validation and before appointment/notification queries', () => {
  const dashboard = dashboardApi.slice(dashboardApi.indexOf('export async function getDashboard()'), dashboardApi.indexOf('export async function markNotificationRead'));
  const roleCheck = dashboard.indexOf("session.customer?.role !== 'customer'");
  const reconciliation = dashboard.indexOf("client.rpc('reconcile_expired_pending_appointments')");
  const queries = dashboard.indexOf('const [profileResult, appointmentsResult, notificationsResult, appointmentStaffResult]');
  assert.ok(roleCheck >= 0 && reconciliation > roleCheck && queries > reconciliation);
  assert.match(dashboard, /unwrap\([\s\S]*?client\.rpc\('reconcile_expired_pending_appointments'\)[\s\S]*?'Could not refresh expired appointments/);
});

test('staff appointments reconcile after staff validation and before appointment queries', () => {
  const listAppointments = adminApi.slice(adminApi.indexOf('export async function listAdminAppointments()'), adminApi.indexOf('export async function updateAppointmentStatus'));
  const staffValidation = listAppointments.indexOf('await assertStaff()');
  const reconciliation = listAppointments.indexOf("client.rpc('reconcile_expired_pending_appointments')");
  const queries = listAppointments.indexOf('const [appointmentResult, aggregateResult]');
  assert.ok(staffValidation >= 0 && reconciliation > staffValidation && queries > reconciliation);
  assert.match(listAppointments, /throwIfError\([\s\S]*?client\.rpc\('reconcile_expired_pending_appointments'\)[\s\S]*?'Could not refresh expired appointments/);
});
