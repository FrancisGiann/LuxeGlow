import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migration = readFileSync(resolve(projectRoot, 'supabase/migrations/20261010000000_require_active_accounts_for_owned_data.sql'), 'utf8');
const migrationMirror = readFileSync(resolve(projectRoot, 'database/supabase/migrations/20261010000000_require_active_accounts_for_owned_data.sql'), 'utf8');

test('active-account RLS migration stays mirrored and preserves self-profile status lookup', () => {
  assert.equal(migrationMirror, migration);
  assert.match(migration, /create or replace function public\.is_active_account\(\)[\s\S]*?stable[\s\S]*?security definer[\s\S]*?set search_path = pg_catalog/);
  assert.match(migration, /where p\.id = auth\.uid\(\)[\s\S]*?p\.is_active = true/);
  assert.match(migration, /revoke all on function public\.is_active_account\(\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.is_active_account\(\) to authenticated/);
  assert.match(migration, /profiles[\s\S]*?as restrictive for update to authenticated[\s\S]*?using \(public\.is_active_account\(\)\)[\s\S]*?with check \(public\.is_active_account\(\)\)/);
  for (const table of ['appointments', 'appointment_services', 'user_notifications', 'reviews']) {
    assert.match(migration, new RegExp(`on public\\.${table}[\\s\\S]*?as restrictive for all to authenticated[\\s\\S]*?using \\(public\\.is_active_account\\(\\)\\)[\\s\\S]*?with check \\(public\\.is_active_account\\(\\)\\)`));
  }
  assert.doesNotMatch(migration, /drop policy if exists profiles_select|create policy .*profiles.*for select/i);
});
