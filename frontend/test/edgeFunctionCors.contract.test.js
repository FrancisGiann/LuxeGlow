import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const functionSources = {
  'invite-staff': readFileSync(resolve(projectRoot, 'supabase/functions/invite-staff/index.ts'), 'utf8'),
  'reset-staff-password': readFileSync(resolve(projectRoot, 'supabase/functions/reset-staff-password/index.ts'), 'utf8'),
  'login-rate-limit': readFileSync(resolve(projectRoot, 'supabase/functions/login-rate-limit/index.ts'), 'utf8'),
  'upload-service-image': readFileSync(resolve(projectRoot, 'supabase/functions/upload-service-image/index.ts'), 'utf8'),
};

const SUPABASE_FUNCTION_HEADERS = ['apikey', 'authorization', 'content-type', 'x-client-info'];

test('browser-facing Edge Functions allow the headers sent by supabase-js', () => {
  for (const [name, source] of Object.entries(functionSources)) {
    const headerMatch = source.match(/['"]Access-Control-Allow-Headers['"]\s*:\s*['"]([^'"]+)['"]/i);
    assert.ok(headerMatch, `${name} CORS headers`);
    assert.deepEqual(headerMatch[1].split(',').map((header) => header.trim().toLowerCase()).sort(), [...SUPABASE_FUNCTION_HEADERS].sort(), `${name} CORS headers`);
    assert.doesNotMatch(source, /Access-Control-Allow-Headers['"]?\s*:\s*['"][^'"]*\*/i, `${name} must not use wildcard CORS headers`);
    assert.match(source, /Access-Control-Allow-Methods['"]?\s*:\s*['"]POST, OPTIONS['"]/, `${name} CORS methods`);
  }
});

test('invite-staff OPTIONS contract permits x-client-info without broadening origins', () => {
  const source = functionSources['invite-staff'];
  assert.match(source, /if \(request\.method === 'OPTIONS'\) return new Response\(null, \{ status: 204, headers \}\);/);
  assert.match(source, /'Access-Control-Allow-Origin': origin/);
  assert.match(source, /const origin = Deno\.env\.get\('ALLOWED_ORIGIN'\) \|\| 'null';/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin['"]?\s*:\s*['"]\*/i);
});
