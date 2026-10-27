import assert from 'node:assert/strict';
import test from 'node:test';
import { createSignupAvailabilityHandler } from '../../supabase/functions/_shared/signupAvailability.js';
const origin = 'https://synthetic.example';
const request = (body = { email: ' Person+Offers@Example.test ' }, headers = {}, method = 'POST') => new Request('https://edge.example/signup-email-availability', {
  method, headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.10', ...headers },
  ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
});
const handler = (lookup, overrides = {}) => createSignupAvailabilityHandler({ allowedOrigin: origin, hashSecret: 'synthetic-only-secret-0123456789abcdef', checkAvailability: lookup, ...overrides });

test('returns only one boolean and passes normalized email plus keyed email hash to service RPC', async () => {
  for (const available of [true, false]) {
    const h = handler(async (email, emailHash) => {
      assert.equal(email, 'person+offers@example.test'); assert.match(emailHash, /^[a-f0-9]{64}$/);
      return { allowed: true, available, role: 'private', active: false };
    });
    const res = await h(request()); assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { available });
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
});

test('abuse budgets deny lookup results with generic 429 and Retry-After', async () => {
  const res = await handler(async () => ({ allowed: false, retry_after: 40 }))(request());
  assert.equal(res.status, 429); assert.equal(res.headers.get('Retry-After'), '40');
  assert.deepEqual(Object.keys(await res.json()), ['error']);
});

test('origin/method/body/config failures do not call the database', async () => {
  let calls = 0; const lookup = async () => { calls++; throw new Error('must not call'); };
  for (const req of [request({}, { origin: 'https://evil.example' }), request({}, {}, 'GET'),
    request({ email: 'not-email' }),
    request({}, { 'content-length': '5000' }), request({ email: 'a'.repeat(2000) }),
    request({}, { 'content-type': 'text/plain' })]) assert.notEqual((await handler(lookup)(req)).status, 200);
  assert.equal((await handler(lookup, { hashSecret: '' })(request())).status, 503);
  assert.equal(calls, 0);
});

test('provider errors and malformed results are generic failures, never membership hints', async () => {
  for (const lookup of [async () => { throw new Error('private provider failure'); }, async () => ({ allowed: true }), async () => ({ available: true })]) {
    const res = await handler(lookup)(request()); assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'Could not check this email right now. Please try again.' });
  }
});


test('spoofed forwarding/IP headers cannot change or bypass the server-derived budget key', async () => {
  const keys = [];
  const h = handler(async (_email, key) => { keys.push(key); return { allowed: true, available: true }; });
  for (const headers of [{ 'x-forwarded-for': '' }, { 'x-forwarded-for': '198.51.100.1', 'cf-connecting-ip': '198.51.100.2' }, { 'x-forwarded-for': 'forged, random' }]) {
    assert.equal((await h(request(undefined, headers))).status, 200);
  }
  assert.equal(new Set(keys).size, 1);
});
