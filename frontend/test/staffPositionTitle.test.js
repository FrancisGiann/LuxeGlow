import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStaffPositionTitleWithinLimit, normalizeStaffPositionTitle, STAFF_POSITION_TITLE_MAX_LENGTH } from '../src/utils/staffPositionTitle.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');

test('position title normalization collapses whitespace and clears blank input', () => {
  assert.equal(normalizeStaffPositionTitle('  Head\n  Massage\tTherapist  '), 'Head Massage Therapist');
  assert.equal(normalizeStaffPositionTitle(' \t\n '), null);
  assert.equal(normalizeStaffPositionTitle(null), null);
});

test('position title length validation accepts the limit and rejects longer text', () => {
  assert.equal(STAFF_POSITION_TITLE_MAX_LENGTH, 100);
  assert.equal(isStaffPositionTitleWithinLimit('x'.repeat(100)), true);
  assert.equal(isStaffPositionTitleWithinLimit('x'.repeat(101)), false);
  assert.equal(isStaffPositionTitleWithinLimit(null), true);
});

test('position title migration is mirrored and database protects role, length, normalization, and writes', () => {
  const migration = read('supabase/migrations/20260913000000_staff_position_titles.sql');
  assert.equal(read('database/supabase/migrations/20260913000000_staff_position_titles.sql'), migration);
  for (const contract of [
    /add column if not exists position_title text/i,
    /role in \('staff', 'admin'\)/i,
    /char_length\(position_title\) between 1 and 100/i,
    /position_title ~ '\[\^\[:space:\]\]'/i,
    /btrim\(regexp_replace\(new\.position_title, '\[\[:space:\]\]\+', ' ', 'g'\)\)/i,
    /coalesce\(auth\.role\(\), ''\) = 'service_role'/i,
    /session_user in \('postgres', 'supabase_admin'\)/i,
    /new\.position_title is distinct from old\.position_title/i,
    /not public\.is_admin\(\)/i,
    /before insert or update on public\.profiles/i,
    /profiles_z_position_title_guard/i,
  ]) assert.match(migration, contract);
  assert.match(migration, /new\.role not in \('staff', 'admin'\)[\s\S]*?new\.position_title := null/i);
});

test('bookable staff RPC exposes only abbreviated identity, optional title, and existing ratings', () => {
  const migration = read('supabase/migrations/20260913000000_staff_position_titles.sql');
  assert.match(migration, /drop function if exists public\.get_bookable_staff\(\)/i);
  assert.match(migration, /returns table \([\s\S]*?id uuid,[\s\S]*?display_name text,[\s\S]*?position_title text,[\s\S]*?average_rating numeric,[\s\S]*?rating_count bigint/i);
  assert.match(migration, /left\(p\.last_name, 1\)/i);
  assert.match(migration, /p\.position_title/i);
  assert.match(migration, /grant execute on function public\.get_bookable_staff\(\) to anon, authenticated/i);
  assert.match(migration, /revoke all on function public\.get_bookable_staff\(\) from public/i);
  assert.match(migration, /p\.role in \('staff', 'admin'\) and p\.is_active and p\.accepts_appointments/i);
});

test('admin API validates title writes and both API surfaces map the nullable title defensively', () => {
  const adminApi = read('frontend/src/api/admin.js');
  const endpoints = read('frontend/src/api/endpoints.js');
  assert.match(adminApi, /position_title,username,role/);
  assert.match(adminApi, /fields\.position_title !== undefined/);
  assert.match(adminApi, /isStaffPositionTitleWithinLimit\(positionTitle\)/);
  assert.match(adminApi, /async function assertAdmin\(\)[\s\S]*?profile\.role !== 'admin'/);
  assert.match(adminApi, /const client = await assertAdmin\(\)/);
  assert.match(adminApi, /select\('position_title'\)\.maybeSingle\(\)/);
  assert.match(adminApi, /position_title: isStaffPositionTitleWithinLimit\(savedTitle\) \? savedTitle : null/);
  assert.match(endpoints, /position_title: isStaffPositionTitleWithinLimit\(positionTitle\) \? positionTitle : null/);
  assert.match(endpoints, /average_rating: row\.average_rating/);
});

test('admin edits a selected staff member title and booking picker omits an unset title', () => {
  const adminPage = read('frontend/src/pages/AdminPage.jsx');
  const bookingPage = read('frontend/src/pages/BookingPage.jsx');
  assert.match(adminPage, /Position title/);
  assert.ok(adminPage.includes('placeholder="e.g. Nail Artist"'));
  assert.match(adminPage, /maxLength=\{STAFF_POSITION_TITLE_MAX_LENGTH\}/);
  assert.match(adminPage, /Position title is unchanged\./);
  assert.match(adminPage, /onSave\(staffMember\.id, nextTitle\)/);
  assert.match(adminPage, /function TeamMemberTitleEditor\(\{ staffMember, canManage, onSave, pending = false \}\)/);
  assert.match(adminPage, /updateAdminStaffMember\(targetId, \{ position_title: positionTitle \}\)/);
  assert.match(adminPage, /function TeamMemberDetailsPanel\([\s\S]*?TeamMemberTitleEditor/);
  const accountPanel = adminPage.slice(adminPage.indexOf('function StaffAccountPanel'), adminPage.indexOf('function TeamMemberDetailsPanel'));
  assert.doesNotMatch(accountPanel, /position_title|accepts_appointments|Bookable/);
  assert.doesNotMatch(adminPage, /CustomEvent|admin-staff-profile-updated/);
  assert.match(read('frontend/src/components/booking/StaffPicker.jsx'), /member\.position_title &&/);
  assert.match(read('frontend/src/components/booking/StaffPicker.jsx'), /member\.average_rating > 0/);
});

test('one directory selects a person and shows only the matching account or member controls', () => {
  const adminPage = read('frontend/src/pages/AdminPage.jsx');
  const directory = read('frontend/src/components/admin/StaffDirectory.jsx');
  const rowMatch = directory.match(/function StaffDirectoryRow\(\{ entry, selected, onSelect \}\) \{[\s\S]*?\n\}\n\nexport function StaffDirectory/);
  const accountPanel = adminPage.match(/function StaffAccountPanel\([\s\S]*?\n\}\n\nfunction TeamMemberDetailsPanel/);
  const memberPanel = adminPage.match(/function TeamMemberDetailsPanel\([\s\S]*?\n\}\n\nexport function AdminPage/);
  assert.ok(rowMatch, 'staff directory row should be present');
  assert.ok(accountPanel, 'staff account inspector should be present');
  assert.ok(memberPanel, 'selected staff detail should be present');

  const row = rowMatch[0];
  assert.match(row, /onSelect\(entry\.key\)/);
  assert.match(row, /entry\.roleLabel/);
  assert.match(row, /entry\.kind === 'member'/);
  assert.match(row, /person\.email/);
  assert.match(row, /aria-controls="staff-directory-details"/);
  assert.match(row, /IconArrowRight/);
  assert.match(directory, /userSelectionRef\.current = true/);
  assert.match(directory, /setSelectionVersion\(\(version\) => version \+ 1\)/);
  assert.match(directory, /\(max-width: 1279px\)/);
  assert.match(directory, /prefers-reduced-motion: reduce/);
  assert.match(directory, /details\.scrollIntoView/);
  assert.match(directory, /focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(row, /legacy|record_kind === "legacy"/);

  const account = accountPanel[0];
  assert.match(account, /staffMember\.role === "admin" \? "Admin" : "Head"/);
  assert.match(account, /Account controls/);
  assert.match(account, /Manage sign-in access\./);
  assert.match(account, /<AssignedAppointments appointments=\{appointments\} staffId=\{staffMember\.id\}/);
  assert.doesNotMatch(account, /Login account controls|before roster migration|accepts_appointments|Bookable/);

  const details = memberPanel[0];
  assert.match(details, /staffMember\?\.record_kind === "owner"/);
  assert.match(details, /!isOwner && canManage/);
  assert.match(details, /Deactivate|Activate/);
  assert.match(details, /Add to booking|Remove from booking/);
  assert.match(details, /TeamMemberTitleEditor[\s\S]*?staffMember=\{staffMember\}/);
  assert.match(details, /<AssignedAppointments appointments=\{appointments\} staffId=\{staffMember\.id\}/);
  assert.doesNotMatch(details, /Archived|legacyMembers|record_kind === "legacy"/);
});
