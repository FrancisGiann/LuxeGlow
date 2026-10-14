import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const additive = read('supabase/migrations/20261014030000_independent_staff_roster.sql');
const cutover = read('supabase/migrations/20261014030001_staff_roster_booking_cutover.sql');

test('independent roster is mirrored, seeded without Auth identities, and admin-managed', () => {
  assert.equal(read('database/supabase/migrations/20261014030000_independent_staff_roster.sql'), additive);
  assert.match(additive, /create table if not exists public\.staff_members/);
  assert.doesNotMatch(additive, /(?:auth\.users|\b(?:email|phone|password)\s+(?:text|varchar))/i);
  assert.match(additive, /record_kind text not null check \(record_kind in \('owner', 'staff', 'legacy'\)\)/);
  assert.match(additive, /grant update \(full_name, position_title, is_active, is_bookable\)[\s\S]*?on public\.staff_members to authenticated/);
  assert.match(additive, /for select to authenticated\s+using \(public\.is_staff\(\)\)/);
  assert.match(additive, /for insert to authenticated\s+with check \(public\.is_admin\(\)\)/);
  assert.match(additive, /for update to authenticated\s+using \(public\.is_admin\(\)\)[\s\S]*?with check \(public\.is_admin\(\)\)/);
  assert.match(additive, /\('owner-leth-s-alfabete', 'owner', 'Leth S\. Alfabete', true, false\)/);
  for (const seed of [
    "('staff-jhona-hael-amparado', 'staff', 'Jhona Hael Amparado', true, true)",
    "('staff-jen-reyes', 'staff', 'Jen Reyes', true, true)",
    "('staff-adelia-pondaulda', 'staff', 'Adelia Pondaulda', true, true)",
    "('staff-abcel-racal', 'staff', 'Abcel Racal', true, true)",
  ]) assert.ok(additive.includes(seed), `missing confirmed roster seed: ${seed}`);
  assert.match(additive, /on conflict \(roster_key\) do nothing/);
});

test('booking cutover preserves legacy assignments and exposes only safe roster fields', () => {
  assert.equal(read('database/supabase/migrations/20261014030001_staff_roster_booking_cutover.sql'), cutover);
  assert.match(cutover, /alter table public\.appointments\s+add column if not exists staff_member_id uuid/);
  assert.match(cutover, /where a\.staff_id is not null[\s\S]*?on conflict \(id\) do nothing/);
  assert.match(cutover, /check \(staff_id is null or staff_member_id is null\)/);
  assert.match(cutover, /returns table \(\s*id uuid,\s*display_name text,\s*position_title text,\s*average_rating numeric,\s*rating_count bigint/);
  assert.match(cutover, /where m\.record_kind = 'staff' and m\.is_active and m\.is_bookable/);
  assert.match(cutover, /select m\.id,\s*m\.full_name,[\s\S]*?from public\.staff_members m[\s\S]*?where m\.record_kind = 'staff' and m\.is_active and m\.is_bookable/);
  assert.doesNotMatch(cutover.match(/create or replace function public\.get_bookable_staff\(\)[\s\S]*?\$\$;/)?.[0] || '', /profile_id|email|phone/);
  assert.match(cutover, /for share of candidates/);
  assert.match(cutover, /perform 1 from public\.staff_members m[\s\S]*?for share/);
  assert.match(cutover, /a\.staff_member_id = candidates\.id or a\.staff_member_id is null/);
  assert.match(cutover, /coalesce\(a\.staff_member_id, a\.staff_id\)/);
  assert.match(cutover, /v_staff_assigned boolean[\s\S]*?coalesce\(a\.staff_member_id, a\.staff_id\) is not null/);
});
