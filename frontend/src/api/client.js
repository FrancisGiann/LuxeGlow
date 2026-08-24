/**
 * Thin fetch wrapper around the PHP backend.
 * - All calls are same-origin relative paths in dev (Vite proxy keeps the
 *   PHP session cookie working exactly like the legacy pages).
 * - In production set VITE_API_BASE (e.g. "/Luxeglow") in frontend/.env.
 */

export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

/** Resolve a backend-relative asset path (e.g. service images). */
export const assetUrl = (path) => {
  if (!path) return '';
  return `${API_BASE}/${String(path).replace(/^\/+/, '')}`;
};

async function parseJson(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return parseJson(res);
}

/**
 * POST as multipart/form-data — mirrors what the legacy vanilla-JS pages
 * sent, so the untouched PHP endpoints keep processing payloads identically.
 */
export async function apiPost(path, fields = {}) {
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.append(key, value);
  });
  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    credentials: 'include',
    body,
  });
  return parseJson(res);
}
