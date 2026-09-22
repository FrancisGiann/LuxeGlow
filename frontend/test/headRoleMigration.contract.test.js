import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const migration = read('supabase/migrations/20260922000000_head_role_runtime.sql');
const bookingMigration = read('supabase/migrations/20260905000000_booking_schedule_staff_ratings.sql');
const notificationMigration = read('supabase/migrations/20260902000000_staff_notifications.sql');
const reconciliationMigration = read('supabase/migrations/20260914000000_reconcile_expired_pending_appointments.sql');
const roleMigration = read('supabase/migrations/20260918000000_simplify_roles.sql');

function functionDefinition(sql, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = sql.search(new RegExp(`create(?: or replace)? function public\\.${escapedName}\\(`, 'i'));
  assert.notEqual(start, -1, `missing function definition: ${name}`);
  const asBody = sql.indexOf('as $$', start);
  assert.notEqual(asBody, -1, `missing function body: ${name}`);
  const end = sql.indexOf('$$;', asBody);
  assert.notEqual(end, -1, `unterminated function body: ${name}`);
  return sql.slice(start, end + 3).trim();
}

function viewDefinition(sql, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sql.match(new RegExp(`create or replace view public\\.${escapedName} as[\\s\\S]*?;`, 'i'));
  assert.ok(match, `missing view definition: ${name}`);
  return match[0].trim();
}

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length - 1, 1, `expected exactly one role predicate: ${before}`);
  return source.replace(before, after);
}

function replaceEvery(source, before, after, expectedCount) {
  assert.equal(source.split(before).length - 1, expectedCount, `unexpected role predicate count: ${before}`);
  return source.replaceAll(before, after);
}

test('forward migration changes expired-appointment reconciliation to active head/admin access', () => {
  const original = functionDefinition(reconciliationMigration, 'reconcile_expired_pending_appointments');
  const updated = functionDefinition(migration, 'reconcile_expired_pending_appointments');
  assert.equal(updated, replaceOnce(original, "v_role in ('staff', 'admin')", "v_role in ('head', 'admin')"));
  assert.match(updated, /p\.is_active = true/);
  assert.match(updated, /or customer_id = v_user_id/);
  assert.match(migration, /revoke all on function public\.reconcile_expired_pending_appointments\(\) from public, anon, service_role;\s*grant execute on function public\.reconcile_expired_pending_appointments\(\) to authenticated;/i);
});

test('new-booking notifications target active heads and admins without changing trigger safeguards', () => {
  const original = functionDefinition(notificationMigration, 'enqueue_staff_booking_notifications');
  const updated = functionDefinition(migration, 'enqueue_staff_booking_notifications');
  assert.equal(updated, replaceOnce(original, "p.role in ('staff', 'admin')", "p.role in ('head', 'admin')"));
  assert.match(updated, /session_user in \('postgres', 'supabase_admin'\)/);
  assert.match(updated, /coalesce\(auth\.role\(\), ''\) = 'service_role'/);
  assert.match(updated, /p\.is_active = true/);
  assert.match(updated, /p\.role in \('head', 'admin'\)/);
  assert.match(updated, /on conflict \(recipient_id, appointment_id, type\) do nothing/i);
  assert.match(migration, /revoke all on function public\.enqueue_staff_booking_notifications\(\) from public;/i);
});

test('rating view and staff-only aggregates retain inactive customer roster entries', () => {
  const originalView = viewDefinition(bookingMigration, 'published_staff_aggregates');
  const updatedView = viewDefinition(migration, 'published_staff_aggregates');
  const rosterPredicate = `where a.staff_id is not null
   and (
     (p.role in ('head', 'admin') and p.is_active)
     or (p.role = 'customer' and not p.is_active and p.position_title is not null)
   )`;
  assert.equal(
    updatedView,
    replaceOnce(originalView, "where a.staff_id is not null and p.role in ('staff', 'admin') and p.is_active", rosterPredicate),
  );

  const originalRatings = functionDefinition(bookingMigration, 'get_staff_rating_aggregates');
  const updatedRatings = functionDefinition(migration, 'get_staff_rating_aggregates');
  const ratingRosterPredicate = `where (p.role in ('head', 'admin') and p.is_active)
      or (p.role = 'customer' and not p.is_active and p.position_title is not null)`;
  assert.equal(
    updatedRatings,
    replaceOnce(originalRatings, "where p.role in ('staff', 'admin')", ratingRosterPredicate),
  );
  assert.match(updatedRatings, /if not public\.is_staff\(\) then raise exception 'Staff access required'/);
  assert.match(updatedRatings, /stable\s+security definer\s+set search_path = public, pg_temp/i);
  assert.match(migration, /revoke all on public\.published_staff_aggregates from public, anon, authenticated;/i);
  assert.match(migration, /revoke all on function public\.get_staff_rating_aggregates\(\) from public;\s*grant execute on function public\.get_staff_rating_aggregates\(\) to authenticated;/i);

  const currentRosterRpc = functionDefinition(roleMigration, 'get_bookable_staff');
  assert.match(currentRosterRpc, /p\.role in \('head', 'admin'\) and p\.is_active and p\.accepts_appointments/);
  assert.match(currentRosterRpc, /p\.role = 'customer' and p\.is_active = false and p\.accepts_appointments and p\.position_title is not null/);
});

test('booking keeps customer authorization and selection/locking behavior while accepting head candidates', () => {
  const original = functionDefinition(bookingMigration, 'book_appointment');
  const updated = functionDefinition(migration, 'book_appointment');
  assert.equal(updated, replaceEvery(original, "role in ('staff', 'admin')", "role in ('head', 'admin')", 2));
  assert.match(updated, /role = 'customer' and is_active/);
  assert.match(updated, /perform pg_advisory_xact_lock\(hashtextextended\('booking-date:'/);
  assert.match(updated, /on conflict on constraint appointments_reference_no_key do nothing/i);
  assert.match(updated, /when exclusion_violation/);
  assert.match(updated, /candidates\.is_active and candidates\.accepts_appointments/);
  assert.match(updated, /where candidates\.role in \('head', 'admin'\)/);
  assert.match(updated, /id = p_staff_id and role in \('head', 'admin'\)/);
  assert.match(migration, /revoke all on function public\.book_appointment\(text\[\], uuid, date, time\) from public;\s*grant execute on function public\.book_appointment\(text\[\], uuid, date, time\) to authenticated;/i);
});

test('availability validates head candidates for both explicit and automatic selection', () => {
  const original = functionDefinition(bookingMigration, 'get_available_slots');
  const updated = functionDefinition(migration, 'get_available_slots');
  assert.equal(updated, replaceEvery(original, "role in ('staff', 'admin')", "role in ('head', 'admin')", 2));
  assert.match(updated, /p_duration_minutes is null or p_duration_minutes < 1 or p_duration_minutes > 600/);
  assert.match(updated, /p\.accepts_appointments/);
  assert.match(updated, /p\.role in \('head', 'admin'\) and p\.is_active/);
  assert.match(migration, /revoke all on function public\.get_available_slots\(uuid, date, integer\) from public;\s*grant execute on function public\.get_available_slots\(uuid, date, integer\) to anon, authenticated;/i);
});
