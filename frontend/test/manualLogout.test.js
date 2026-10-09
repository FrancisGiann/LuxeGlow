import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { logoutToPublicHome } from '../src/utils/manualLogout.js';

const projectRoot = resolve(import.meta.dirname, '..');
const dashboardLayout = readFileSync(resolve(projectRoot, 'src/components/layout/DashboardLayout.jsx'), 'utf8');
const adminPage = readFileSync(resolve(projectRoot, 'src/pages/AdminPage.jsx'), 'utf8');

test('manual logout navigates away before sign-out can trigger the protected-route guard', async () => {
  const calls = [];
  let finishSignOut;
  const signOut = new Promise((resolveSignOut) => { finishSignOut = resolveSignOut; });
  const logout = logoutToPublicHome(
    (path, options) => calls.push(['navigate', path, options.replace]),
    () => { calls.push(['logout']); return signOut; },
  );

  assert.deepEqual(calls, [['navigate', '/', true], ['logout']]);
  finishSignOut();
  await logout;
});

test('manual logout still propagates sign-out failures after leaving the protected route', async () => {
  const calls = [];
  const failure = new Error('Sign-out failed.');

  await assert.rejects(
    logoutToPublicHome(
      (path, options) => calls.push(['navigate', path, options.replace]),
      async () => { calls.push(['logout']); throw failure; },
    ),
    failure,
  );
  assert.deepEqual(calls, [['navigate', '/', true], ['logout']]);
});

test('customer and staff logout controls share the route-before-sign-out handler', () => {
  assert.match(dashboardLayout, /logoutToPublicHome\(navigate, logout\)/);
  assert.match(adminPage, /logoutToPublicHome\(navigate, logout\)/);
  assert.match(adminPage, /onLogout=\{handleLogout\}/);
  assert.match(adminPage, /onClick=\{handleLogout\}/);
});
