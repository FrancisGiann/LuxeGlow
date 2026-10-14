import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyLoginAuthFailure } from '../../supabase/functions/_shared/loginAuthFailure.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const gatewaySource = readFileSync(resolve(projectRoot, 'supabase/functions/login-rate-limit/index.ts'), 'utf8');

test('login gateway requests the structured modern GoTrue error contract', () => {
  assert.match(gatewaySource, /'x-supabase-api-version': '2024-01-01'/);
  assert.match(gatewaySource, /classifyLoginAuthFailure\(authResponse\.status, authData\)/);
});

test('modern GoTrue 400 invalid_credentials is marked as a password failure', () => {
  assert.deepEqual(classifyLoginAuthFailure(400, { code: 'invalid_credentials', message: 'Invalid login credentials' }), {
    status: 401,
    body: { error: 'Invalid email or password.', invalid_credentials: true },
  });
});

test('legacy GoTrue error_code invalid_credentials is recognized when code is the HTTP status', () => {
  assert.deepEqual(classifyLoginAuthFailure(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }), {
    status: 401,
    body: { error: 'Invalid email or password.', invalid_credentials: true },
  });
});

test('modern and legacy email_not_confirmed responses enter verification only', () => {
  const expected = {
    status: 401,
    body: {
      error: 'Verify your email address to continue.',
      needs_verification: true,
    },
  };
  assert.deepEqual(classifyLoginAuthFailure(400, { code: 'email_not_confirmed', message: 'Email not confirmed' }), expected);
  assert.deepEqual(classifyLoginAuthFailure(400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' }), expected);
});

test('conflicting or malformed upstream code fields stay unclassified', () => {
  for (const payload of [
    { code: 'invalid_credentials', error_code: 'email_not_confirmed' },
    { code: 403, error_code: 'invalid_credentials' },
    { code: 'invalid_credentials', error_code: {} },
    { code: null, error_code: 'invalid_credentials' },
    { code: ['invalid_credentials'] },
    { error_code: 'INVALID_CREDENTIALS' },
    { msg: 'Invalid login credentials' },
    null,
    [],
  ]) {
    assert.deepEqual(classifyLoginAuthFailure(400, payload), {
      status: 401,
      body: { error: 'Invalid email or password.' },
    });
  }
});

test('unknown upstream codes and unexpected statuses remain unclassified', () => {
  for (const payload of [{ code: 'invalid_request' }, { code: 'user_banned' }, {}, undefined]) {
    assert.deepEqual(classifyLoginAuthFailure(400, payload), {
      status: 401,
      body: { error: 'Invalid email or password.' },
    });
  }
  for (const status of [401, 403, 429, 500]) {
    assert.deepEqual(classifyLoginAuthFailure(status, { code: 'invalid_credentials' }), {
      status: 401,
      body: { error: 'Invalid email or password.' },
    });
  }
});
