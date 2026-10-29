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
  flag: process.env.VITE_RECOVERY_ENABLED,
};
let server;
let requestPasswordReset;
let fetches = 0;

process.env.VITE_SUPABASE_URL = 'https://supabase.test';
process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-test-key';
process.env.VITE_RECOVERY_ENABLED = 'true';
globalThis.fetch = async () => { fetches += 1; throw new Error('Native recovery must not be called'); };

before(async () => {
  server = await createServer({ root, configFile: resolve(root, 'vite.config.js'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  ({ requestPasswordReset } = await server.ssrLoadModule('/src/api/endpoints.js'));
});
after(async () => {
  await server?.close();
  globalThis.fetch = original.fetch;
  for (const [name, value] of [
    ['VITE_SUPABASE_URL', original.url], ['VITE_SUPABASE_ANON_KEY', original.anon], ['VITE_RECOVERY_ENABLED', original.flag],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('custom recovery flag prevents the frontend from requesting a native reset link', async () => {
  const result = await requestPasswordReset('synthetic@example.com');
  assert.equal(result.success, false);
  assert.match(result.error, /account recovery options/);
  assert.equal(fetches, 0);
});
