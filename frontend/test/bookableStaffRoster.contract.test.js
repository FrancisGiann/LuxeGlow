import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const latestMigration = read('supabase/migrations/20261009010000_fix_bookable_staff_roster.sql');
const migrationMirror = read('database/supabase/migrations/20261009010000_fix_bookable_staff_roster.sql');
const legacyRoleMigration = read('supabase/migrations/20260918000000_simplify_roles.sql');
const bookingMigration = read('supabase/migrations/20260922000000_head_role_runtime.sql');
const endpoints = read('frontend/src/api/endpoints.js');

function functionDefinition(sql, name) {
  const start = sql.indexOf(`function public.${name}(`);
  assert.notEqual(start, -1, `missing function: ${name}`);
  const bodyStart = sql.indexOf('as $$', start);
  assert.notEqual(bodyStart, -1, `missing function body: ${name}`);
  const end = sql.indexOf('$$;', bodyStart);
  assert.notEqual(end, -1, `unterminated function body: ${name}`);
  return sql.slice(start, end + 3);
}

test('public bookable roster excludes deactivated profiles rejected by booking RPCs', () => {
  const previousRoster = functionDefinition(legacyRoleMigration, 'get_bookable_staff');
  const booking = functionDefinition(bookingMigration, 'book_appointment');
  const slots = functionDefinition(bookingMigration, 'get_available_slots');
  const latestRoster = functionDefinition(latestMigration, 'get_bookable_staff');

  assert.match(previousRoster, /p\.role = 'customer' and p\.is_active = false/);
  assert.match(booking, /id = p_staff_id and role in \('head', 'admin'\) and is_active and accepts_appointments/);
  assert.match(slots, /p_staff_id is not null and not exists[\s\S]*?role in \('head', 'admin'\) and is_active and accepts_appointments/);
  assert.match(latestRoster, /where p\.role in \('head', 'admin'\)\s+and p\.is_active\s+and p\.accepts_appointments/);
  assert.doesNotMatch(latestRoster, /p\.role = 'customer'|not p\.is_active/);
  assert.match(latestMigration, /revoke all on function public\.get_bookable_staff\(\) from public;\s*grant execute on function public\.get_bookable_staff\(\) to anon, authenticated;/);
  assert.match(endpoints, /rpc\('get_bookable_staff'/);
});

test('the bookable roster migration remains identical in both documented migration directories', () => {
  assert.equal(migrationMirror, latestMigration);
});
