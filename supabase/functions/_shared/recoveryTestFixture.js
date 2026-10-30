import { normalizePhMobile } from './smsHook.js';

export const RECOVERY_STAGING_URL = 'https://bpnzjzugpnbpwzthzbfp.supabase.co';

// A fixed, private test secret may exist only in the disposable staging
// project. No provider call is made while this mode is enabled.
export function recoveryTestFixture({ projectUrl, enabled, channel, destination, phone, smsCode, email, emailToken }) {
  if (!enabled) return null;
  if (projectUrl !== RECOVERY_STAGING_URL) throw new Error('Recovery test mode is restricted to staging');
  if (channel === 'sms' && normalizePhMobile(phone) === destination && /^\d{8}$/.test(String(smsCode || ''))) {
    return String(smsCode);
  }
  if (channel === 'email' && String(email || '').trim().toLowerCase() === destination && /^[0-9a-f]{64}$/.test(String(emailToken || ''))) {
    return String(emailToken);
  }
  return null;
}
