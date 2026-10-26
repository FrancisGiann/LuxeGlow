import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateStaffRosterEntry } from '../src/utils/staffRoster.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('roster input normalizes names and titles, whitelists fields, and permits shared names', () => {
  assert.deepEqual(validateStaffRosterEntry({ full_name: '  Test\n Stylist  ', position_title: ' Nail\tArtist ', role: 'admin', email: 'unused@example.test' }), {
    success: true, value: { full_name: 'Test Stylist', position_title: 'Nail Artist' },
  });
  assert.deepEqual(validateStaffRosterEntry({ full_name: 'Synthetic Stylist', position_title: ' ' }).value, { full_name: 'Synthetic Stylist', position_title: null });
  assert.equal(validateStaffRosterEntry({ full_name: '名'.repeat(201) }).success, true);
});

test('roster input rejects blank, malformed, excessive, and control-character values', () => {
  for (const fields of [null, [], {}, { full_name: 1 }, { full_name: ' \n ' }, { full_name: 'x'.repeat(202) }, { full_name: 'Test\0Name' }, { full_name: 'Test\u202eName' }, { full_name: 'Test', position_title: {} }, { full_name: 'Test', position_title: 'x'.repeat(101) }]) {
    assert.equal(validateStaffRosterEntry(fields).success, false, JSON.stringify(fields));
  }
});

test('migration narrows creation permissions, enforces server authorization and input bounds, and preserves history', () => {
  const sql = read('supabase/migrations/20261026010000_booking_staff_management.sql');
  assert.equal(sql, read('database/supabase/migrations/20261026010000_booking_staff_management.sql'));
  for (const pattern of [/revoke insert on public.staff_members from authenticated/i, /security definer\s+set search_path = public, pg_temp/i, /if not public.is_admin\(\)/i, /errcode = '42501'/i, /char_length\(v_name\) not between 1 and 201/i, /char_length\(v_title\) > 100/i, /'staff-' \|\| v_id::text, 'staff', v_name, v_title, true, true/i, /revoke all on function public.create_booking_staff\(text, text\) from public, anon/i]) assert.match(sql, pattern);
  assert.doesNotMatch(sql, /(?:update|delete from) public\.(appointments|profiles|staff_members)|auth\.users/i);
  const roster = read('supabase/migrations/20261014030000_independent_staff_roster.sql');
  assert.match(roster, /for update to authenticated\s+using \(public.is_admin\(\)\)\s+with check \(public.is_admin\(\)\)/i);
  assert.doesNotMatch(roster, /grant delete/i);
  const booking = read('supabase/migrations/20261014030001_staff_roster_booking_cutover.sql');
  assert.match(booking, /m\.is_active and m\.is_bookable/i);
});

test('UI differentiates roster creation from accounts and describes safe removal', () => {
  const component = read('frontend/src/components/admin/AddBookingStaff.jsx');
  const page = read('frontend/src/pages/AdminPage.jsx');
  assert.match(component, /no login account or access permissions/);
  assert.match(component, /if \(savingRef.current\) return/);
  assert.match(component, /role="alert"/);
  assert.match(page, /Remove from booking/);
  assert.match(page, /Existing appointments, ratings, and roster identity are kept/);
  assert.match(page, /<AddBookingStaff onSave=\{addRosterMember\}/);
});
