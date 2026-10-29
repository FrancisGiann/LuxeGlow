import test from 'node:test';
import assert from 'node:assert/strict';
import { claimEmailAlias, loginWithEmailAlias, maySendRecoveryEmail, normalizePhilippineMobile } from './gateway.mjs';

const email = 'customer@example.test';
const phone = '+639171234567';
const userId = 'customer-1';

function fixture(overrides = {}) {
  const alias = { kind: 'customer', emailVerifiedAt: null, phoneVerifiedAt: 'now',
    phone, userId, expiresAt: '2099-01-01T00:00:00Z', ...overrides.alias };
  const calls = [];
  const store = {
    lookup: async () => alias,
    getProfile: async () => ({ role: 'customer', isActive: true, ...overrides.profile }),
    claimIfAvailable: async (claim) => { calls.push(['claim', claim]); return true; },
  };
  const auth = {
    signInPhonePassword: async (target, secret) => { calls.push(['phone-auth', target, secret]); return { user: { id: userId }, session: { access_token: 'synthetic' } }; },
    signInEmailPassword: async () => { calls.push(['email-auth']); return { session: { access_token: 'legacy' } }; },
    getUserById: async () => ({ phone, phoneConfirmedAt: 'now', ...overrides.user }),
  };
  const limits = { reserve: async () => true, releaseSuccess: async () => {} };
  return { store, auth, limits, calls };
}

const request = (f) => loginWithEmailAlias({ email, password: 'correct-password', ip: '192.0.2.1', ...f });

test('normalizes only Philippine mobile shapes, not carrier prefixes', () => {
  assert.equal(normalizePhilippineMobile('0917 123 4567'), phone);
  assert.equal(normalizePhilippineMobile(phone), phone);
  assert.equal(normalizePhilippineMobile('+15551234567'), null);
});

test('alias uses verified phone password grant and checks user identity', async () => {
  const f = fixture();
  assert.equal((await request(f)).session.access_token, 'synthetic');
  assert.deepEqual(f.calls[0], ['phone-auth', phone, 'correct-password']);
});

test('existing verified-email login still uses email grant', async () => {
  const f = fixture(); f.store.lookup = async () => null;
  assert.equal((await request(f)).session.access_token, 'legacy');
  assert.deepEqual(f.calls, [['email-auth']]);
});

test('unverified phone and mismatched Auth user fail closed', async () => {
  const f = fixture({ user: { phoneConfirmedAt: null } });
  assert.equal((await request(f)).status, 401);
  const g = fixture({ user: { phone: '+639181234567' } });
  assert.equal((await request(g)).status, 401);
});

test('expired alias, inactive profile, and email-confirmed alias cannot use alias grant', async () => {
  for (const changes of [
    { alias: { expiresAt: '2000-01-01T00:00:00Z' } },
    { profile: { isActive: false } },
    { alias: { emailVerifiedAt: 'now' } },
  ]) assert.equal((await request(fixture(changes))).status, 401);
});

test('rate limit applies before lookup and password verification', async () => {
  const f = fixture(); f.limits.reserve = async () => false;
  assert.equal((await request(f)).status, 429);
  assert.equal(f.calls.length, 0);
});

test('provider failure is generic and grants no session', async () => {
  const f = fixture(); f.auth.signInPhonePassword = async () => { throw Error('secret provider error'); };
  assert.deepEqual(await request(f), { ok: false, status: 503, error: 'Sign-in is unavailable. Try again later.' });
});

test('alias claim requires authoritative verified phone', async () => {
  const f = fixture({ user: { phoneConfirmedAt: null } });
  assert.equal((await claimEmailAlias({ email, userId, store: f.store, auth: f.auth })).ok, false);
  assert.equal(f.calls.length, 0);
});

test('recovery stays unavailable until independent email confirmation', async () => {
  const f = fixture();
  assert.equal(await maySendRecoveryEmail({ email, store: f.store, auth: f.auth }), false);
  const g = fixture({ alias: { emailVerifiedAt: 'time-1', recoveryEmailVerifiedAt: 'time-1' },
    user: { email, emailConfirmedAt: 'time-1' } });
  assert.equal(await maySendRecoveryEmail({ email, store: g.store, auth: g.auth }), true);
  const h = fixture({ alias: { emailVerifiedAt: 'time-1', recoveryEmailVerifiedAt: 'time-1' },
    user: { email: 'other@example.test', emailConfirmedAt: 'time-1' } });
  assert.equal(await maySendRecoveryEmail({ email, store: h.store, auth: h.auth }), false);
});
