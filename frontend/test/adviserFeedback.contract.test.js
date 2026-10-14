import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const migration = read('supabase/migrations/20261012000000_adviser_feedback_workflows.sql');
const migrationMirror = read('database/supabase/migrations/20261012000000_adviser_feedback_workflows.sql');
const bookingPage = read('frontend/src/pages/BookingPage.jsx');
const endpoints = read('frontend/src/api/endpoints.js');
const authModal = read('frontend/src/components/auth/AuthModal.jsx');
const ratingModal = read('frontend/src/components/dashboard/RateVisitModal.jsx');
const reviewsPage = read('frontend/src/pages/dashboard/ReviewsPage.jsx');
const bell = read('frontend/src/components/admin/StaffNotificationBell.jsx');
const bookingSelection = read('frontend/src/utils/bookingSelection.js');
const serviceCatalog = read('frontend/src/components/services/ServiceCatalog.jsx');
const packageMigration = read('supabase/migrations/20261012001000_enforce_single_package_per_booking.sql');
const packageMigrationMirror = read('database/supabase/migrations/20261012001000_enforce_single_package_per_booking.sql');
const canonicalBookingMigration = read('supabase/migrations/20260922000000_head_role_runtime.sql');

test('date status RPC is bounded, read-only, and exposes only closure state', () => {
  assert.match(migration, /create or replace function public\.get_salon_date_status\(p_date date\)\s+returns table\(is_closed boolean\)/i);
  assert.match(migration, /p_date < v_today or p_date > v_today \+ 60/i);
  assert.match(migration, /now\(\) at time zone 'Asia\/Manila'/i);
  assert.match(migration, /from public\.salon_hours_for_date\(p_date\)/i);
  assert.match(migration, /grant execute on function public\.get_salon_date_status\(date\) to anon, authenticated/i);
  assert.doesNotMatch(migration.slice(migration.indexOf('create or replace function public.get_salon_date_status'), migration.indexOf('create or replace function public.get_published_review_stats')), /open_time|close_time|reason/i);
  assert.match(endpoints, /export async function getSalonDateStatus\(date\)/);
  assert.match(endpoints, /rpc\('get_salon_date_status', \{ p_date: dateValue \}\)/);
  assert.match(endpoints, /parsed\.toISOString\(\)\.slice\(0, 10\) !== dateValue/);
  assert.match(bookingPage, /dateStatusRequestRef/);
  assert.match(bookingPage, /selectedDateClosed/);
  assert.match(bookingPage, /setDate\(value\); setTime\(''\)/);
  assert.match(bookingPage, /const latestDateStatus = await getSalonDateStatus\(date\)/);
  assert.match(bookingPage, /date && selectedDateClosed \? <p/);
  assert.match(bookingPage, /date && selectedDateClosed \? <p[^]*?Service choices are unavailable/);
  assert.doesNotMatch(endpoints, /ask an administrator to apply the latest schedule update/);
});

test('public review cards retain their limit while aggregate count and average cover every visible published review', () => {
  assert.match(migration, /create or replace function public\.get_published_review_stats\(\)\s+returns table\(total_reviews bigint, average_rating numeric\)/i);
  assert.match(migration, /count\(r\.id\)::bigint[\s\S]*?avg\(r\.rating\)::numeric[\s\S]*?where r\.is_published[\s\S]*?exists \(select 1 from public\.profiles p where p\.id = r\.customer_id\)/i);
  assert.match(migration, /grant execute on function public\.get_published_review_stats\(\) to anon, authenticated/i);
  assert.match(endpoints, /from\('published_reviews'\)[\s\S]*?limit\(20\)/);
  assert.match(endpoints, /rpc\('get_published_review_stats'\)/);
  assert.match(endpoints, /stats: \{ total_reviews: totalReviews, average_rating: averageRating \}/);
  assert.match(endpoints, /Number\.isSafeInteger\(totalReviews\)/);
  assert.doesNotMatch(endpoints, /total_reviews: reviews\.length/);
});

test('customer cancellation alerts require the authenticated customer cancellation path and reach current staff recipients', () => {
  assert.match(migration, /check \(type in \('new_booking', 'customer_cancelled'\)\)/i);
  assert.match(migration, /current_setting\('app\.allow_customer_appointment_action', true\) is distinct from 'true'/i);
  assert.match(migration, /auth\.uid\(\) is distinct from new\.customer_id/i);
  assert.match(migration, /coalesce\(auth\.role\(\), ''\) <> 'authenticated'/i);
  assert.match(migration, /old\.status not in \('Pending', 'Confirmed'\)[\s\S]*?new\.status <> 'Cancelled'/i);
  assert.match(migration, /p\.role in \('head', 'admin'\)[\s\S]*?p\.is_active = true/i);
  assert.match(migration, /on conflict \(recipient_id, appointment_id, type\) do nothing/i);
  assert.match(migration, /create trigger appointments_enqueue_customer_cancellation_notifications\s+after update of status on public\.appointments/i);
  assert.match(bell, /Appointment updates/);
  assert.match(bell, /No appointment updates yet/);
});

test('verification screen gives a local sign-in path after cross-device confirmation', () => {
  assert.match(authModal, /If you confirm on another device, return here and sign in to continue/);
  assert.match(authModal, /<Button type="button" variant="soft" onClick=\{handleVerificationSignIn\}>Sign in<\/Button>/);
  assert.match(authModal, /setLoginEmail\(verifyEmail\)/);
  assert.match(authModal, /onClick=\{handleVerificationSignIn\}/);
  assert.doesNotMatch(authModal, /modalView !== 'login' \|\| loginEmail \|\| !verifyEmail/);
  assert.match(ratingModal, />Your rating</);
  assert.match(ratingModal, /readOnly = false/);
  assert.match(ratingModal, /star <= safeRating \? 'text-gold-400' : 'text-line-strong'/);
  assert.match(reviewsPage, /StarPicker value=\{review\.rating\} readOnly/);
  assert.doesNotMatch(reviewsPage, /onChange=\{\(\) => \{\}\}/);
  assert.doesNotMatch(ratingModal, /formatPeso|#\$\{a\.appointment_id\}/);
  assert.doesNotMatch(reviewsPage, /review\.appointment_id/);
});

test('workflow migration mirror remains byte-for-byte identical', () => {
  assert.equal(migrationMirror, migration);
});

test('booking package selection is based on catalog item types and preserves deliberate deselection', () => {
  assert.match(bookingSelection, /service\.item_type === 'package'/);
  assert.match(bookingSelection, /if \(selectedIds\.some\(\(selectedId\) => String\(selectedId\) === id\)\) return true/);
  assert.match(serviceCatalog, /selectedPackage && !selected/);
  assert.match(serviceCatalog, /disabledReason=\{packageUnavailable \?/);
  assert.match(bookingPage, /normalizeBookingServiceIds\(current, services\)/);
  assert.match(bookingPage, /serviceIds: selectedIdsForServices/);
  assert.match(bookingPage, /createAppointment\(\{ serviceIds: selectedIdsForServices/);
  assert.match(bookingPage, /selectedIds\.filter\(\(id\) => services\.find\(\(service\) => service\.id === id\)\?\.item_type === 'package'\)\.length > 1/);
});

test('single-package migration preserves the canonical booking RPC except for row locks and package validation', () => {
  const extractBookingRpc = (source) => {
    const start = source.indexOf('create or replace function public.book_appointment(');
    const end = source.indexOf('\n$$;', start) + 4;
    assert.ok(start >= 0 && end >= 4, 'book_appointment definition should exist');
    return source.slice(start, end);
  };
  let expectedRpc = extractBookingRpc(canonicalBookingMigration);
  expectedRpc = expectedRpc.replace(
    '  v_service_count integer;\n',
    '  v_service_count integer;\n  v_package_count integer;\n',
  );
  expectedRpc = expectedRpc.replace(
    `  if p_service_ids is null or cardinality(p_service_ids) < 1 then raise exception 'Select at least one service'; end if;\n  select count(*), coalesce(sum(price), 0), coalesce(sum(duration_minutes), 0)\n    into v_service_count, v_total, v_duration\n    from public.services where id = any(p_service_ids) and is_active;`,
    `  if p_service_ids is null or cardinality(p_service_ids) < 1 then raise exception 'Select at least one service'; end if;\n\n  perform s.id\n    from public.services s\n   where s.id = any(p_service_ids)\n   order by s.id\n   for share;\n\n  select count(*), coalesce(sum(price), 0), coalesce(sum(duration_minutes), 0),\n         count(*) filter (where item_type = 'package')\n    into v_service_count, v_total, v_duration, v_package_count\n    from public.services where id = any(p_service_ids) and is_active;`,
  );
  expectedRpc = expectedRpc.replace(
    "  if v_service_count <> cardinality(p_service_ids) then raise exception 'One or more services are unavailable'; end if;\n",
    "  if v_service_count <> cardinality(p_service_ids) then raise exception 'One or more services are unavailable'; end if;\n  if v_package_count > 1 then raise exception 'Only one package can be selected per booking'; end if;\n",
  );

  assert.equal(extractBookingRpc(packageMigration), expectedRpc);
  assert.match(packageMigration, /revoke all on function public\.book_appointment\(text\[\], uuid, date, time\) from public, anon/);
  assert.match(packageMigration, /grant execute on function public\.book_appointment\(text\[\], uuid, date, time\) to authenticated/);
  assert.doesNotMatch(packageMigration, /grant (?:insert|all).*appointment_services/i);
  assert.equal(packageMigrationMirror, packageMigration);
});

test('Accounts daily availability slots are removed while assigned appointment dates and times remain', () => {
  const adminPage = read('frontend/src/pages/AdminPage.jsx');
  const accountPanel = adminPage.slice(adminPage.indexOf('function StaffAccountPanel'), adminPage.indexOf('export function AdminPage'));
  assert.doesNotMatch(adminPage, /getAvailableSlots|Daily availability|30-minute availability/);
  assert.match(accountPanel, /Appointments date/);
  assert.match(accountPanel, /Assigned appointments/);
  assert.match(accountPanel, /appointment\.local_time\?\.slice\(0, 5\)/);
  assert.match(adminPage, /<ScheduleSettings/);
});
