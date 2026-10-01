import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const booking = read('frontend/src/pages/BookingPage.jsx');
const appointments = read('frontend/src/pages/dashboard/MyAppointmentsPage.jsx');
const endpoints = read('frontend/src/api/endpoints.js');
const adminApi = read('frontend/src/api/admin.js');
const adminPage = read('frontend/src/pages/AdminPage.jsx');
const migration = read('supabase/migrations/20261002000000_customer_booking_controls.sql');
const migrationMirror = read('database/supabase/migrations/20261002000000_customer_booking_controls.sql');
const worker = read('supabase/functions/process-notifications/index.ts');

test('booking selections survive sign-in and only the review action creates an appointment', () => {
  assert.match(booking, /luxeglow-booking-draft-v1/);
  assert.match(booking, /reviewStep: true/);
  assert.match(booking, /setItem\('luxeglow-auth-return', '\/book'\)/);
  assert.match(booking, /id="booking-services-heading"[\s\S]*?fieldErrors\.services/);
  assert.match(booking, /id="booking-date"[\s\S]*?error=\{fieldErrors\.date\}/);
  assert.match(booking, /const confirmBooking = async/);
  const confirmation = booking.slice(booking.indexOf('const confirmBooking'), booking.indexOf('const editBooking'));
  assert.match(confirmation, /getAvailableSlots\(date, totalMinutes \|\| 30, selectedStaffId\)/);
  assert.match(confirmation, /createAppointment\(/);
  assert.doesNotMatch(booking.slice(booking.indexOf('const submit'), booking.indexOf('const confirmBooking')), /createAppointment\(/);
  assert.match(booking, /customer\?\.full_name \|\| \[customer\?\.first_name, customer\?\.last_name\]/);
});

test('customer management controls are limited in the UI and send a required reason', () => {
  assert.match(appointments, /function canCustomerManage\(appointment\)/);
  assert.match(appointments, /!\['Pending', 'Confirmed'\]\.includes\(appointment\.status\)/);
  assert.match(appointments, /appointment\.arrived_at/);
  assert.match(appointments, /start > Date\.now\(\)/);
  assert.match(appointments, /Change date or time/);
  assert.match(appointments, /Cancel booking/);
  assert.match(appointments, /maxLength=\{500\}/);
  assert.match(appointments, /reason\.trim\(\)/);
  assert.match(endpoints, /rpc\('customer_reschedule_appointment'/);
  assert.match(endpoints, /rpc\('customer_cancel_appointment'/);
});

test('owner RPCs enforce row locking, eligibility, schedule, reason, and overlap rules', () => {
  assert.equal(migrationMirror, migration);
  assert.match(migration, /create or replace function public\.customer_reschedule_appointment/);
  assert.match(migration, /where a\.id = p_appointment_id and a\.customer_id = v_user\s+for update/);
  assert.match(migration, /v_appointment\.status not in \('Pending', 'Confirmed'\)[\s\S]*?v_appointment\.start_at <= v_now[\s\S]*?v_appointment\.arrived_at is not null/);
  assert.match(migration, /salon_hours_for_date\(p_date\)/);
  assert.match(migration, /extract\(minute from p_time\)::integer % 30 <> 0/);
  assert.match(migration, /a\.booking_range && tstzrange/);
  assert.match(migration, /status = case when status = 'Confirmed' then 'Pending' else status end/);
  assert.match(migration, /create or replace function public\.customer_cancel_appointment/);
  assert.match(migration, /char_length\(v_reason\) not between 1 and 500/);
  assert.match(migration, /customer_cancellation_reason = v_reason/);
  assert.match(migration, /revoke all on function public\.customer_cancel_appointment\(uuid, text\) from public, anon, service_role/);
  assert.match(migration, /v_appointment\.staff_id is null\s+or a\.staff_id = v_appointment\.staff_id\s+or a\.staff_id is null/);
  assert.match(migration, /and no_show_reviewed_at is null\s+and start_at <= p_now - interval '24 hours'/);
});

test('reschedule and repeated status events queue new notifications and replace stale reminders', () => {
  assert.match(migration, /drop constraint if exists user_notifications_appointment_id_type_key/);
  assert.match(migration, /drop index if exists public\.notification_outbox_once_idx/);
  assert.match(migration, /v_type := 'rescheduled'/);
  assert.match(migration, /after insert or update of status, local_date, local_time on public\.appointments/);
  assert.match(migration, /delete from public\.notification_outbox\s+where appointment_id = new\.id and kind = 'reminder' and sent_at is null/);
  assert.match(migration, /update public\.user_notifications\s+set is_read = true[\s\S]*?type = 'reminder' and not is_read/);
  assert.match(migration, /kind in \('pending', 'confirmed', 'reminder', 'cancelled', 'completed', 'welcome', 'password_changed', 'rescheduled'\)/);
  assert.match(migration, /scheduled_start_epoch/);
  assert.match(worker, /'rescheduled'/);
  assert.match(worker, /APPOINTMENT RESCHEDULED/);
  assert.match(adminApi, /customer_cancellation_reason/);
  assert.match(adminPage, /Customer cancellation reason/);
  assert.match(worker, /const stale = appointment\?\.status !== 'Confirmed'/);
  assert.match(worker, /expectedStartEpoch/);
});
