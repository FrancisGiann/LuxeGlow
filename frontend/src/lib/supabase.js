import { AuthClient, createClient } from '@supabase/supabase-js';
import { inspectAuthRedirect } from '../utils/authRedirect';

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
// Capture callback metadata before supabase-js consumes and clears an auth
// fragment. This intentionally excludes access/refresh tokens.
export const authRedirect = inspectAuthRedirect();

// The public anon key is safe in a browser; the service-role key must never be
// provided as a Vite variable or bundled into this application.
export const supabase = url && anonKey ? createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}) : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

let signupProofSequence = 0;

/** Signup proof must never replace or broadcast the application's login session. */
export function createSignupProofAuth() {
  requireSupabase();
  // Auth-only avoids creating unused Realtime sockets/listeners per attempt.
  return new AuthClient({
    url: `${url.replace(/\/$/, '')}/auth/v1`,
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: `luxeglow-signup-proof-${++signupProofSequence}`,
  });
}

export function publicServiceImage(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const client = requireSupabase();
  return client.storage.from('service-images').getPublicUrl(String(path).replace(/^\/+/, '')).data.publicUrl;
}
