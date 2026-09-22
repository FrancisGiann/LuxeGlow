import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const adminApi = read('frontend/src/api/admin.js');
const endpoints = read('frontend/src/api/endpoints.js');
const app = read('frontend/src/App.jsx');
const bookingPage = read('frontend/src/pages/BookingPage.jsx');
const hero = read('frontend/src/components/home/Hero.jsx');
const servicesSection = read('frontend/src/components/home/ServicesSection.jsx');
const servicesPage = read('frontend/src/pages/ServicesPage.jsx');
const publicLayout = read('frontend/src/components/layout/PublicLayout.jsx');
const theme = read('frontend/src/styles/theme.css');

test('admin appointments are returned newest-created first with a stable tie-breaker', () => {
  assert.match(adminApi, /\.order\('created_at', \{ ascending: false \}\)\.order\('id', \{ ascending: false \}\)/);
  assert.doesNotMatch(adminApi, /listAdminAppointments[\s\S]*?\.order\('local_date', \{ ascending: true \}\)/);
});

test('business info submit stays compact while retaining the shared button touch target', () => {
  assert.match(theme, /form\.mt-5\.grid\.gap-4\.sm\\:grid-cols-2 > button\[type="submit"\][\s\S]*?width: fit-content/);
  assert.match(theme, /form\.mt-5\.grid\.gap-4\.sm\\:grid-cols-2 > button\[type="submit"\][\s\S]*?min-height: 44px/);
  assert.match(theme, /justify-self: end/);
});

test('staff and admin roles are kept out of every public booking entry point', () => {
  assert.match(app, /function RequireBookingAccess/);
  assert.match(app, /if \(status === 'loading'\) return <PageLoader \/>/);
  assert.match(app, /status === 'authenticated' && isStaffRole\(customer\?\.role\)/);
  assert.match(app, /path="\/book" element={<RequireBookingAccess><BookingPage \/><\/RequireBookingAccess>}/);
  assert.match(hero, /navigate\(isStaff \? '\/admin' : '\/book'\)/);
  assert.match(servicesSection, /isStaff \? <Link to="\/admin"/);
  assert.match(servicesPage, /showBookActions={!isStaff}/);
  assert.match(servicesPage, /navigate\(isStaff \? '\/admin' : '\/book'\)/);
  assert.match(publicLayout, /!isStaff && <button type="button" onClick=\{\(\) => navigate\('\/book'\)/);
  assert.match(publicLayout, /isStaffRole\(customer\?\.role\).*navigate\('\/admin'/s);
});

test('No preference uses the nullable RPC contract and always reloads aggregate availability', () => {
  assert.match(endpoints, /const normalizedStaffId = staffId \? String\(staffId\)\.trim\(\) \|\| null : null;/);
  assert.match(endpoints, /p_staff_id: normalizedStaffId/);
  assert.match(endpoints, /staff_id: row\.assigned_staff_id \|\| row\.staff_id \|\| normalizedStaffId/);
  assert.match(bookingPage, /const \[availabilityReloadKey, setAvailabilityReloadKey\] = useState\(0\);/);
  assert.match(bookingPage, /setAvailabilityReloadKey\(\(current\) => current \+ 1\)/);
  assert.match(bookingPage, /\[date, totalMinutes, selectedStaffId, selectedIds, availabilityReloadKey\]/);
});
