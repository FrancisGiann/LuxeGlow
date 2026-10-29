import { requireSupabase } from '../lib/supabase';
import { getPasswordPolicyError } from '../utils/passwordPolicy';

async function invoke(body) {
  try {
    const { data, error } = await requireSupabase().functions.invoke('password-recovery', { body });
    if (error || !data || typeof data !== 'object') return { success: false, error: 'Recovery is unavailable right now.' };
    if (body.action === 'reset' && data.success === true) await requireSupabase().auth.signOut({ scope: 'local' }).catch(() => {});
    return data;
  } catch { return { success: false, error: 'Recovery is unavailable right now.' }; }
}
export async function requestRecovery({ email, channel }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(normalized) || !['sms', 'email'].includes(channel)) return { success: false, error: 'Enter a valid email and recovery method.' };
  return invoke({ action: 'request', email: normalized, channel });
}
export async function verifyRecovery({ challengeId, code, token }) {
  return invoke({ action: 'verify', challenge_id: challengeId, ...(token ? { token } : { code }) });
}
export async function finishRecovery({ resetToken, password, confirmPassword }) {
  const error = getPasswordPolicyError(password);
  if (error) return { success: false, error };
  if (password !== confirmPassword) return { success: false, error: 'Passwords do not match.' };
  return invoke({ action: 'reset', reset_token: resetToken, password });
}
