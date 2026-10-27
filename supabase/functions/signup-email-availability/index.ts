import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSignupAvailabilityHandler } from '../_shared/signupAvailability.js';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = url && serviceKey ? createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

Deno.serve(createSignupAvailabilityHandler({
  allowedOrigin: Deno.env.get('ALLOWED_ORIGIN'),
  // Reuse the existing server-only secret with a distinct HMAC namespace.
  hashSecret: Deno.env.get('LOGIN_RATE_LIMIT_SECRET'),
  checkAvailability: admin ? async (email: string, emailHash: string) => {
    const { data, error } = await admin.rpc('check_signup_email_availability', { p_email: email, p_email_hash: emailHash });
    if (error) throw new Error('Availability unavailable');
    return data;
  } : null,
}));
