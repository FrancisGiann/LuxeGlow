import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LOGIN_VERIFICATION_MESSAGE,
  MAX_VERIFICATION_COOLDOWN_SECONDS,
  VERIFICATION_REQUEST_FAILED_MESSAGE,
  verificationCooldownSeconds,
  verificationRequestFeedback,
} from '../src/utils/verificationFeedback.js';

test('successful verification requests use the same account-neutral message', () => {
  assert.equal(verificationRequestFeedback({ ok: true, cooldownSeconds: 60 }), LOGIN_VERIFICATION_MESSAGE);
});

test('failed and network-error verification requests hide account and backend details', () => {
  assert.equal(verificationRequestFeedback({ ok: false, error: 'User already exists' }), VERIFICATION_REQUEST_FAILED_MESSAGE);
  assert.equal(verificationRequestFeedback(null), VERIFICATION_REQUEST_FAILED_MESSAGE);
  assert.doesNotMatch(VERIFICATION_REQUEST_FAILED_MESSAGE, /already exists|not found|unverified/i);
});

test('rate-limited verification requests tell the user to wait without exposing account state', () => {
  assert.equal(verificationRequestFeedback({ ok: false, rateLimited: true, cooldownSeconds: 60 }), 'Please wait before trying again. Email sending limits may last longer than this timer.');
});

test('verification cooldown accepts positive retry values and caps unsafe delays', () => {
  assert.equal(verificationCooldownSeconds({ cooldownSeconds: 75 }), 75);
  assert.equal(verificationCooldownSeconds({ cooldownSeconds: 300.1 }), MAX_VERIFICATION_COOLDOWN_SECONDS);
  assert.equal(verificationCooldownSeconds({ cooldownSeconds: Number.MAX_VALUE }), MAX_VERIFICATION_COOLDOWN_SECONDS);
  assert.equal(verificationCooldownSeconds({ cooldownSeconds: Number.POSITIVE_INFINITY }), 60);
  assert.equal(verificationCooldownSeconds({ cooldownSeconds: -1 }), 60);
  assert.equal(verificationCooldownSeconds(null), 60);
});

test('local cooldown does not classify provider failures as rate limits', () => {
  assert.equal(verificationRequestFeedback({ ok: false, cooldownSeconds: 60 }), VERIFICATION_REQUEST_FAILED_MESSAGE);
});
