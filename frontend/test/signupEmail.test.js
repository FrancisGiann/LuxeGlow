import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSignupEmail, signupEmailError, suggestedSignupEmail } from '../src/utils/signupEmail.js';

test('trims only surrounding whitespace and preserves casing and plus tags', () => {
  assert.equal(normalizeSignupEmail('  First.Last+Offers@Example.COM \n'), 'First.Last+Offers@Example.COM');
});

test('accepts plus tags, punctuation, custom domains, long TLDs, and international domains', () => {
  for (const email of [
    'First.Last+Offers@Example.COM', "o'connor@example.travel", 'customer/department=shipping@example.com',
    'person@mail.independent.photography', 'person@xn--bcher-kva.example', 'person@bücher.example',
  ]) assert.equal(signupEmailError(email), '', email);
});

test('rejects malformed values without coercing non-string input', () => {
  for (const email of [null, undefined, 123, {}, ['a@example.com'], '', 'a@@example.com',
    '@example.com', 'a@', 'a@example', 'a b@example.com', 'a@example..com',
    '.a@example.com', 'a.@example.com', 'a..b@example.com', 'a@-example.com', 'a@example-.com',
    'a@exam_ple.com', 'a@exam\u0000ple.com', 'a@example.com\nbcc:other@example.com']) {
    assert.notEqual(signupEmailError(email), '', String(email));
  }
});

test('checks local, label and total byte length boundaries', () => {
  assert.equal(signupEmailError(`${'a'.repeat(64)}@example.com`), '');
  assert.notEqual(signupEmailError(`${'a'.repeat(65)}@example.com`), '');
  assert.equal(signupEmailError(`a@${'b'.repeat(63)}.example`), '');
  assert.notEqual(signupEmailError(`a@${'b'.repeat(64)}.example`), '');
  const max = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;
  assert.equal(max.length, 254);
  assert.equal(signupEmailError(max), '');
  assert.notEqual(signupEmailError(`${max}d`), '');
  assert.notEqual(signupEmailError(`${'é'.repeat(33)}@example.com`), '');
});

test('suggestions preserve the local part and never change normalization or validity', () => {
  const entered = 'Person+Tag@GMIAL.com';
  assert.equal(suggestedSignupEmail(entered), 'Person+Tag@gmail.com');
  assert.equal(normalizeSignupEmail(entered), entered);
  assert.equal(signupEmailError(entered), '');
  for (const email of ['person@gmail.co', 'person@custom.example', 'person@gmail.com', 'invalid']) {
    assert.equal(suggestedSignupEmail(email), '');
  }
});
