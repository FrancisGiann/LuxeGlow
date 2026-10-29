import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const original = {
  fetch: globalThis.fetch,
  url: process.env.VITE_SUPABASE_URL,
  anon: process.env.VITE_SUPABASE_ANON_KEY,
  flag: process.env.VITE_SMS_SIGNUP_ENABLED,
};
let server;
let registerCustomer;
let verifySignupPhone;
const requests = [];

process.env.VITE_SUPABASE_URL = 'https://supabase.test';
process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-test-key';
process.env.VITE_SMS_SIGNUP_ENABLED = 'true';
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  assert.equal(url.hostname, 'supabase.test');
  requests.push({ path: url.pathname, body: JSON.parse(init.body || '{}') });
  if (url.pathname === '/functions/v1/signup-email-availability') {
    return Response.json({ available: true });
  }
  if (url.pathname === '/auth/v1/verify') {
    return Response.json({ user: { id: 'synthetic-phone-user', phone: '+639170001122' },
      access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600 });
  }
  if (url.pathname === '/functions/v1/claim-sms-signup') return Response.json({ success: true });
  if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
  if (url.pathname === '/auth/v1/signup') {
    return Response.json({ user: { id: 'synthetic-phone-user', phone: requests.at(-1).body.phone }, session: null });
  }
  throw new Error(`Unexpected request: ${url.pathname}`);
};

before(async () => {
  server = await createServer({ root, configFile: resolve(root, 'vite.config.js'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  ({ registerCustomer, verifySignupPhone } = await server.ssrLoadModule('/src/api/endpoints.js'));
});
after(async () => {
  await server?.close();
  globalThis.fetch = original.fetch;
  for (const [name, value] of [
    ['VITE_SUPABASE_URL', original.url], ['VITE_SUPABASE_ANON_KEY', original.anon], ['VITE_SMS_SIGNUP_ENABLED', original.flag],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const fields = (phone = '0917 000 1122') => ({
  first_name: 'Synthetic', last_name: 'Customer', email: 'SYNTHETIC+signup@example.com', phone,
  password: 'Synthetic1!', confirm_password: 'Synthetic1!',
});

test('SMS signup creates phone Auth identity and carries unverified email only as metadata', async () => {
  const result = await registerCustomer(fields());
  assert.equal(result.success, true);
  assert.equal(result.needs_phone_verification, true);
  assert.equal(result.phone, '+639170001122');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].path, '/functions/v1/signup-email-availability');
  assert.equal(requests[1].path, '/auth/v1/signup');
  assert.equal(requests[1].body.phone, '+639170001122');
  assert.equal(requests[1].body.email, undefined);
  assert.equal(requests[1].body.data.pending_login_email, 'SYNTHETIC+signup@example.com');
});

test('non-mobile number is rejected before Auth request', async () => {
  const beforeCount = requests.length;
  const result = await registerCustomer(fields('+15551234567'));
  assert.equal(result.success, false);
  assert.match(result.error, /Philippine mobile/);
  assert.equal(requests.length, beforeCount);
});

test('phone proof claims the alias then ends the OTP session before email/password login', async () => {
  const result = await verifySignupPhone({ phone: '+639170001122', code: '123456', email: 'synthetic+signup@example.com' });
  assert.equal(result.success, true);
  assert.deepEqual(requests.slice(-3).map(({ path }) => path), ['/auth/v1/verify', '/functions/v1/claim-sms-signup', '/auth/v1/logout']);
});
