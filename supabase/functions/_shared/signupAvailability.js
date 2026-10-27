const GENERIC_ERROR = 'Could not check this email right now. Please try again.';
const MAX_BODY_BYTES = 1024;

async function boundedJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('size'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Dependencies are injected so tests never contact Auth or use real credentials.
export function createSignupAvailabilityHandler({ allowedOrigin, hashSecret, checkAvailability }) {
  const headers = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Origin': allowedOrigin || 'null',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Retry-After',
  };
  const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
  return async (request) => {
    if (!allowedOrigin || request.headers.get('origin') !== allowedOrigin) return json({ error: GENERIC_ERROR }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: GENERIC_ERROR }, 405);
    if (!hashSecret || hashSecret.length < 32 || typeof checkAvailability !== 'function') return json({ error: GENERIC_ERROR }, 503);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: GENERIC_ERROR }, 415);
    const length = request.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) return json({ error: GENERIC_ERROR }, 413);
    // No client/proxy IP header is trusted. A shared project-wide budget caps
    // enumeration even when callers vary Origin, forwarding headers or emails.
    let input;
    try { input = await boundedJson(request); } catch { return json({ error: GENERIC_ERROR }, 400); }
    const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (new TextEncoder().encode(email).length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return json({ error: GENERIC_ERROR }, 400);
    try {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(hashSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const hash = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`signup-availability:email:${email}`));
      const emailHash = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const result = await checkAvailability(email, emailHash);
      if (result?.allowed === false) {
        const retry = Number(result.retry_after);
        return json({ error: GENERIC_ERROR }, 429, { 'Retry-After': String(Number.isFinite(retry) && retry > 0 ? Math.min(900, Math.ceil(retry)) : 900) });
      }
      if (result?.allowed !== true || typeof result.available !== 'boolean') return json({ error: GENERIC_ERROR }, 503);
      return json({ available: result.available });
    } catch { return json({ error: GENERIC_ERROR }, 503); }
  };
}
