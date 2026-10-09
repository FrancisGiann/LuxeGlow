import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalEnv = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  VITE_ROUTER_BASE: process.env.VITE_ROUTER_BASE,
};
const calls = [];
const userId = '123e4567-e89b-42d3-a456-426614174000';
const targetId = '987e4567-e89b-42d3-a456-426614174000';
let resendStatus = 200;
let resetStatus = 200;
let staffFunctionStatus = 200;
let staffFunctionBody = { success: true };
let inviteFunctionStatus = 200;
let inviteFunctionBody = { success: true };
let server;
let supabase;
let resendVerificationEmail;
let requestPasswordReset;
let resetStaffPassword;
let inviteStaff;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ path: `${url.pathname}${url.search}`, method, body });

  if (url.pathname.endsWith('/auth/v1/resend')) {
    return resendStatus === 200
      ? Response.json({})
      : Response.json({ msg: 'Email rate limit exceeded', error_code: 'over_email_send_rate_limit' }, {
        status: resendStatus,
        headers: { 'Retry-After': '75' },
      });
  }
  if (url.pathname.endsWith('/auth/v1/recover')) {
    return resetStatus === 200
      ? Response.json({})
      : Response.json({ msg: 'Email rate limit exceeded', error_code: 'over_email_send_rate_limit' }, { status: resetStatus });
  }
  if (url.pathname.endsWith('/auth/v1/user')) {
    return Response.json({ id: userId, email: 'admin@example.com', user_metadata: {} });
  }
  if (url.pathname.endsWith('/rest/v1/profiles')) {
    return Response.json({ role: 'admin', is_active: true });
  }
  if (url.pathname.endsWith('/functions/v1/reset-staff-password')) {
    return Response.json(staffFunctionBody, { status: staffFunctionStatus });
  }
  if (url.pathname.endsWith('/functions/v1/invite-staff')) {
    return Response.json(inviteFunctionBody, { status: inviteFunctionStatus });
  }
  throw new Error(`Unexpected mocked request: ${method} ${url.pathname}`);
};

globalThis.window = { location: { origin: 'https://test.example' } };
process.env.VITE_SUPABASE_URL = 'https://supabase.test';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.VITE_ROUTER_BASE = '/test-base';

before(async () => {
  server = await createServer({
    root: frontendRoot,
    configFile: resolve(frontendRoot, 'vite.config.js'),
    server: { middlewareMode: true },
    appType: 'custom',
  });
  ({ resendVerificationEmail, requestPasswordReset } = await server.ssrLoadModule('/src/api/endpoints.js'));
  ({ supabase } = await server.ssrLoadModule('/src/lib/supabase.js'));
  ({ resetStaffPassword, inviteStaff } = await server.ssrLoadModule('/src/api/admin.js'));

  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'authenticated',
  })}.abcdefgh`;
  const { error } = await supabase.auth.setSession({ access_token: token, refresh_token: 'test-refresh-token' });
  assert.equal(error, null);
});

beforeEach(() => {
  calls.length = 0;
  resendStatus = 200;
  resetStatus = 200;
  staffFunctionStatus = 200;
  staffFunctionBody = { success: true };
  inviteFunctionStatus = 200;
  inviteFunctionBody = { success: true };
});

after(async () => {
  await server?.close();
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('verification resend normalizes the address and starts its cooldown after success', async () => {
  const result = await resendVerificationEmail(' Person@Example.com ');
  assert.deepEqual(result, { success: true, retry_after: 60 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/auth/v1/resend');
  assert.equal(calls[0].body.email, 'person@example.com');
  assert.equal(calls[0].body.type, 'signup');
});

test('verification resend returns a cooldown after Supabase rate limits the request', async () => {
  resendStatus = 429;
  const result = await resendVerificationEmail('person@example.com');
  assert.equal(result.success, false);
  assert.equal(result.retry_after, 60);
  assert.match(result.error, /rate limit/i);
});

test('verification resend rejects malformed addresses before making a request', async () => {
  const result = await resendVerificationEmail('not-an-email');
  assert.equal(result.success, false);
  assert.equal(result.retry_after, undefined);
  assert.match(result.error, /valid email/i);
  assert.equal(calls.length, 0);
});

test('public reset requests use the configured callback path and can be requested again', async () => {
  const first = await requestPasswordReset(' Person@Example.com ');
  const second = await requestPasswordReset('person@example.com');
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.match(first.message, /if an account exists/i);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].path, '/auth/v1/recover?redirect_to=https%3A%2F%2Ftest.example%2Ftest-base%2Freset-password');
  assert.equal(calls[0].body.email, 'person@example.com');
});

test('public reset requests reject malformed addresses without contacting Auth', async () => {
  const result = await requestPasswordReset('');
  assert.equal(result.success, false);
  assert.match(result.error, /valid email/i);
  assert.equal(calls.length, 0);
});

test('public reset requests surface Auth rate limits so the form can be retried later', async () => {
  resetStatus = 429;
  const result = await requestPasswordReset('person@example.com');
  assert.equal(result.success, false);
  assert.match(result.error, /rate limit/i);
  assert.equal(calls.length, 1);
});

test('admin password reset invokes the protected function and returns its success body', async () => {
  const result = await resetStaffPassword(targetId);
  assert.deepEqual(result, { success: true });
  const invocation = calls.find((call) => call.path === '/functions/v1/reset-staff-password');
  assert.deepEqual(invocation.body, { user_id: targetId });
});

test('admin password reset preserves the Edge Function failure message', async () => {
  staffFunctionStatus = 502;
  staffFunctionBody = { error: 'Password reset email could not be sent' };
  await assert.rejects(resetStaffPassword(targetId), /Password reset email could not be sent/);
});

test('admin password reset rejects malformed target IDs before invoking the function', async () => {
  const result = await resetStaffPassword('not-a-user-id');
  assert.equal(result.success, false);
  assert.match(result.error, /invalid staff account/i);
  assert.equal(calls.some((call) => call.path === '/functions/v1/reset-staff-password'), false);
});

test('staff invitations retain the Edge Function error message', async () => {
  inviteFunctionStatus = 400;
  inviteFunctionBody = { error: 'A Head is already assigned. Remove the current Head before inviting a new one.' };
  await assert.rejects(
    inviteStaff({ email: 'new-head@example.com', first_name: 'New', last_name: 'Head', role: 'head' }),
    /A Head is already assigned\. Remove the current Head before inviting a new one\./,
  );
  const invocation = calls.find((call) => call.path === '/functions/v1/invite-staff');
  assert.deepEqual(invocation.body, { email: 'new-head@example.com', first_name: 'New', last_name: 'Head', role: 'head' });
});
