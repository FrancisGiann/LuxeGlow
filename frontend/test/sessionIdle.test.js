import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_IDLE_TIMEOUT_MS,
  MAX_IDLE_TIMEOUT_MS,
  MIN_IDLE_TIMEOUT_MS,
  SESSION_ACTIVITY_STORAGE_KEY,
  clearPersistedSessionActivity,
  configuredIdleTimeout,
  isSessionActivityExpired,
  parseSessionActivity,
  readPersistedSessionActivity,
  restoreSessionActivity,
  writePersistedSessionActivity,
} from '../src/utils/sessionIdle.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const authContext = readFileSync(resolve(projectRoot, 'frontend/src/context/AuthContext.jsx'), 'utf8');
const endpoints = readFileSync(resolve(projectRoot, 'frontend/src/api/endpoints.js'), 'utf8');

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('idle timeout defaults to 30 minutes and keeps the configured 5-minute to 4-hour bounds', () => {
  assert.equal(DEFAULT_IDLE_TIMEOUT_MS, 30 * 60 * 1000);
  assert.equal(MIN_IDLE_TIMEOUT_MS, 5 * 60 * 1000);
  assert.equal(MAX_IDLE_TIMEOUT_MS, 4 * 60 * 60 * 1000);
  assert.equal(configuredIdleTimeout(undefined), DEFAULT_IDLE_TIMEOUT_MS);
  assert.equal(configuredIdleTimeout(1), MIN_IDLE_TIMEOUT_MS);
  assert.equal(configuredIdleTimeout(999), MAX_IDLE_TIMEOUT_MS);
  assert.equal(configuredIdleTimeout(45), 45 * 60 * 1000);
});

test('a fresh user-scoped activity resumes only the remaining timeout after reopening', () => {
  const storage = createMemoryStorage();
  const now = 1_800_000_000_000;
  const lastActivityAt = now - 10 * 60 * 1000;
  assert.equal(writePersistedSessionActivity(storage, 'user-a', lastActivityAt), true);

  const restored = restoreSessionActivity(storage, 'user-a', 30 * 60 * 1000, now);
  assert.deepEqual(restored, {
    status: 'resumed',
    lastActivityAt,
    remainingMs: 20 * 60 * 1000,
  });
});

test('stale persisted activity expires on reopen without resetting its timestamp', () => {
  const storage = createMemoryStorage();
  const now = 1_800_000_000_000;
  const lastActivityAt = now - (30 * 60 * 1000) - 1;
  writePersistedSessionActivity(storage, 'user-a', lastActivityAt);

  assert.deepEqual(restoreSessionActivity(storage, 'user-a', 30 * 60 * 1000, now), {
    status: 'expired',
    lastActivityAt,
    remainingMs: 0,
  });
  assert.equal(readPersistedSessionActivity(storage, 'user-a', now), lastActivityAt);
});

test('an activity arriving at or after the idle boundary expires before resetting the clock', () => {
  const lastActivityAt = 1_800_000_000_000;
  const timeoutMs = 30 * 60 * 1000;
  assert.equal(isSessionActivityExpired(lastActivityAt, lastActivityAt + timeoutMs - 1, timeoutMs), false);
  assert.equal(isSessionActivityExpired(lastActivityAt, lastActivityAt + timeoutMs, timeoutMs), true);
  assert.equal(isSessionActivityExpired(lastActivityAt, lastActivityAt + timeoutMs + 1, timeoutMs), true);
  assert.equal(isSessionActivityExpired(0, lastActivityAt + timeoutMs, timeoutMs), false);
  assert.equal(isSessionActivityExpired(lastActivityAt, lastActivityAt + timeoutMs, 0), false);

  assert.match(authContext, /const onActivity = \(\) => \{\s*const now = Date\.now\(\);\s*if \(isSessionActivityExpired\(lastActivityRef\.current, now, timeoutMs\)\) \{\s*performSignOut\(\{ expired: true \}\);\s*return;\s*\}\s*lastActivityRef\.current = now;/);
});

test('wrong-user, malformed, and materially future activity are ignored and initialized for the active user', () => {
  const now = 1_800_000_000_000;
  const cases = [
    JSON.stringify({ version: 1, userId: 'another-user', lastActivityAt: now - 1000 }),
    '{malformed json',
    JSON.stringify({ version: 1, userId: 'user-a', lastActivityAt: now + 60 * 1000 + 1 }),
    JSON.stringify({ version: 1, userId: 'user-a', lastActivityAt: Number.POSITIVE_INFINITY }),
  ];

  for (const rawValue of cases) {
    const storage = createMemoryStorage();
    storage.setItem(SESSION_ACTIVITY_STORAGE_KEY, rawValue);
    assert.equal(parseSessionActivity(rawValue, 'user-a', now), null);
    assert.deepEqual(restoreSessionActivity(storage, 'user-a', 30 * 60 * 1000, now), {
      status: 'initialized',
      lastActivityAt: now,
      remainingMs: 30 * 60 * 1000,
    });
    assert.equal(readPersistedSessionActivity(storage, 'user-a', now), now);
  }

  const slightClockDrift = JSON.stringify({ version: 1, userId: 'user-a', lastActivityAt: now + 1000 });
  assert.equal(parseSessionActivity(slightClockDrift, 'user-a', now), now);
});

test('activity updates persist safely, and sign-out clears only the matching user record', () => {
  const storage = createMemoryStorage();
  const now = 1_800_000_000_000;
  assert.equal(writePersistedSessionActivity(storage, 'user-a', now), true);
  assert.equal(readPersistedSessionActivity(storage, 'user-a', now), now);
  assert.equal(clearPersistedSessionActivity(storage, 'user-b'), false);
  assert.equal(readPersistedSessionActivity(storage, 'user-a', now), now);
  assert.equal(clearPersistedSessionActivity(storage, 'user-a'), true);
  assert.equal(readPersistedSessionActivity(storage, 'user-a', now), null);

  const unavailableStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(readPersistedSessionActivity(unavailableStorage, 'user-a', now), null);
  assert.equal(writePersistedSessionActivity(unavailableStorage, 'user-a', now), false);
  assert.equal(clearPersistedSessionActivity(unavailableStorage, 'user-a'), false);
});

test('sign-out without a known identity removes the current record even when its payload is malformed', () => {
  const storage = createMemoryStorage();
  storage.setItem(SESSION_ACTIVITY_STORAGE_KEY, '{malformed json');
  assert.equal(clearPersistedSessionActivity(storage, null), true);
  assert.equal(readPersistedSessionActivity(storage, 'user-a'), null);

  let removedKey = '';
  const storageWithoutReadableData = {
    getItem() { throw new Error('must not read when clearing unconditionally'); },
    removeItem(key) { removedKey = key; },
  };
  assert.equal(clearPersistedSessionActivity(storageWithoutReadableData, undefined), true);
  assert.equal(removedKey, SESSION_ACTIVITY_STORAGE_KEY);
  assert.match(authContext, /event === 'SIGNED_OUT'\) \{\s*clearPersistedSessionActivity\(sessionActivityStorage\(\), authenticatedUserIdRef\.current \|\| session\?\.user\?\.id\)/);
});

test('auth lifecycle restores activity, includes identity in cross-tab messages, and clears it on sign-out', () => {
  assert.match(authContext, /restoreSessionActivity\(sessionActivityStorage\(\), userId, timeoutMs\)/);
  assert.match(authContext, /restored\.status === 'expired'/);
  assert.match(authContext, /broadcast\(\{ type: 'activity', version: SESSION_ACTIVITY_VERSION, userId, lastActivityAt:/);
  assert.match(authContext, /payload\.userId !== userId/);
  assert.match(authContext, /clearPersistedSessionActivity\(sessionActivityStorage\(\), userId\)/);
  assert.match(authContext, /lastActivityRef\.current = now;\s+schedule\(\);/);
  assert.match(authContext, /await api\.logoutCustomer\(expired \? 'local' : 'global'\)/);
  assert.match(endpoints, /export async function logoutCustomer\(scope = 'global'\)/);
  assert.match(endpoints, /if \(!\['global', 'local'\]\.includes\(scope\)\) throw new TypeError/);
  assert.match(endpoints, /auth\.signOut\(\{ scope \}\)/);
});
