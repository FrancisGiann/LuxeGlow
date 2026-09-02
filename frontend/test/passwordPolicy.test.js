import assert from 'node:assert/strict';
import test from 'node:test';
import { getPasswordPolicyError, PASSWORD_POLICY_MESSAGE, validatePassword } from '../src/utils/passwordPolicy.js';

test('accepts a password with every required character class', () => {
  assert.deepEqual(validatePassword('Astrid1!'), {
    minLength: true,
    uppercase: true,
    lowercase: true,
    number: true,
    symbol: true,
    valid: true,
  });
  assert.equal(getPasswordPolicyError('Astrid1!'), '');
});

const invalidPasswords = [
  ['too short', 'A1!abc', 'minLength'],
  ['missing uppercase', 'astrid1!', 'uppercase'],
  ['missing lowercase', 'ASTRID1!', 'lowercase'],
  ['missing number', 'Astrid!!', 'number'],
  ['missing symbol', 'Astrid123', 'symbol'],
];

for (const [description, password, failedRequirement] of invalidPasswords) {
  test(`rejects passwords ${description}`, () => {
    const result = validatePassword(password);
    assert.equal(result.valid, false);
    assert.equal(result[failedRequirement], false);
    assert.equal(getPasswordPolicyError(password), PASSWORD_POLICY_MESSAGE);
  });
}

test('rejects null and non-string values safely', () => {
  for (const value of [null, undefined, 12345678, {}, ['Astrid1!']]) {
    assert.equal(validatePassword(value).valid, false);
    assert.equal(getPasswordPolicyError(value), PASSWORD_POLICY_MESSAGE);
  }
});
