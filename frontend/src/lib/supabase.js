import { createClient } from '@supabase/supabase-js';

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

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

export function publicServiceImage(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const client = requireSupabase();
  return client.storage.from('service-images').getPublicUrl(String(path).replace(/^\/+/, '')).data.publicUrl;
}
