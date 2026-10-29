import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const origin = Deno.env.get('ALLOWED_ORIGIN') || 'null';
const headers = {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (Deno.env.get('SMS_SIGNUP_ENABLED') !== 'true') return json({ error: 'Signup unavailable' }, 503);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Signup unavailable' }, 503);
  const bearer = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (!bearer) return json({ error: 'Authentication required' }, 401);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await admin.auth.getUser(bearer);
  if (callerError || !caller.user?.id) return json({ error: 'Authentication required' }, 401);
  let body: { email?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  const email = String(body?.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)) return json({ error: 'Invalid request' }, 400);
  const { data: claimed, error } = await admin.rpc('claim_customer_login_alias', {
    p_user_id: caller.user.id, p_email: email,
  });
  if (error) return json({ error: 'Could not finish signup' }, 503);
  if (claimed !== true) return json({ error: 'Could not finish signup with this email' }, 409);
  return json({ success: true });
});
