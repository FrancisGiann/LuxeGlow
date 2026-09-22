import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHeadInviteState } from '../src/utils/staffInvitations.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const adminPage = read('frontend/src/pages/AdminPage.jsx');
const inviteFunction = read('supabase/functions/invite-staff/index.ts');

test('head invitations are blocked only when an active head already exists', () => {
  const activeHead = { role: 'head', is_active: true };
  const inactiveHead = { role: 'head', is_active: false };
  const activeAdmin = { role: 'admin', is_active: true };

  assert.deepEqual(getHeadInviteState('head', [activeHead]), {
    hasActiveHead: true,
    disabled: true,
  });
  assert.deepEqual(getHeadInviteState('head', [inactiveHead]), {
    hasActiveHead: false,
    disabled: false,
  });
  assert.deepEqual(getHeadInviteState('head', [activeAdmin]), {
    hasActiveHead: false,
    disabled: false,
  });
  assert.deepEqual(getHeadInviteState('admin', [activeHead]), {
    hasActiveHead: true,
    disabled: false,
  });
  assert.deepEqual(getHeadInviteState('head', null), {
    hasActiveHead: false,
    disabled: false,
  });
});

test('AdminPage defines its render binding from loaded profiles and has no unsupported invite role', () => {
  assert.match(
    adminPage,
    /const \{ disabled: inviteRoleDisabled \} = getHeadInviteState\(\s*inviteForm\.role,\s*staff,\s*\);/,
  );
  assert.match(adminPage, /disabled=\{inviteRoleDisabled\}/);
  assert.match(adminPage, /inviteRoleDisabled \? "A Head is already assigned"/);
  assert.match(adminPage, /<option value="head">Head<\/option>/);
  assert.doesNotMatch(adminPage, /<option value="admin">Admin<\/option>/);

  assert.match(inviteFunction, /callerProfile\.role !== 'admin'/);
  assert.match(inviteFunction, /if \(role !== 'head'\)/);
});
