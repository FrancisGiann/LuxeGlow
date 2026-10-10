import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionRefreshCoordinator, isCurrentAuthenticatedIdentity } from '../src/utils/sessionRefresh.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const authContext = readFileSync(resolve(projectRoot, 'frontend/src/context/AuthContext.jsx'), 'utf8');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('profile refresh shares an in-flight request for the same identity epoch', async () => {
  const pending = deferred();
  let requests = 0;
  const accepted = [];
  const coordinator = createSessionRefreshCoordinator({
    checkSession: () => { requests += 1; return pending.promise; },
    onAuthenticated: (data) => accepted.push(data.customer.id),
  });

  const first = coordinator.refresh();
  const second = coordinator.refresh();
  assert.equal(first, second);
  assert.equal(requests, 1);

  pending.resolve({ loggedIn: true, customer: { id: 'user-a', role: 'customer' } });
  assert.equal((await first).status, 'authenticated');
  assert.deepEqual(accepted, ['user-a']);
});

test('invalidating an identity discards a late profile response', async () => {
  const pendingOld = deferred();
  const pendingNew = deferred();
  const pending = [pendingOld, pendingNew];
  const applied = [];
  let requests = 0;
  const coordinator = createSessionRefreshCoordinator({
    checkSession: () => pending[requests++].promise,
    onAuthenticated: (data) => applied.push(`authenticated:${data.customer.id}`),
    onGuest: () => applied.push('guest'),
  });

  const refreshOld = coordinator.refresh();
  coordinator.invalidate();
  const refreshNew = coordinator.refresh();
  pendingOld.resolve({ loggedIn: true, customer: { id: 'old-user', role: 'admin' } });

  assert.deepEqual(await refreshOld, { applied: false, reason: 'stale' });
  pendingNew.resolve({ loggedIn: true, customer: { id: 'new-user', role: 'customer' } });
  assert.equal((await refreshNew).status, 'authenticated');
  assert.deepEqual(applied, ['authenticated:new-user']);
});

test('a known inactive or missing profile applies guest state', async () => {
  const applied = [];
  const coordinator = createSessionRefreshCoordinator({
    checkSession: async () => ({ loggedIn: false, customer: null }),
    onAuthenticated: () => applied.push('authenticated'),
    onGuest: () => applied.push('guest'),
  });

  assert.equal((await coordinator.refresh()).status, 'guest');
  assert.deepEqual(applied, ['guest']);
});

test('a transient profile query error preserves an authenticated profile and role', async () => {
  const transient = new Error('temporary profile query failure');
  const applied = [];
  const errors = [];
  let requestCount = 0;
  const coordinator = createSessionRefreshCoordinator({
    checkSession: async () => {
      requestCount += 1;
      if (requestCount === 1) return { loggedIn: true, customer: { id: 'admin-a', role: 'admin' } };
      throw transient;
    },
    onAuthenticated: ({ customer }) => applied.push(`authenticated:${customer.role}`),
    onGuest: () => applied.push('guest'),
    onTransientError: (error, options) => errors.push([error, options]),
  });

  assert.equal((await coordinator.refresh()).status, 'authenticated');
  assert.equal((await coordinator.refresh()).status, 'transient');
  assert.deepEqual(applied, ['authenticated:admin']);
  assert.deepEqual(errors, [[transient, { initial: false, fallbackToGuest: false }]]);
});

test('a same-user auth event preserves the authenticated role through a transient profile read', async () => {
  const transient = new Error('temporary profile query failure');
  const applied = [];
  const errors = [];
  let requestCount = 0;
  const coordinator = createSessionRefreshCoordinator({
    checkSession: async () => {
      requestCount += 1;
      if (requestCount === 1) return { loggedIn: true, customer: { id: 'admin-a', role: 'admin' } };
      throw transient;
    },
    onAuthenticated: ({ customer }) => applied.push(`authenticated:${customer.id}:${customer.role}`),
    onGuest: () => applied.push('guest'),
    onTransientError: (error, options) => errors.push([error, options]),
  });

  await coordinator.refresh();
  const sameIdentity = isCurrentAuthenticatedIdentity('admin-a', 'admin-a');
  coordinator.invalidate({ resetStatus: !sameIdentity });
  if (sameIdentity) coordinator.markStatus('authenticated');

  assert.equal((await coordinator.refresh()).status, 'transient');
  assert.deepEqual(applied, ['authenticated:admin-a:admin']);
  assert.deepEqual(errors, [[transient, { initial: false, fallbackToGuest: false }]]);
});

test('a changed auth identity clears prior authorization before profile validation', async () => {
  const transient = new Error('new identity profile query failure');
  const applied = [];
  let requestCount = 0;
  const coordinator = createSessionRefreshCoordinator({
    checkSession: async () => {
      requestCount += 1;
      if (requestCount === 1) return { loggedIn: true, customer: { id: 'admin-a', role: 'admin' } };
      throw transient;
    },
    onAuthenticated: ({ customer }) => applied.push(`authenticated:${customer.id}`),
    onGuest: () => applied.push('guest'),
    onTransientError: (_error, { fallbackToGuest }) => {
      if (fallbackToGuest) applied.push('guest');
    },
  });

  await coordinator.refresh();
  const sameIdentity = isCurrentAuthenticatedIdentity('admin-a', 'customer-b');
  assert.equal(sameIdentity, false);
  coordinator.invalidate({ resetStatus: !sameIdentity });

  assert.equal((await coordinator.refresh()).status, 'transient');
  assert.deepEqual(applied, ['authenticated:admin-a', 'guest']);
});

test('the initial profile query can fall back to guest when Auth is unavailable', async () => {
  const applied = [];
  let initialFailure = null;
  const coordinator = createSessionRefreshCoordinator({
    checkSession: async () => { throw new Error('Auth unavailable'); },
    onGuest: () => applied.push('guest'),
    onTransientError: (error, options) => { initialFailure = [error.message, options.initial, options.fallbackToGuest]; },
  });

  assert.equal((await coordinator.refresh({ initial: true })).status, 'transient');
  assert.deepEqual(applied, []);
  assert.deepEqual(initialFailure, ['Auth unavailable', true, true]);
});

test('AuthContext revalidates active profiles on focus, visibility, and a bounded interval', () => {
  const login = authContext.slice(authContext.indexOf('const login ='), authContext.indexOf('/** Returns { ok, error }'));
  assert.match(authContext, /PROFILE_REFRESH_INTERVAL_MS = 60 \* 1000/);
  assert.match(authContext, /window\.addEventListener\('focus', refreshWhenVisible\)/);
  assert.match(authContext, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(authContext, /onTransientError:[\s\S]*?if \(fallbackToGuest\)/);
  assert.match(login, /invalidateSessionRefresh\(\);\s*const currentUserId = authenticatedUserIdRef\.current;[\s\S]*?api\.loginCustomer/);
  assert.match(authContext, /isCurrentAuthenticatedIdentity\(currentUserId, sessionUserId\)/);
  assert.match(authContext, /invalidateSessionRefresh\(\{ resetStatus: !sameAuthenticatedIdentity \}\);\s*if \(sameAuthenticatedIdentity\) sessionRefreshCoordinator\.markStatus\('authenticated'\);/);
  assert.match(authContext, /setCustomer\(null\);\s*setAuthStatus\('loading'\);/);
});
