import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const functionSource = readFileSync(fileURLToPath(new URL('../../supabase/functions/password-recovery/index.ts', import.meta.url)), 'utf8');

test('recovery throttling does not rely on a caller-controlled forwarded address', () => {
  assert.doesNotMatch(functionSource, /x-forwarded-for|x-real-ip|cf-connecting-ip/i);
  assert.match(functionSource, /keyedHash\(hashKey, 'request-identifier', identifier\)/);
  assert.match(functionSource, /reserve_password_recovery_ip/);
  assert.match(functionSource, /keyedHash\(hashKey, 'verify-challenge', id\)/);
  assert.match(functionSource, /reserve_password_recovery[\s\S]*?p_ip_hash: ipHash/);
});
