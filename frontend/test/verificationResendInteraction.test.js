import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { verificationCooldownSeconds, verificationRequestFeedback, VERIFICATION_REQUEST_FAILED_MESSAGE } from '../src/utils/verificationFeedback.js';
const source = readFileSync(new URL('../src/components/auth/AuthModal.jsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const handleResend = async () => {'), source.indexOf('  const handleRequestReset'));
const disabledExpression = source.match(/onClick=\{handleResend\} disabled=\{([^}]+)\}/)[1];
function harness(resend) {
  const messages = [];
  const state = { resendRemaining: 0, resendBusy: false, resendKey: 'person@example.com', resendLockRef: { current: false }, resend,
    verificationCooldownSeconds, verificationRequestFeedback,
    setResendBusy(value) { state.resendBusy = value; },
    setResendIn(value) { state.resendRemaining = value; },
    setResendForEmail() {}, toast(message, kind) { messages.push({ message, kind }); },
  };
  runInNewContext(`${handler}; this.submit = handleResend`, state);
  return { state, messages, disabled: () => runInNewContext(disabledExpression, state) };
}
test('verification resend disables while pending, blocks duplicates, then guards local retries', async () => {
  let finish;
  let calls = 0;
  const h = harness(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  assert.equal(h.disabled(), false);
  const pending = h.state.submit();
  assert.equal(h.disabled(), true);
  await h.state.submit();
  assert.equal(calls, 1);
  finish({ ok: false, rateLimited: true, cooldownSeconds: 60 });
  await pending;
  assert.equal(h.state.resendBusy, false);
  assert.equal(h.state.resendLockRef.current, false);
  assert.equal(h.disabled(), true);
  await h.state.submit();
  assert.equal(calls, 1);
  assert.match(h.messages[0].message, /may last longer/);
  h.state.resendRemaining = 0;
  assert.equal(h.disabled(), false);
});
test('verification thrown failure releases pending lock and shows generic feedback', async () => {
  const h = harness(async () => { throw new Error('private account/provider detail'); });
  await h.state.submit();
  assert.equal(h.state.resendBusy, false);
  assert.equal(h.state.resendLockRef.current, false);
  assert.equal(h.state.resendRemaining, 60);
  assert.equal(h.messages[0].message, VERIFICATION_REQUEST_FAILED_MESSAGE);
  assert.equal(h.messages[0].kind, 'error');
});
