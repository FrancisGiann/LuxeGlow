const encoder = new TextEncoder();

export function normalizePhMobile(value) {
  const input = String(value || '').replace(/[\s().-]/g, '');
  const normalized = /^09\d{9}$/.test(input) ? `+63${input.slice(1)}` : /^639\d{9}$/.test(input) ? `+${input}` : input;
  return /^\+639\d{9}$/.test(normalized) ? normalized : null;
}

function base64Bytes(value) {
  try { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
  catch { return null; }
}

export async function verifyStandardWebhook(rawBody, headers, secret, nowSeconds = Date.now() / 1000) {
  const signingSecret = secret?.startsWith('v1,whsec_') ? secret.slice(3) : secret;
  const id = headers.get('webhook-id') || '';
  const timestamp = headers.get('webhook-timestamp') || '';
  const signature = headers.get('webhook-signature') || '';
  const seconds = Number(timestamp);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !/^\d{10}$/.test(timestamp) ||
      !Number.isFinite(seconds) || Math.abs(nowSeconds - seconds) > 300 ||
      !signingSecret?.startsWith('whsec_')) return null;
  const keyBytes = base64Bytes(signingSecret.slice(6));
  if (!keyBytes || keyBytes.length < 24) return null;
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const message = encoder.encode(`${id}.${timestamp}.${rawBody}`);
  for (const entry of signature.split(' ')) {
    if (!entry.startsWith('v1,')) continue;
    const supplied = base64Bytes(entry.slice(3));
    if (supplied?.length === 32 && await crypto.subtle.verify('HMAC', key, supplied, message)) return id;
  }
  return null;
}

export async function hashPhone(phone, secret) {
  if (!secret || secret.length < 32) throw new Error('SMS rate secret is unavailable');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(phone)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function smsRecipientAllowed(scope, configuredPhone, recipientPhone) {
  if (scope === 'public') return true;
  return scope === 'test' && normalizePhMobile(configuredPhone) === recipientPhone &&
    normalizePhMobile(configuredPhone) !== null;
}

export function parseSmsHookPayload(rawBody) {
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return null; }
  const phone = normalizePhMobile(payload?.user?.phone);
  const userId = payload?.user?.id;
  const otp = payload?.sms?.otp;
  const pendingEmail = payload?.user?.user_metadata?.pending_login_email;
  // This hook is dedicated to initial signup; recovery uses a separate
  // challenge store and template. Do not mislabel a sign-in/change OTP.
  if (!phone || typeof userId !== 'string' ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId) ||
      payload?.user?.phone_confirmed_at ||
      payload?.user?.app_metadata?.provider !== 'phone' ||
      typeof pendingEmail !== 'string' || pendingEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pendingEmail) ||
      typeof otp !== 'string' || !/^\d{6,8}$/.test(otp)) return null;
  return { userId, phone, otp };
}
