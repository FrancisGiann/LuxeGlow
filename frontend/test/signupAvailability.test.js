import assert from 'node:assert/strict';
import test from 'node:test';
import { createSignupAvailabilityChecker } from '../src/utils/signupAvailability.js';
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('format errors never request membership; pending/completed checks are deduplicated', async () => {
  const wait = deferred(); const states = []; let calls = 0;
  const checker = createSignupAvailabilityChecker(() => { calls++; return wait.promise; }, (s) => states.push(s.status));
  assert.equal((await checker.check('bad')).status, 'invalid');
  const a = checker.check('a@example.test'); const b = checker.check('a@example.test');
  assert.equal(calls, 1); assert.equal(states.at(-1), 'checking');
  wait.resolve({ ok: true, available: false });
  assert.equal((await a).status, 'unavailable'); assert.equal((await b).status, 'unavailable');
  await checker.check('a@example.test'); assert.equal(calls, 1);
});

test('rapid A to B to A edits abort and ignore late availability responses', async () => {
  const old = deferred(); const next = deferred(); const states = []; const signals = [];
  const checker = createSignupAvailabilityChecker((_email, signal) => { signals.push(signal); return signals.length === 1 ? old.promise : next.promise; }, (s) => states.push(s.status));
  const first = checker.check('a@example.test');
  checker.change('b@example.test'); checker.change('a@example.test');
  assert.equal(signals[0].aborted, true);
  const second = checker.check('a@example.test');
  old.resolve({ ok: true, available: false });
  assert.equal((await first).status, 'stale'); assert.equal(states.at(-1), 'checking');
  next.resolve({ ok: true, available: true }); assert.equal((await second).status, 'available');
});

test('network failures and malformed responses are retriable errors, never unavailable', async () => {
  let calls = 0;
  const checker = createSignupAvailabilityChecker(async () => {
    calls++; if (calls === 1) throw new Error('offline');
    if (calls === 2) return { ok: true, available: 'false' };
    return { ok: true, available: false };
  }, () => {});
  assert.equal((await checker.check('a@example.test')).status, 'error');
  assert.equal((await checker.check('a@example.test')).status, 'error');
  assert.equal((await checker.check('a@example.test')).status, 'unavailable');
});

test('closing the view suppresses pending responses', async () => {
  const wait = deferred(); const states = [];
  const checker = createSignupAvailabilityChecker(() => wait.promise, (s) => states.push(s.status));
  const pending = checker.check('a@example.test'); checker.cancel();
  wait.resolve({ ok: true, available: false });
  assert.equal((await pending).status, 'stale'); assert.equal(states.at(-1), 'checking');
});
