import { requireSupabase } from '../lib/supabase';

// Optional settings action. Supabase Auth verifies inbox ownership; the
// profile/alias address is a login label until auth.users.email_confirmed_at.
export async function requestRecoveryEmailVerification() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return { success: false, error: 'Sign in to verify a recovery email.' };
  const { data: profile, error: profileError } = await client.from('profiles')
    .select('email,role,is_active').eq('id', auth.user.id).maybeSingle();
  if (profileError || !profile?.is_active || profile.role !== 'customer')
    return { success: false, error: 'Recovery email verification is unavailable.' };
  const email = String(profile.email || '').trim().toLowerCase();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) || email.length > 254)
    return { success: false, error: 'Recovery email verification is unavailable.' };
  if (auth.user.email && auth.user.email.toLowerCase() !== email)
    return { success: false, error: 'Your account email needs support review before recovery verification.' };
  if (auth.user.email?.toLowerCase() === email && auth.user.email_confirmed_at)
    return { success: true, already_verified: true, message: 'Your recovery email is verified.' };
  const { error } = await client.auth.updateUser({ email });
  if (error) return { success: false, error: 'Could not send a verification link right now.' };
  return { success: true, message: 'Check your inbox for a recovery email verification link.' };
}
