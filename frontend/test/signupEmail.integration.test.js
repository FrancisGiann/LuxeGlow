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
process.env.VITE_SUPABASE_URL = 'https://supabase.test';
process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-test-key';
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  assert.equal(url.hostname, 'supabase.test');
  assert.equal(url.pathname, '/auth/v1/signup');
  calls.push(JSON.parse(init.body));
  return Response.json({ user: { id: 'synthetic-user', email: calls.at(-1).email }, session: null });
};

before(async () => {
  server = await createServer({ root, configFile: resolve(root, 'vite.config.js'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  ({ registerCustomer } = await server.ssrLoadModule('/src/api/endpoints.js'));
});
beforeEach(() => { calls.length = 0; });
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
  assert.equal(calls.length, 1);
  assert.equal(calls[0].email, 'Person+Offers@Example.COM');
});

test('a suspected typo remains usable without accepting a suggestion', async () => {
  const result = await registerCustomer(fields('Person+Offers@gmial.com'));
  assert.equal(result.success, true);
  assert.equal(calls[0].email, 'Person+Offers@gmial.com');
});
