import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectAuthRedirect, passwordResetPath, passwordSetupError, routerBasePath } from '../src/utils/authRedirect.js';

test('captures invite and recovery callback types from URL fragments and query parameters', () => {
  assert.deepEqual(inspectAuthRedirect('http://localhost:5173/reset-password#access_token=token&refresh_token=refresh&type=invite'), {
    type: 'invite',
    isPasswordSetup: true,
    isResetPath: true,
    hasError: false,
    hasCallbackCredentials: true,
  });
  assert.equal(inspectAuthRedirect('http://localhost:5173/reset-password?type=recovery#type=invite').type, 'recovery');
  assert.equal(inspectAuthRedirect('http://localhost:5173/reset-password?type=invite').hasCallbackCredentials, false);
  assert.equal(inspectAuthRedirect('http://localhost:5173/reset-password?code=pkce-code').hasCallbackCredentials, true);
});

test('classifies expired callback errors without exposing URL error descriptions', () => {
  const result = inspectAuthRedirect('http://localhost:5173/reset-password?error=access_denied&error_code=otp_expired&error_description=secret%20details&type=recovery');
  assert.equal(result.isPasswordSetup, true);
  assert.equal(result.hasError, true);
  assert.equal(passwordSetupError(), 'This password link is invalid or expired. Request a new one.');
});

test('builds reset paths for root and production sub-path deployments', () => {
  assert.equal(routerBasePath('/'), '');
  assert.equal(routerBasePath('/luxeglow/'), '/luxeglow');
  assert.equal(passwordResetPath('/'), '/reset-password');
  assert.equal(passwordResetPath('/luxeglow'), '/luxeglow/reset-password');
});
