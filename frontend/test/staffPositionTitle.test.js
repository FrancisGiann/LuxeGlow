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

test('admin edits roster titles separately from login accounts and booking picker omits an unset title', () => {
  const adminPage = read('frontend/src/pages/AdminPage.jsx');
  const bookingPage = read('frontend/src/pages/BookingPage.jsx');
  assert.match(adminPage, /Optional position title/);
  assert.match(adminPage, /placeholder="Head Massage Therapist"/);
  assert.match(adminPage, /maxLength=\{STAFF_POSITION_TITLE_MAX_LENGTH\}/);
  assert.match(adminPage, /Position title is unchanged\./);
  assert.match(adminPage, /position_title: nextTitle/);
  assert.match(adminPage, /function TeamMemberTitleEditor\(\{ staffMember, canManage, onSaved \}\)/);
  assert.match(adminPage, /updateAdminStaffMember\(staffMember\.id,\s*\{\s*position_title: nextTitle,?\s*\}\)/);
  assert.match(adminPage, /function TeamRosterPanel\([\s\S]*?title="Team roster"/);
  const loginPanel = adminPage.slice(adminPage.indexOf('function StaffAccountPanel'), adminPage.indexOf('function TeamRosterPanel'));
  assert.doesNotMatch(loginPanel, /position_title|accepts_appointments|Bookable/);
  assert.doesNotMatch(adminPage, /CustomEvent|admin-staff-profile-updated/);
  assert.match(bookingPage, /member\.position_title &&/);
  assert.match(bookingPage, /member\.average_rating > 0/);
});

test('login account rows show account status while the roster owns booking status and ratings', () => {
  const adminPage = read('frontend/src/pages/AdminPage.jsx');
  const rowMatch = adminPage.match(/function ProfileRow\(\{ profile, selected, onSelect \}\) \{[\s\S]*?\n\}\n\nfunction TeamMemberTitleEditor/);
  const panelMatch = adminPage.match(/function StaffAccountPanel\([\s\S]*?\n\}\n\n(?:export )?function TeamRosterPanel/);
  const rosterMatch = adminPage.match(/function TeamRosterPanel\([\s\S]*?\n\}\n\nexport function AdminPage/);
  assert.ok(rowMatch, 'staff row component should be present');
  assert.ok(panelMatch, 'login account inspector should be present');
  assert.ok(rosterMatch, 'database-backed team roster should be present');

  const row = rowMatch[0];
  assert.ok(row.indexOf('{name}') < row.indexOf('{profile.email}'));
  assert.doesNotMatch(row, /profile\.position_title|profile\.accepts_appointments|Bookable/);
  assert.doesNotMatch(row, /rating_count|average_rating|published rating|No ratings yet/);
  assert.match(row, /const accountStatus = profile\.is_active \? "Active" : "Inactive"/);
  assert.equal((row.match(/rounded-full/g) || []).length, 1);
  assert.match(row, /Account status: \$\{accountStatus\}/);
  assert.doesNotMatch(row, /Accepts appointments/);
  assert.match(row, /<span className="min-w-0">[\s\S]*?\{profile\.email\}\s*<\/span>\s*<\/span>\s*<span className="flex min-w-0 flex-col items-end gap-2 sm:flex-row sm:items-center">/);
  assert.match(panelMatch[0], /Assigned appointments[\s\S]*?localDateLabel\(appointment\.local_date\)[\s\S]*?appointment\.local_time/);
  assert.match(rosterMatch[0], /member\.is_active && member\.is_bookable/);
  assert.match(rosterMatch[0], /member\.rating_count[\s\S]*?member\.average_rating[\s\S]*?published ratings/);
  assert.match(rosterMatch[0], /record_kind === "owner"[\s\S]*?record_kind === "staff"[\s\S]*?record_kind === "legacy"/);
  assert.doesNotMatch(panelMatch[0], /Appointments date|type="date"|Previous day|Next day/);
});
