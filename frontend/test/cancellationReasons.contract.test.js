import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const migration = read('supabase/migrations/20261015100000_appointment_cancellation_reason.sql');
const mirror = read('database/supabase/migrations/20261015100000_appointment_cancellation_reason.sql');
const adminApi = read('frontend/src/api/admin.js');
const adminPage = read('frontend/src/pages/AdminPage.jsx');
const initialMigration = read('supabase/migrations/20260827000000_initial.sql');

function functionBody(source, name) {
  const start = source.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `${name} should be present`);
  const end = source.indexOf('$$;', start);
  assert.notEqual(end, -1, `${name} should terminate`);
  return source.slice(start, end + 3);
}

test('canonical cancellation reason migration is append-only, nullable for legacy records, bounded, and mirrored', () => {
  assert.equal(mirror, migration);
  assert.match(migration, /add column if not exists cancellation_reason text/);
  assert.ok(migration.includes("char_length(regexp_replace(cancellation_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 500"));
  assert.ok(migration.includes("regexp_replace(cancellation_reason, '[[:space:]]', '', 'g') <> ''"));
  assert.doesNotMatch(migration, /set cancellation_reason\s*=\s*coalesce/i, 'legacy reasons must not be invented or backfilled');
  assert.match(adminPage, /String\(appointment\?\.cancellation_reason \|\| ""\)\.trim\(\)[\s\S]*?customer_cancellation_reason[\s\S]*?No reason recorded/);
  assert.match(adminApi, /cancellation_reason,customer_cancellation_reason,customer_reschedule_reason/);
  assert.match(adminApi, /const patch = status === 'Cancelled' \? \{ status, cancellation_reason: reason \} : \{ status \}/);
  assert.match(adminApi, /if \(status === 'Cancelled' && \(!reason \|\| reason\.length > 500\)\)/);
});

test('reason trigger requires a valid cancellation transition and denies reason-only or terminal edits', () => {
  const protect = functionBody(migration, 'protect_appointment_fields');
  assert.ok(protect.includes("regexp_replace(coalesce(new.cancellation_reason, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g')"));
  assert.ok(protect.includes("regexp_replace(v_reason, '[[:space:]]', '', 'g') = ''"));
  assert.match(protect, /if old\.cancellation_reason is distinct from new\.cancellation_reason and not v_privileged then[\s\S]*?if old\.status in \('Completed', 'Cancelled'\) then[\s\S]*?terminal appointment cancellation reason cannot be changed/);
  assert.match(protect, /if old\.status not in \('Pending', 'Confirmed'\) or new\.status <> 'Cancelled' then[\s\S]*?reason can only be recorded with cancellation/);
  assert.match(protect, /if new\.status = 'Cancelled' and old\.status is distinct from new\.status then[\s\S]*?cancellation reason between 1 and 500/);
  assert.match(protect, /coalesce\(current_setting\('app\.allow_customer_appointment_action', true\) = 'true', false\)/);
  assert.match(protect, /old\.customer_cancellation_reason is distinct from new\.customer_cancellation_reason[\s\S]*?old\.customer_reschedule_reason is distinct from new\.customer_reschedule_reason[\s\S]*?and not v_customer_action[\s\S]*?Customer appointment reasons can only be saved/);
  assert.match(protect, /old\.status in \('Completed', 'Cancelled'\) and old\.status is distinct from new\.status[\s\S]*?cannot be reopened/);
});

test('customer cancellation owns both reason fields and resets its narrow transaction marker', () => {
  const cancel = functionBody(migration, 'customer_cancel_appointment');
  assert.match(cancel, /select \* into v_appointment[\s\S]*?where a\.id = p_appointment_id and a\.customer_id = v_user\s+for update/);
  assert.match(cancel, /set status = 'Cancelled', cancellation_reason = v_reason, customer_cancellation_reason = v_reason/);
  assert.match(cancel, /set_config\('app\.allow_customer_appointment_action', 'true', true\)[\s\S]*?set_config\('app\.allow_customer_appointment_action', 'false', true\)/);
  assert.match(cancel, /v_appointment\.status not in \('Pending', 'Confirmed'\)[\s\S]*?v_appointment\.start_at <= v_now[\s\S]*?v_appointment\.arrived_at is not null/);
});

test('trusted cancellation writers attach fixed reasons while Keep and customer direct updates stay bounded', () => {
  const noShow = functionBody(migration, 'respond_to_no_show');
  const reconcile = functionBody(migration, 'reconcile_expired_pending_appointments');
  const maintenance = functionBody(migration, 'run_appointment_maintenance');
  assert.match(noShow, /if p_cancel then[\s\S]*?set status = 'Cancelled', cancellation_reason = 'Cancelled after no arrival was recorded\.'[\s\S]*?if not found then return 'not_eligible'/);
  const keepBranch = noShow.slice(noShow.indexOf('perform set_config'));
  assert.doesNotMatch(keepBranch, /cancellation_reason/);
  assert.match(reconcile, /security definer[\s\S]*?v_role in \('head', 'admin'\) or customer_id = v_user_id/);
  assert.match(reconcile, /set status = 'Cancelled',[\s\S]*?cancellation_reason = 'Automatically cancelled because the appointment remained unconfirmed 15 minutes after its scheduled start\.'/);
  assert.match(reconcile, /start_at < now\(\) - interval '15 minutes'/);
  assert.match(migration, /v_expired_pending_reconciliation boolean := coalesce\(auth\.uid\(\) = old\.customer_id[\s\S]*?old\.status = 'Pending'[\s\S]*?old\.start_at < clock_timestamp\(\) - interval '15 minutes'[\s\S]*?false\);/);
  assert.match(initialMigration, /create policy appointments_staff_update on public\.appointments for update to authenticated using \(public\.is_staff\(\)\) with check \(public\.is_staff\(\)\)/);
  assert.match(migration, /RLS still denies that customer[\s\S]*?direct UPDATE access/);
  assert.match(maintenance, /set status = 'Cancelled',[\s\S]*?cancellation_reason = 'Automatically cancelled because the appointment remained unconfirmed 15 minutes after its scheduled start\.'/);
  assert.match(maintenance, /cancellation_reason = 'Automatically cancelled because no arrival or staff review was recorded within 24 hours of the scheduled start\.'/);
  assert.match(maintenance, /pg_advisory_xact_lock\(hashtextextended\('appointment-maintenance-reminders'/);
  assert.match(maintenance, /insert into public\.notification_outbox/);
  assert.match(migration, /revoke all on function public\.run_appointment_maintenance\(timestamptz\) from public;\s*grant execute on function public\.run_appointment_maintenance\(timestamptz\) to service_role/);
});
