import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');

test('archived cleanup migration is mirrored, guarded, source-aware, and limited to archived roster copies', () => {
  const migration = read('supabase/migrations/20261015000000_remove_archived_staff_copies.sql');
  assert.equal(
    read('database/supabase/migrations/20261015000000_remove_archived_staff_copies.sql'),
    migration,
  );
  assert.match(migration, /lock table public\.staff_members in share row exclusive mode/i);
  assert.match(migration, /v_legacy_count not in \(0, 4\)/i);
  assert.match(migration, /a\.staff_member_id = m\.id[\s\S]*?raise exception 'Archived staff records still have direct appointment references'/i);
  assert.match(migration, /m\.is_active[\s\S]*?m\.is_bookable[\s\S]*?p\.id is null[\s\S]*?m\.full_name is distinct from/i);
  assert.match(migration, /left join public\.staff_members m on m\.id = a\.staff_member_id[\s\S]*?left join public\.profiles p on p\.id = a\.staff_id/i);
  assert.match(migration, /create or replace function public\.get_staff_rating_aggregates\(\)[\s\S]*?left join public\.appointments a on a\.staff_member_id = m\.id[\s\S]*?from public\.profiles p[\s\S]*?a\.staff_id = p\.id/i);
  assert.match(migration, /create or replace function public\.get_my_appointment_staff\(\)[\s\S]*?left join public\.staff_members m on m\.id = a\.staff_member_id[\s\S]*?left join public\.profiles p on p\.id = a\.staff_id/i);
  assert.match(migration, /delete from public\.staff_members\s+where record_kind = 'legacy'/i);
  assert.doesNotMatch(migration, /delete from public\.(?:profiles|auth\.users|appointments|reviews|staff_notifications|user_notifications)/i);
  assert.doesNotMatch(migration, /insert into public\.auth\.users|delete from auth\.users/i);
});
