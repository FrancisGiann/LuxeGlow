import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPasswordPolicyError } from '../src/utils/passwordPolicy.js';
const source = readFileSync(new URL('../src/api/endpoints.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('export async function completePasswordReset'), source.indexOf('export async function logoutCustomer')).replace('export ', '');
function fixture(session = { user: { id: 'recipient' } }) {
  const calls = [];
  const client = { auth: {
    getSession: async () => ({ data: { session }, error: null }),
    updateUser: async (value) => { calls.push(['update', value]); return { error: null }; },
    signOut: async (value) => { calls.push(['signOut', value]); },
    verifyOtp: async () => { throw new Error('Code fallback must never run'); },
  } };
  const complete = new Function('requireSupabase', 'getPasswordPolicyError', body + '; return completePasswordReset;')(() => client, getPasswordPolicyError);
  return { complete, calls };
}
const fields = { password: 'Synthetic-test-123!', confirmPassword: 'Synthetic-test-123!', expectedUserId: 'recipient' };
for (const flowType of ['invite', 'recovery']) test(`${flowType} completion updates only the verified recipient and revokes sessions`, async () => {
  const { complete, calls } = fixture();
  assert.equal((await complete({ ...fields, flowType })).success, true);
  assert.deepEqual(calls, [['update', { password: fields.password }], ['signOut', { scope: 'global' }]]);
});
for (const [label, override, session] of [
  ['ordinary session without callback', { flowType: '' }, undefined],
  ['callback without recipient identity', { flowType: 'invite', expectedUserId: '' }, undefined],
  ['different signed-in account', { flowType: 'recovery' }, { user: { id: 'other' } }],
  ['missing session even with a code', { flowType: 'recovery', code: '123456', email: 'synthetic@example.com' }, null],
  ['password mismatch', { flowType: 'invite', confirmPassword: 'different' }, undefined],
  ['weak password', { flowType: 'invite', password: 'short', confirmPassword: 'short' }, undefined],
]) test(`rejects ${label} without updating credentials`, async () => {
  const { complete, calls } = fixture(session);
  assert.equal((await complete({ ...fields, ...override })).success, false);
  assert.deepEqual(calls, []);
});
