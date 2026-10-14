import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activateStaffAccountImmediately } from '../src/utils/adminStaffActivation.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const adminPage = readFileSync(resolve(projectRoot, 'frontend/src/pages/AdminPage.jsx'), 'utf8');
const target = {
  id: '7f8b69f4-cfe1-4a47-9b3b-d6f1701e5614',
  name: 'Jhona Amparado',
  is_active: false,
};

function createHarness(overrides = {}) {
  const state = { busyId: null, feedback: null, savedIds: [] };
  const calls = [];
  const busyRef = { current: false };
  const dependencies = {
    target: { ...target },
    isAdmin: true,
    busyRef,
    setBusyId: (busyId) => { state.busyId = busyId; },
    setFeedback: (feedback) => { state.feedback = feedback; },
    updateAccount: async (...args) => {
      calls.push(args);
      return { success: true };
    },
    onSaved: (id) => state.savedIds.push(id),
    ...overrides,
  };
  return {
    state,
    calls,
    busyRef,
    dependencies,
    run: () => activateStaffAccountImmediately(dependencies),
  };
}

test('activation writes immediately for an administrator and reports the captured account', async () => {
  const harness = createHarness();

  assert.equal(await harness.run(), 'saved');
  assert.deepEqual(harness.calls, [[target.id, { is_active: true }]]);
  assert.deepEqual(harness.state.savedIds, [target.id]);
  assert.deepEqual(harness.state.feedback, {
    id: target.id,
    kind: 'success',
    message: 'Jhona Amparado activated.',
  });
  assert.equal(harness.state.busyId, null);
  assert.equal(harness.busyRef.current, false);
});

test('activation is admin-only and ignores already active or malformed targets', async () => {
  const nonAdmin = createHarness({ isAdmin: false });
  const alreadyActive = createHarness({ target: { ...target, is_active: true } });
  const malformed = createHarness({ target: { ...target, id: 'invalid' } });

  assert.equal(await nonAdmin.run(), 'ignored');
  assert.equal(await alreadyActive.run(), 'ignored');
  assert.equal(await malformed.run(), 'ignored');
  assert.equal(nonAdmin.calls.length + alreadyActive.calls.length + malformed.calls.length, 0);
  assert.equal(nonAdmin.state.busyId, null);
});

test('same-tick duplicate activation submits only once', async () => {
  let allowSave;
  const saveGate = new Promise((resolve) => { allowSave = resolve; });
  const harness = createHarness({ updateAccount: async (...args) => {
    harness.calls.push(args);
    await saveGate;
    return { success: true };
  } });

  const first = harness.run();
  assert.equal(harness.busyRef.current, true);
  assert.equal(harness.state.busyId, target.id);
  assert.equal(await harness.run(), 'ignored');
  assert.equal(harness.calls.length, 1);
  allowSave();

  assert.equal(await first, 'saved');
  assert.equal(harness.calls.length, 1);
});

test('selection changes cannot redirect an in-flight activation', async () => {
  const requestedTarget = { ...target };
  const harness = createHarness({ target: requestedTarget });
  const pending = harness.run();
  requestedTarget.id = 'e17e942d-a9bb-4c37-8a5a-58746c32b547';
  requestedTarget.name = 'Another account';

  assert.equal(await pending, 'saved');
  assert.deepEqual(harness.calls, [[target.id, { is_active: true }]]);
  assert.equal(harness.state.feedback.message, 'Jhona Amparado activated.');
});

test('failed activation keeps its error visible and releases the synchronous guard', async () => {
  const harness = createHarness({
    updateAccount: async () => ({ success: false, error: 'Account update denied' }),
  });

  assert.equal(await harness.run(), 'failed');
  assert.equal(harness.state.feedback.kind, 'error');
  assert.equal(harness.state.feedback.message, 'Account update denied');
  assert.deepEqual(harness.state.savedIds, []);
  assert.equal(harness.state.busyId, null);
  assert.equal(harness.busyRef.current, false);
});

test('retrying activation clears stale page errors and notices before saving', () => {
  const requestAction = adminPage.slice(
    adminPage.indexOf('const requestStaffAction ='),
    adminPage.indexOf('updateAccount: updateAdminProfile'),
  );

  assert.match(requestAction, /if \(feedback\.kind === "busy"\) \{\s*setError\(""\);\s*setNotice\(""\);\s*\}/);
  assert.match(requestAction, /if \(feedback\.kind === "error"\) setError\(feedback\.message\)/);
});
