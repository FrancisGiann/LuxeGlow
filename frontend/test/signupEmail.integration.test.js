import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const originalFetch = globalThis.fetch;
const originalUrl = process.env.VITE_SUPABASE_URL;
const originalKey = process.env.VITE_SUPABASE_ANON_KEY;
const calls = [];
let server;
let registerCustomer;
let checkSignupEmailAvailability;
let available = true;
let availabilityStatus = 200;
let signupStatus = 200;
process.env.VITE_SUPABASE_URL = 'https://supabase.test';
process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-test-key';
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  assert.equal(url.hostname, 'supabase.test');
  calls.push({ path: url.pathname, ...JSON.parse(init.body) });
  if (url.pathname === '/functions/v1/signup-email-availability') return Response.json({ available }, { status: availabilityStatus, headers: { 'Retry-After': '900' } });
  assert.equal(url.pathname, '/auth/v1/signup');
  if (signupStatus !== 200) return Response.json({ code: 'user_already_exists', msg: 'User already registered' }, { status: signupStatus, headers: { 'x-supabase-api-version': '2024-01-01' } });
  return Response.json({ user: { id: 'synthetic-user', email: calls.at(-1).email }, session: null });
};

before(async () => {
  server = await createServer({ root, configFile: resolve(root, 'vite.config.js'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  ({ registerCustomer, checkSignupEmailAvailability } = await server.ssrLoadModule('/src/api/endpoints.js'));
});
beforeEach(() => { calls.length = 0; available = true; availabilityStatus = 200; signupStatus = 200; });
after(async () => {
  await server?.close();
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL;
  else process.env.VITE_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
  else process.env.VITE_SUPABASE_ANON_KEY = originalKey;
});

const fields = (email) => ({ email, first_name: 'Test', last_name: 'Customer', phone: '09170001122', password: 'Synthetic1!', confirm_password: 'Synthetic1!' });

test('invalid email is rejected before any signup request', async () => {
  for (const email of ['bad@@example.com', 'a..b@example.com', `${'a'.repeat(65)}@example.com`, null]) {
    const result = await registerCustomer(fields(email));
    assert.equal(result.success, false);
    assert.match(result.error, /email address/i);
  }
  assert.equal(calls.length, 0);
});

test('signup trims input and preserves plus tags and casing in the request', async () => {
  const result = await registerCustomer(fields('  Person+Offers@Example.COM  '));
  assert.equal(result.success, true);
  assert.equal(result.needs_verification, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].email, 'Person+Offers@Example.COM');
});

test('a suspected typo remains usable without accepting a suggestion', async () => {
  const result = await registerCustomer(fields('Person+Offers@gmial.com'));
  assert.equal(result.success, true);
  assert.equal(calls[0].email, 'Person+Offers@gmial.com');
});


test('existing emails never reach Auth signup, irrespective of input casing or whitespace', async () => {
  available = false;
  for (const email of ['person@example.test', ' Person@EXAMPLE.test ']) {
    const result = await registerCustomer(fields(email));
    assert.equal(result.success, false); assert.equal(result.email_unavailable, true);
  }
  assert.equal(calls.filter((c) => c.path === '/auth/v1/signup').length, 0);
});

test('unavailable backend fails closed before signup, without a false duplicate claim', async () => {
  availabilityStatus = 503;
  const result = await registerCustomer(fields('person@example.test'));
  assert.equal(result.success, false); assert.equal(result.email_unavailable, undefined);
  assert.equal(calls.filter((c) => c.path === '/auth/v1/signup').length, 0);
});

test('final Auth rejection after available preflight cannot produce app signup success', async () => {
  signupStatus = 422;
  const result = await registerCustomer(fields('person@example.test'));
  assert.equal(result.success, false);
  assert.equal(result.email_unavailable, true);
});

test('availability preflight is read-only and sends only the email', async () => {
  const result = await checkSignupEmailAvailability(' Person+Tag@Example.test ');
  assert.deepEqual(result, { ok: true, available: true });
  assert.deepEqual(calls, [{ path: '/functions/v1/signup-email-availability', email: 'Person+Tag@Example.test' }]);
});


test('budget exhaustion preserves retry guidance and cannot request signup or OTP email', async () => {
  availabilityStatus = 429;
  const checked = await checkSignupEmailAvailability('person@example.test');
  assert.equal(checked.ok, false); assert.equal(checked.retryAfter, 900);
  assert.match(checked.error, /temporarily limited.*15 minutes.*details remain/i);
  const submitted = await registerCustomer(fields('person@example.test'));
  assert.equal(submitted.success, false); assert.equal(submitted.email_unavailable, undefined);
  assert.match(submitted.error, /temporarily limited/i);
  assert.ok(calls.every((call) => call.path === '/functions/v1/signup-email-availability'));
  availabilityStatus = 200;
  const retried = await registerCustomer(fields('person@example.test'));
  assert.equal(retried.success, true);
});
