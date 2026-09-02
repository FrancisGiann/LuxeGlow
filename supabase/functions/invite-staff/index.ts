import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const origin = Deno.env.get('ALLOWED_ORIGIN') || 'null';
const routerBase = String(Deno.env.get('APP_ROUTER_BASE') || '/').replace(/^\/+|\/+$/g, '');
const passwordSetupRedirect = `${origin === 'null' ? 'http://localhost:5173' : origin}${routerBase ? `/${routerBase}` : ''}/reset-password`;
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers,
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Function is not configured' }, 500);
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json({ error: 'Authentication required' }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return json({ error: 'Authentication required' }, 401);
  const { data: callerProfile } = await admin.from('profiles').select('role,is_active').eq('id', caller.user.id).single();
  if (!callerProfile?.is_active || callerProfile.role !== 'admin') return json({ error: 'Admin access required' }, 403);

  let input: { email?: string; first_name?: string; last_name?: string; phone?: string; username?: string; role?: string };
  try { input = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const email = String(input.email || '').trim().toLowerCase();
  const firstName = String(input.first_name || '').trim();
  const lastName = String(input.last_name || '').trim();
  const role = input.role === 'admin' ? 'admin' : 'staff';
  if (!/^\S+@\S+\.\S+$/.test(email) || !firstName || firstName.length > 100 || lastName.length > 100) return json({ error: 'Valid email and name are required' }, 400);
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { first_name: firstName, last_name: lastName, phone: String(input.phone || '').slice(0, 50) }, redirectTo: passwordSetupRedirect });
  if (inviteError || !invited.user) return json({ error: inviteError?.message || 'Could not invite staff member' }, 400);
  const { error: profileError } = await admin.from('profiles').update({ email, first_name: firstName, last_name: lastName, phone: String(input.phone || '').slice(0, 50) || null, username: String(input.username || '').trim().slice(0, 100) || null, role, is_active: true, accepts_appointments: false, updated_at: new Date().toISOString() }).eq('id', invited.user.id);
  if (profileError) {
    // The Auth invite and profile role update are separate APIs. Remove the
    // just-created invite on a profile failure so a partial privileged account
    // cannot linger with an unusable or mismatched profile.
    await admin.auth.admin.deleteUser(invited.user.id);
    return json({ error: 'Could not finish staff profile setup; no account was created.' }, 500);
  }
  return json({ success: true, user_id: invited.user.id });
});
