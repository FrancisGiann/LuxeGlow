import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eligibleRecoveryDestination, GENERIC_REQUEST, keyedHash, normalizeRecoveryIdentifier,
  randomDigits, randomToken, recoveryEmailLink, recoverySms,
} from '../../supabase/functions/_shared/passwordRecovery.js';

const user = { id: 'user-1', phone: '+639171234567', phone_confirmed_at: '2026-01-01', email: null, email_confirmed_at: null };
const alias = { user_id: 'user-1', email_normalized: 'person@example.com', phone_e164: user.phone };
test('unverified alias supports verified-phone recovery only', () => {
  assert.equal(eligibleRecoveryDestination(user, alias, 'person@example.com', 'sms'), user.phone);
  assert.equal(eligibleRecoveryDestination({ ...user, phone: '639171234567' }, alias, 'person@example.com', 'sms'), user.phone);
  assert.equal(eligibleRecoveryDestination(user, alias, 'person@example.com', 'email'), null);
  assert.equal(eligibleRecoveryDestination({ ...user, phone_confirmed_at: null }, alias, 'person@example.com', 'sms'), null);
  assert.equal(eligibleRecoveryDestination({ ...user, phone: '+639991111111' }, alias, 'person@example.com', 'sms'), null);
  assert.equal(eligibleRecoveryDestination({ ...user, phone: '639991111111' }, alias, 'person@example.com', 'sms'), null);
  assert.equal(eligibleRecoveryDestination({ ...user, phone: '628171234567' }, alias, 'person@example.com', 'sms'), null);
});
test('email requires independent Supabase Auth confirmation for the same address', () => {
  const attached = { ...user, email: 'person@example.com', email_confirmed_at: '2026-01-02' };
  assert.equal(eligibleRecoveryDestination(attached, alias, 'person@example.com', 'email'), attached.email);
  assert.equal(eligibleRecoveryDestination({ ...attached, email: 'other@example.com' }, alias, 'person@example.com', 'email'), null);
  assert.equal(eligibleRecoveryDestination({ ...attached, email_confirmed_at: null }, alias, 'person@example.com', 'email'), null);
});
test('established verified accounts retain email recovery', () => {
  const established = { ...user, email: 'staff@example.com', email_confirmed_at: '2026-01-01' };
  assert.equal(eligibleRecoveryDestination(established, null, 'staff@example.com', 'email'), established.email);
  assert.equal(eligibleRecoveryDestination(established, null, 'staff@example.com', 'sms'), user.phone);
});
test('identifier normalization and copy do not reveal a destination', () => {
  assert.equal(normalizeRecoveryIdentifier(' Person@Example.com '), 'person@example.com');
  assert.equal(normalizeRecoveryIdentifier('bad'), null);
  assert.match(GENERIC_REQUEST, /If this account/);
  assert.ok(!GENERIC_REQUEST.includes(user.phone));
  assert.equal(recoverySms('12345678'), 'LuxeGlow password reset code: 12345678. Expires in 5 min. Do not share this code.');
  assert.ok(recoverySms('12345678').length <= 160);
});
test('recovery hashes are domain separated from signup and each other', async () => {
  const key = 'x'.repeat(32);
  const a = await keyedHash(key, 'sms-code:user-1', '12345678');
  const b = await keyedHash(key, 'reset-grant', '12345678');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});
test('tokens and codes derive from crypto bytes and email URL escapes parameters', () => {
  assert.match(randomDigits(), /^\d{8}$/);
  assert.match(randomToken(), /^[0-9a-f]{64}$/);
  const url = new URL(recoveryEmailLink('https://luxeglow.example/reset-password', 'id', 'secret'));
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('recovery_id'), 'id');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('recovery_token'), 'secret');
});
