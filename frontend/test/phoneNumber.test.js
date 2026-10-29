import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidPhoneNumber, normalizePhMobile, sanitizePhoneInput } from '../src/utils/phoneNumber.js';

test('phone input keeps supported formatting and strips letters and unsupported pasted characters', () => {
  assert.equal(sanitizePhoneInput(' +63 (917) 000-1122'), '+63 (917) 000-1122');
  assert.equal(sanitizePhoneInput('abc +63 ext. 12 / 345-6789'), ' 63 . 12  345-6789');
  assert.equal(sanitizePhoneInput('++63.917.000.1122'), '+63.917.000.1122');
  assert.equal(sanitizePhoneInput('abc+639171234567'), '639171234567');
  assert.equal(sanitizePhoneInput(null), '');
});

test('Philippine mobile inputs normalize to one canonical E.164 number', () => {
  for (const input of ['09170001122', '639170001122', '+639170001122', '+63 (917) 000-1122']) {
    assert.equal(normalizePhMobile(input), '+639170001122');
  }
  for (const input of ['+63917000112', '6391700011223', '+628170001122', '123456789012', '']) {
    assert.equal(normalizePhMobile(input), null);
  }
});

test('phone validation requires 7 to 15 digits and accepts only well-formed optional leading plus formatting', () => {
  for (const value of ['+63 (917) 000-1122', '0917.000.1122', '(917) 000 1122']) {
    assert.equal(isValidPhoneNumber(value), true, value);
  }
  for (const value of ['', '   ', '+', '123-456', '1234567890123456', '12+3456789', '++123456789', '123abc456', 123456789]) {
    assert.equal(isValidPhoneNumber(value), false, String(value));
  }
});
