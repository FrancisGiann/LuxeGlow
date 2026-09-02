import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = resolve(projectRoot, 'supabase/migrations/20260902010000_fix_booking_reference_conflict.sql');
const mirrorPath = resolve(projectRoot, 'database/supabase/migrations/20260902010000_fix_booking_reference_conflict.sql');
const schemaPath = resolve(projectRoot, 'supabase/migrations/20260827000000_initial.sql');
const bookingPagePath = resolve(projectRoot, 'frontend/src/pages/BookingPage.jsx');
const endpointsPath = resolve(projectRoot, 'frontend/src/api/endpoints.js');
const catalogPath = resolve(projectRoot, 'frontend/src/components/services/ServiceCatalog.jsx');
const migration = readFileSync(migrationPath, 'utf8');
const schema = readFileSync(schemaPath, 'utf8');
const bookingPage = readFileSync(bookingPagePath, 'utf8');
const endpoints = readFileSync(endpointsPath, 'utf8');
const catalog = readFileSync(catalogPath, 'utf8');

test('booking RPC uses the named reference constraint and accepts any non-empty service list', () => {
  assert.match(schema, /reference_no text not null unique/i);
  assert.match(migration, /create or replace function public\.book_appointment\(/i);
  assert.match(migration, /on conflict on constraint appointments_reference_no_key do nothing/i);
  assert.doesNotMatch(migration, /on conflict\s*\(\s*reference_no\s*\)/i);
  assert.match(migration, /if p_service_ids is null or cardinality\(p_service_ids\) < 1/i);
  assert.match(migration, /raise exception 'Select at least one service'/i);
  assert.doesNotMatch(migration, /between 1 and 8|one and eight/i);
});

test('corrective booking RPC retains scoped booking safeguards and privileges', () => {
  for (const contract of [
    /security definer/i,
    /set search_path = public/i,
    /role = 'customer' and is_active/i,
    /role in \('staff', 'admin'\) and is_active and accepts_appointments/i,
    /pg_advisory_xact_lock\(hashtextextended\('booking-date:'/i,
    /v_duration > 600/i,
    /a\.staff_id = p_staff_id or a\.staff_id is null/i,
    /a\.booking_range && tstzrange/i,
    /exception when exclusion_violation/i,
    /revoke all on function public\.book_appointment\(text\[\], uuid, date, time\) from public/i,
    /grant execute on function public\.book_appointment\(text\[\], uuid, date, time\) to authenticated/i,
  ]) {
    assert.match(migration, contract);
  }
});

test('booking migration mirror stays byte-for-byte identical', () => {
  assert.equal(readFileSync(mirrorPath, 'utf8'), migration);
});

test('booking clients and catalog do not impose an eight-service cap', () => {
  assert.doesNotMatch(endpoints, /cleanIds\.length\s*>\s*8/);
  assert.doesNotMatch(bookingPage, /current\.length\s*>=\s*8|selectedIds\.length\s*>\s*8|selectionLimit=\{8\}|one to eight|\/8/);
  assert.match(bookingPage, /<ServiceCatalog[^>]*selectable selectedIds=\{selectedIds\}/);
  assert.match(catalog, /selectionLimit = null/);
  assert.match(catalog, /hasSelectionLimit/);
});
