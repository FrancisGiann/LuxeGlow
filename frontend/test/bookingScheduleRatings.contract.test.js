import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = resolve(projectRoot, 'supabase/migrations/20260905000000_booking_schedule_staff_ratings.sql');
const mirrorPath = resolve(projectRoot, 'database/supabase/migrations/20260905000000_booking_schedule_staff_ratings.sql');
const migration = readFileSync(migrationPath, 'utf8');
const bookingPage = readFileSync(resolve(projectRoot, 'frontend/src/pages/BookingPage.jsx'), 'utf8');
const endpoints = readFileSync(resolve(projectRoot, 'frontend/src/api/endpoints.js'), 'utf8');
const admin = readFileSync(resolve(projectRoot, 'frontend/src/api/admin.js'), 'utf8');
const dashboardLayout = readFileSync(resolve(projectRoot, 'frontend/src/components/layout/DashboardLayout.jsx'), 'utf8');
const dashboardOverview = readFileSync(resolve(projectRoot, 'frontend/src/pages/dashboard/DashboardOverviewPage.jsx'), 'utf8');
const publicLayout = readFileSync(resolve(projectRoot, 'frontend/src/components/layout/PublicLayout.jsx'), 'utf8');
const rateVisitModal = readFileSync(resolve(projectRoot, 'frontend/src/components/dashboard/RateVisitModal.jsx'), 'utf8');
const adminPage = readFileSync(resolve(projectRoot, 'frontend/src/pages/AdminPage.jsx'), 'utf8');

test('schedule migration is mirrored and protects the booking boundaries', () => {
  assert.equal(readFileSync(mirrorPath, 'utf8'), migration);
  for (const contract of [
    /salon_weekly_hours/,
    /salon_closures/,
    /values\s*\n\s*\(1, time '10:00', time '20:00'/i,
    /\(7, time '11:00', time '18:00'/i,
    /close_time > open_time/,
    /save_salon_hours/,
    /save_salon_closure/,
    /get_schedule_conflicts/,
    /Existing active appointments are never rewritten/,
    /v_start \+ make_interval\(mins => v_duration\) > \(\(p_date \+ v_close\)/,
    /generate_series\(p_date \+ v_open, p_date \+ v_close - make_interval\(mins => p_duration_minutes\)/,
    /p_staff_id is null then exists/,
    /drop function if exists public\.book_appointment\(text\[\], date, time\)/,
    /drop function if exists public\.get_available_slots\(date, integer\)/,
    /order by\s*\n\s*\(select coalesce\(sum\(extract\(epoch from \(upper\(a\.booking_range\)/,
    /count\(\*\) from public\.appointments a where a\.staff_id = candidates\.id and a\.local_date = p_date/,
    /candidates\.id asc/,
    /a\.staff_id = candidates\.id or a\.staff_id is null/,
    /grant execute on function public\.get_available_slots\(uuid, date, integer\) to anon, authenticated/,
  ]) assert.match(migration, contract);
  assert.equal((migration.match(/hashtextextended\('salon-schedule', 19071990\)/g) || []).length, 5);
  assert.doesNotMatch(migration, /grant select on public\.salon_weekly_hours, public\.salon_closures to anon, authenticated/);
  assert.doesNotMatch(migration, /create policy salon_(weekly_hours|closures)_public_read/);
});

test('ratings remain separate, bounded, and privacy-safe', () => {
  for (const contract of [
    /add column if not exists staff_rating integer/,
    /staff_rating is null or staff_rating between 1 and 5/,
    /Only completed visits can be reviewed/,
    /Staff rating requires an assigned team member/,
    /published_staff_aggregates/,
    /revoke all on public\.published_staff_aggregates from public, anon, authenticated/,
    /get_staff_rating_aggregates/,
    /v_staff_assigned and new\.staff_rating is null/,
    /not v_staff_assigned and new\.staff_rating is not null/,
    /where p\.role in \('staff', 'admin'\)/,
    /drop policy if exists reviews_staff_manage on public\.reviews/,
    /using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/,
  ]) assert.match(migration, contract);
  assert.match(endpoints, /staff_rating: staffValue/);
  assert.match(endpoints, /average_rating: row\.average_rating/);
  assert.match(admin, /get_staff_rating_aggregates/);
});

test('guest booking keeps a draft and requires an explicit authenticated submit', () => {
  for (const contract of [
    /luxeglow-booking-draft-v1/,
    /window\.sessionStorage\.getItem\(BOOKING_DRAFT_KEY\)/,
    /window\.sessionStorage\.setItem\(BOOKING_DRAFT_KEY/,
    /window\.sessionStorage\.setItem\('luxeglow-auth-return', '\/book'\)/,
    /openAuth\('login'\)/,
    /nothing is sent automatically/,
    /if \(!isAuthenticated \|\| status !== 'authenticated'\)/,
    /createAppointment\(\{ serviceIds: selectedIds, staffId: selectedStaffId/,
    /result\.staff_name \|\| selectedStaff\?\.name/,
    /Sign in to finalize/,
    /No preference/,
    /No ratings yet\./,
  ]) assert.match(bookingPage, contract);
  assert.doesNotMatch(bookingPage, /useDashboard/);
});

test('customer workspace keeps the approved minimal navigation and return flow', () => {
  for (const label of ['/dashboard/overview', "label: 'Home'", "label: 'My Appointments'", "label: 'Ratings & Reviews'", "label: 'My Profile'", 'to="/book"', 'Book appointment']) assert.match(dashboardLayout, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(dashboardLayout, /label: 'Notifications'/);
  assert.match(dashboardOverview, /Book an appointment/);
  assert.doesNotMatch(dashboardOverview, /View notifications|Rate a visit/);
  assert.match(publicLayout, /luxeglow-auth-return/);
  assert.match(publicLayout, /navigate\('\/book', \{ replace: true \}\)/);
});

test('assigned staff ratings are required in the review flow and business hours use structured schedule', () => {
  assert.match(endpoints, /createReview\(appointmentId, visitRating, staffRating = null, reviewText = ''\)/);
  assert.match(rateVisitModal, /Please rate your team member from 1 to 5 stars/);
  assert.match(rateVisitModal, /Team member rating \(required\)/);
  assert.doesNotMatch(adminPage, /\['business_hours', 'Business hours'\]/);
  assert.match(adminPage, /<ScheduleSettings onOpenAppointments=/);
});

test('public and admin schedule clients use validated RPC boundaries', () => {
  for (const contract of [
    /export async function getSalonSchedule\(\)/,
    /rpc\('get_salon_schedule'/,
    /export async function getAvailableSlots\(date, durationMinutes, staffId\)/,
    /p_staff_id: normalizedStaffId/,
    /export async function saveAdminSchedule/,
    /export async function listScheduleConflicts/,
  ]) assert.match(`${endpoints}\n${admin}`, contract);
});
