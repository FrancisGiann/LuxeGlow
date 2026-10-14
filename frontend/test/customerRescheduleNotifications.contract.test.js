import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const migration = read('supabase/migrations/20261014023341_customer_reschedule_staff_notifications.sql');
const mirror = read('database/supabase/migrations/20261014023341_customer_reschedule_staff_notifications.sql');
const hook = read('frontend/src/hooks/useStaffNotifications.js');
const merge = read('frontend/src/utils/staffNotifications.js');

test('customer schedule changes notify only active owning customers through the guarded reschedule path', () => {
  assert.match(migration, /old\.status not in \('Pending', 'Confirmed'\)[\s\S]*?new\.status not in \('Pending', 'Confirmed'\)/i);
  assert.match(migration, /old\.local_date is not distinct from new\.local_date[\s\S]*?old\.local_time is not distinct from new\.local_time[\s\S]*?old\.start_at is not distinct from new\.start_at/i);
  assert.match(migration, /current_setting\('app\.allow_appointment_reschedule', true\) is distinct from 'true'/i);
  assert.match(migration, /auth\.uid\(\) is distinct from new\.customer_id/i);
  assert.match(migration, /coalesce\(auth\.role\(\), ''\) <> 'authenticated'/i);
  assert.match(migration, /p\.role = 'customer' and p\.is_active/i);
  assert.match(migration, /p\.role in \('head', 'admin'\)[\s\S]*?p\.is_active = true/i);
  assert.match(migration, /after update of local_date, local_time, start_at on public\.appointments/i);
  assert.equal(mirror, migration);
});

test('repeated genuine reschedules refresh one unread notification without changing the shared uniqueness rule', () => {
  assert.match(migration, /on conflict \(recipient_id, appointment_id, type\) do update[\s\S]*?is_read = false[\s\S]*?created_at = clock_timestamp\(\)/i);
  assert.match(migration, /pg_trigger_depth\(\) <= 1/i);
  assert.match(migration, /current_setting\('app\.allow_customer_reschedule_notification_refresh', true\) is distinct from 'true'/i);
  assert.doesNotMatch(migration, /drop constraint if exists staff_notifications_recipient_appointment_type_key/i);
  assert.match(migration, /check \(type in \('new_booking', 'customer_cancelled', 'customer_rescheduled'\)\)/i);
  assert.match(hook, /event: 'UPDATE',[\s\S]*?table: 'staff_notifications'/);
  assert.match(merge, /incomingTime > existingTime[\s\S]*?is_read: notification\.is_read/);
  assert.match(merge, /incomingTime < existingTime[\s\S]*?is_read: existing\.is_read/);
});
