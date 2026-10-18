import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalEnv = Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].map((key) => [key, process.env[key]]));
const callerId = '123e4567-e89b-42d3-a456-426614174000';
const calls = [];
const services = new Map();
let updateLosesRace = false;
let server;
let saveService;
let supabase;

const json = (body, status = 200) => Response.json(body, { status });
const serviceFields = (name, extra = {}) => ({
  name,
  category: 'Nails',
  subcategory: 'Nail care',
  item_type: 'service',
  price: 450,
  duration_minutes: 60,
  description: '',
  is_active: true,
  ...extra,
});

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ path: url.pathname, method, query: url.searchParams, body });

  if (url.pathname.endsWith('/auth/v1/user')) return json({ id: callerId, email: 'admin@example.test', user_metadata: {} });
  if (url.pathname.endsWith('/rest/v1/profiles')) return json({ role: 'admin', is_active: true });
  if (url.pathname.endsWith('/rest/v1/services')) {
    const idFilter = url.searchParams.get('id');
    const id = idFilter?.startsWith('eq.') ? idFilter.slice(3) : null;
    if (method === 'GET') {
      const existing = id ? services.get(id) : null;
      if (!existing) return json({ code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, no rows returned' }, 406);
      return json({ id: existing.id, category: existing.category, subcategory: existing.subcategory, item_type: existing.item_type });
    }
    if (method === 'POST') {
      if (services.has(body.id)) return json({ code: '23505', message: 'duplicate key value violates unique constraint services_pkey' }, 409);
      services.set(body.id, { ...body });
      return json({ id: body.id }, 201);
    }
    if (method === 'PATCH') {
      const existing = services.get(id);
      if (!existing || updateLosesRace) return json({ code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, no rows returned' }, 406);
      services.set(id, { ...existing, ...body });
      return json({ id }, 200);
    }
  }
  throw new Error(`Unexpected mock request: ${method} ${url.pathname}`);
};

process.env.VITE_SUPABASE_URL = 'https://supabase.test';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

before(async () => {
  server = await createServer({
    root: frontendRoot,
    configFile: resolve(frontendRoot, 'vite.config.js'),
    server: { middlewareMode: true },
    appType: 'custom',
  });
  ({ saveService } = await server.ssrLoadModule('/src/api/admin.js'));
  ({ supabase } = await server.ssrLoadModule('/src/lib/supabase.js'));
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: callerId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.abcdefgh`;
  const { error } = await supabase.auth.setSession({ access_token: token, refresh_token: 'fixture-refresh-token' });
  assert.equal(error, null);
});

beforeEach(() => {
  calls.length = 0;
  services.clear();
  updateLosesRace = false;
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

test('creates services without asking the user for an ID and gives the request a valid internal ID', async () => {
  const result = await saveService(serviceFields('Package 1'));
  assert.equal(result.success, true);
  assert.match(result.id, /^[a-z0-9][a-z0-9_-]{0,49}$/i);
  const insert = calls.find((call) => call.path.endsWith('/services') && call.method === 'POST');
  assert.equal(insert.body.id, result.id);
  assert.equal(calls.some((call) => call.method === 'PATCH'), false);
});

test('same-name services get distinct IDs and are both inserted', async () => {
  const first = await saveService(serviceFields('Nail care package'));
  const second = await saveService(serviceFields('Nail care package'));
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.notEqual(first.id, second.id);
  assert.equal(services.size, 2);
  assert.equal(calls.filter((call) => call.method === 'POST').length, 2);
});

test('editing preserves a legacy service ID and its unchanged metadata', async () => {
  const existingId = 'Legacy_Manicure_v1';
  services.set(existingId, { id: existingId, name: 'Old name', category: 'Classic', subcategory: 'Legacy care', item_type: 'old-type', image_url: '/kept.png' });
  const result = await saveService(serviceFields('New name', { id: existingId, category: 'Classic', subcategory: 'Legacy care', item_type: 'old-type' }), { existingId });
  assert.deepEqual(result, { success: true, id: existingId });
  assert.equal(services.get(existingId).name, 'New name');
  assert.equal(services.get(existingId).image_url, '/kept.png');
  assert.equal(services.get(existingId).item_type, 'old-type');
  assert.equal(calls.filter((call) => call.method === 'POST').length, 0);
  assert.equal(calls.filter((call) => call.method === 'PATCH').length, 1);
});

test('a duplicate-ID collision on create errors without overwriting the existing service', async () => {
  const existingId = 'collision-safe';
  services.set(existingId, { id: existingId, name: 'Do not replace', price: 100, category: 'Nails', subcategory: 'Nail care', item_type: 'service' });
  const result = await saveService(serviceFields('New service', { id: existingId }));
  assert.equal(result.success, false);
  assert.match(result.error, /could not create this service/i);
  assert.doesNotMatch(result.error, /constraint|ID|23505/i);
  assert.equal(services.get(existingId).name, 'Do not replace');
  assert.equal(calls.some((call) => call.method === 'PATCH'), false);
});

test('missing edits and edits deleted during the write return a not-found result', async () => {
  const missingId = 'missing_service';
  const missing = await saveService(serviceFields('Missing', { id: missingId }), { existingId: missingId });
  assert.equal(missing.success, false);
  assert.match(missing.error, /service could not be found/i);
  assert.equal(calls.some((call) => call.method === 'POST'), false);

  const deletedId = 'deleted_service';
  services.set(deletedId, { id: deletedId, category: 'Nails', subcategory: 'Nail care', item_type: 'service' });
  updateLosesRace = true;
  const deleted = await saveService(serviceFields('Deleted', { id: deletedId }), { existingId: deletedId });
  assert.equal(deleted.success, false);
  assert.match(deleted.error, /service could not be found/i);
});

test('ordinary field and classification validation reject invalid data without a write', async () => {
  const missingName = await saveService(serviceFields('  '));
  assert.equal(missingName.success, false);
  assert.doesNotMatch(missingName.error, /ID/i);
  const invalidCategory = await saveService(serviceFields('Unknown', { category: 'not a category' }));
  assert.equal(invalidCategory.success, false);
  assert.match(invalidCategory.error, /supported service type/i);
  assert.equal(calls.some((call) => ['POST', 'PATCH'].includes(call.method)), false);
});


test('coercible service inputs are rejected before any write while free services and cents remain valid', async () => {
  for (const patch of [{ name: {} }, { name: ['Name'] }, { price: '' }, { price: '   ' }, { price: null }, { price: true }, { price: [] }, { duration_minutes: true }, { duration_minutes: [] }, { is_active: 'false' }]) {
    const result = await saveService(serviceFields('QA type check', patch));
    assert.equal(result.success, false, JSON.stringify(patch));
  }
  assert.equal(calls.some((call) => ['POST', 'PATCH'].includes(call.method)), false);
  for (const price of [0, 12.5, 1000000]) {
    assert.equal((await saveService(serviceFields('合法 Café QA ' + price, { price }))).success, true);
  }
});
