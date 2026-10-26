import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const originalFetch = globalThis.fetch;
const env = { VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY };
process.env.VITE_SUPABASE_URL = 'https://roster-fixture.invalid';
process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-anon-key';
const id = '123e4567-e89b-42d3-a456-426614174000';
const memberId = '223e4567-e89b-42d3-a456-426614174000';
let role, active, rpcFailure, api, server;
const calls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  assert.equal(url.hostname, 'roster-fixture.invalid', 'all HTTP stays on the synthetic transport');
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ path: url.pathname, method: init.method || 'GET', body });
  if (url.pathname === '/auth/v1/user') return Response.json({ id, email: 'synthetic@example.test' });
  if (url.pathname === '/rest/v1/profiles') return Response.json({ role, is_active: active });
  if (url.pathname === '/rest/v1/rpc/create_booking_staff') {
    if (rpcFailure) return Response.json({ message: 'Administrator access required.' }, { status: 403 });
    return Response.json({ id: memberId, full_name: body.p_full_name, position_title: body.p_position_title, record_kind: 'staff', is_active: true, is_bookable: true });
  }
  if (url.pathname === '/rest/v1/staff_members' && init.method === 'PATCH') {
    assert.equal(url.searchParams.get('id'), `eq.${memberId}`);
    return Response.json({ id: memberId, is_active: true, is_bookable: body.is_bookable, position_title: null });
  }
  throw new Error(`Unexpected synthetic request ${url.pathname}`);
};
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  server = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  api = await server.ssrLoadModule('/src/api/admin.js');
  const { supabase } = await server.ssrLoadModule('/src/lib/supabase.js');
  const encode = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const token = `${encode({ alg: 'HS256' })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.fixture`;
  assert.equal((await supabase.auth.setSession({ access_token: token, refresh_token: 'fixture' })).error, null);
});
beforeEach(() => { calls.length = 0; role = 'admin'; active = true; rpcFailure = false; });
after(async () => {
  await server?.close();
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
test('creation sends only normalized roster fields, with no account or email mutation', async () => {
  const result = await api.createAdminStaffMember({ full_name: ' Synthetic  Stylist ', position_title: ' Nail Artist ', role: 'admin', email: 'unused@example.test' });
  assert.equal(result.success, true);
  assert.equal(result.member.id, memberId);
  assert.equal(result.member.rating_count, 0);
  assert.deepEqual(calls.find((call) => call.path.endsWith('/create_booking_staff')).body, { p_full_name: 'Synthetic Stylist', p_position_title: 'Nail Artist' });
  assert.equal(calls.filter((call) => call.method !== 'GET').length, 1);
});
test('staff page and new dialog compile through Vite', async () => {
  for (const path of ['/src/pages/AdminPage.jsx', '/src/components/admin/AddBookingStaff.jsx']) {
    const transformed = await server.transformRequest(path);
    assert.ok(transformed?.code);
  }
});
test('invalid fields fail before transport', async () => {
  assert.equal((await api.createAdminStaffMember({ full_name: '' })).success, false);
  assert.equal(calls.length, 0);
});
test('head, customer, and inactive admin cannot create roster entries', async () => {
  for (const [nextRole, nextActive] of [['head', true], ['customer', true], ['admin', false]]) {
    role = nextRole; active = nextActive;
    await assert.rejects(api.createAdminStaffMember({ full_name: 'Test Staff' }), /Administrator access required/);
  }
  assert.equal(calls.some((call) => call.method !== 'GET'), false);
});
test('database denial is surfaced', async () => {
  rpcFailure = true;
  await assert.rejects(api.createAdminStaffMember({ full_name: 'Test Staff' }), /Administrator access required/);
});
test('remove and restore only change bookability, retaining identity', async () => {
  for (const is_bookable of [false, true]) {
    const result = await api.updateAdminStaffMember(memberId, { is_bookable });
    assert.equal(result.success, true);
    assert.equal(result.is_bookable, is_bookable);
  }
  assert.deepEqual(calls.filter((call) => call.method !== 'GET').map((call) => call.body), [{ is_bookable: false }, { is_bookable: true }]);
});
