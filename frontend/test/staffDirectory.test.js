import assert from 'node:assert/strict';
import test from 'node:test';
import { createStaffDirectory } from '../src/utils/staffDirectory.js';

test('directory combines the confirmed team and admin/head accounts without merging shared IDs or names', () => {
  const sharedId = 'shared-uuid';
  const directory = createStaffDirectory(
    [
      { id: 'owner-id', record_kind: 'owner', full_name: 'Leth S. Alfabete', is_active: true, is_bookable: false },
      { id: sharedId, record_kind: 'staff', full_name: 'Jen Reyes', is_active: true, is_bookable: true },
      { id: 'legacy-id', record_kind: 'legacy', full_name: 'Historical Profile Copy', is_active: false, is_bookable: false },
    ],
    [
      { id: sharedId, role: 'head', first_name: 'Jen', last_name: 'Reyes', email: 'jen@example.test', is_active: true },
      { id: 'admin-id', role: 'admin', first_name: 'Ari', last_name: 'Example', email: 'ari@example.test', is_active: false },
      { id: 'customer-id', role: 'customer', first_name: 'Customer', is_active: true },
    ],
  );

  assert.deepEqual(directory.map(({ key, roleLabel, name }) => ({ key, roleLabel, name })), [
    { key: 'member:owner-id', roleLabel: 'Owner', name: 'Leth S. Alfabete' },
    { key: 'member:shared-uuid', roleLabel: 'Staff', name: 'Jen Reyes' },
    { key: 'account:shared-uuid', roleLabel: 'Head', name: 'Jen Reyes' },
    { key: 'account:admin-id', roleLabel: 'Admin', name: 'Ari Example' },
  ]);
  assert.equal(directory.some((entry) => entry.id === 'legacy-id'), false);
  assert.equal(directory.some((entry) => entry.id === 'customer-id'), false);
});

test('directory omits missing IDs and labels an account from its available profile fields', () => {
  const directory = createStaffDirectory(
    [{ record_kind: 'staff', full_name: 'Missing ID' }],
    [{ id: 'head-id', role: 'head', email: 'head@example.test', is_active: true }],
  );

  assert.equal(directory.length, 1);
  assert.equal(directory[0].key, 'account:head-id');
  assert.equal(directory[0].name, 'head@example.test');
});
