import { normalizePhMobile } from './smsHook.js';
const encoder = new TextEncoder();
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u;
export const GENERIC_REQUEST = 'If this account has a verified recovery method, we will send instructions.';
export const GENERIC_VERIFY = 'That code or link is invalid or expired.';
export const SMS_EXPIRY_MINUTES = 5;
export const EMAIL_EXPIRY_MINUTES = 15;

export function normalizeRecoveryIdentifier(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export function eligibleRecoveryDestination(user, alias, identifier, channel) {
  if (!user || !identifier || !['sms', 'email'].includes(channel)) return null;
  if (alias && (alias.user_id !== user.id || alias.email_normalized !== identifier)) return null;
  if (channel === 'sms') {
    const phone = normalizePhMobile(user.phone);
    if (!user.phone_confirmed_at || !phone || (alias && alias.phone_e164 !== phone)) return null;
    return phone;
  }
  const email = String(user.email || '').trim().toLowerCase();
  if (!user.email_confirmed_at || email !== identifier) return null;
  return email;
}

export function recoverySms(code) {
  if (!/^\d{8}$/.test(code)) throw new TypeError('Invalid recovery code');
  return `LuxeGlow password reset code: ${code}. Expires in 5 min. Do not share this code.`;
}

export function recoveryEmailLink(base, id, token) {
  const link = new URL(base);
  link.hash = new URLSearchParams({ recovery_id: id, recovery_token: token }).toString();
  return link.toString();
}

export function randomDigits(length = 8, random = crypto.getRandomValues.bind(crypto)) {
  if (!Number.isInteger(length) || length < 6 || length > 10) throw new TypeError('Invalid length');
  let result = '';
  while (result.length < length) {
    const bytes = new Uint8Array(16);
    random(bytes);
    for (const byte of bytes) {
      if (byte < 250) result += String(byte % 10);
      if (result.length === length) break;
    }
  }
  return result;
}

export function randomToken(random = crypto.getRandomValues.bind(crypto)) {
  const bytes = new Uint8Array(32);
  random(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function keyedHash(secret, purpose, value) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Recovery hash key unavailable');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`luxeglow:recovery:${purpose}:${value}`)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
