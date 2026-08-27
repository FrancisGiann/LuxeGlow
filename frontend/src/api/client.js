// Supabase is the only browser data boundary. Privileged operations are
// exposed as SECURITY DEFINER RPCs or server-side Edge Functions, never with
// a service-role key in this bundle.
export { requireSupabase, supabase, publicServiceImage as assetUrl } from '../lib/supabase';
