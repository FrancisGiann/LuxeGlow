export const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const MIN_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export const MAX_IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;
export const SESSION_ACTIVITY_STORAGE_KEY = 'luxeglow-session-activity-v1';
export const SESSION_ACTIVITY_VERSION = 1;

const MAX_FUTURE_CLOCK_SKEW_MS = 60 * 1000;

export function configuredIdleTimeout(configuredMinutes) {
  const minutes = Number(configuredMinutes);
  if (!Number.isFinite(minutes)) return DEFAULT_IDLE_TIMEOUT_MS;
  return Math.min(MAX_IDLE_TIMEOUT_MS, Math.max(MIN_IDLE_TIMEOUT_MS, minutes * 60 * 1000));
}

export function isSessionActivityExpired(lastActivityAt, now, timeoutMs) {
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return false;
  if (!Number.isFinite(now) || now <= 0 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return false;
  return now - lastActivityAt >= timeoutMs;
}

export function parseSessionActivityPayload(payload, userId, now = Date.now()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (!userId || payload.version !== SESSION_ACTIVITY_VERSION || payload.userId !== userId) return null;

  const currentTime = Number.isFinite(now) && now > 0 ? now : Date.now();
  const lastActivityAt = payload.lastActivityAt;
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0 || lastActivityAt > currentTime + MAX_FUTURE_CLOCK_SKEW_MS) return null;

  // Small clock drift between app tabs should not grant extra idle time.
  return Math.min(lastActivityAt, currentTime);
}

export function parseSessionActivity(rawValue, userId, now = Date.now()) {
  if (typeof rawValue !== 'string') return null;
  try {
    return parseSessionActivityPayload(JSON.parse(rawValue), userId, now);
  } catch {
    return null;
  }
}

export function readPersistedSessionActivity(storage, userId, now = Date.now()) {
  try {
    return parseSessionActivity(storage?.getItem(SESSION_ACTIVITY_STORAGE_KEY), userId, now);
  } catch {
    return null;
  }
}

export function writePersistedSessionActivity(storage, userId, lastActivityAt) {
  if (!storage || typeof userId !== 'string' || !userId || !Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return false;
  try {
    storage.setItem(SESSION_ACTIVITY_STORAGE_KEY, JSON.stringify({
      version: SESSION_ACTIVITY_VERSION,
      userId,
      lastActivityAt,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedSessionActivity(storage, userId) {
  if (!storage) return false;
  try {
    if (typeof userId !== 'string' || !userId) {
      storage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
      return true;
    }
    const rawValue = storage.getItem(SESSION_ACTIVITY_STORAGE_KEY);
    if (typeof rawValue !== 'string') return false;
    const payload = JSON.parse(rawValue);
    if (payload?.version !== SESSION_ACTIVITY_VERSION || payload?.userId !== userId) return false;
    storage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function restoreSessionActivity(storage, userId, timeoutMs, now = Date.now()) {
  const currentTime = Number.isFinite(now) && now > 0 ? now : Date.now();
  const validTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_IDLE_TIMEOUT_MS;
  const persistedActivityAt = readPersistedSessionActivity(storage, userId, currentTime);

  if (persistedActivityAt === null) {
    writePersistedSessionActivity(storage, userId, currentTime);
    return { status: 'initialized', lastActivityAt: currentTime, remainingMs: validTimeout };
  }

  const remainingMs = validTimeout - (currentTime - persistedActivityAt);
  if (remainingMs <= 0) return { status: 'expired', lastActivityAt: persistedActivityAt, remainingMs: 0 };
  return { status: 'resumed', lastActivityAt: persistedActivityAt, remainingMs };
}
