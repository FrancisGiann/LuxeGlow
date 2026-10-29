import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRecoveryLink } from '../src/utils/recoveryLink.js';

test('only a full recovery identifier and random token parse', () => {
  const id = '01234567-89ab-4cde-8fab-0123456789ab';
  const token = 'a'.repeat(64);
  assert.deepEqual(parseRecoveryLink(`#recovery_id=${id}&recovery_token=${token}`), { id, token });
  assert.equal(parseRecoveryLink(`#recovery_id=${id}&recovery_token=weak`), null);
});
