import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const origin = Deno.env.get('ALLOWED_ORIGIN') || 'null';
const routerBase = String(Deno.env.get('APP_ROUTER_BASE') || '/').replace(/^\/+|\/+$/g, '');
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM_ADDRESS') || 'appointments@example.com';
  const fromName = Deno.env.get('MAIL_FROM_NAME') || 'Astrid Nails & Beauty Bar';
  if (!url || !serviceKey || !resendKey) return json({ error: 'Function is not configured' }, 500);
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Authentication required' }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return json({ error: 'Authentication required' }, 401);
  const { data: callerProfile } = await admin.from('profiles').select('role,is_active').eq('id', caller.user.id).single();
  if (callerProfile?.role !== 'admin' || !callerProfile.is_active) return json({ error: 'Admin access required' }, 403);
  let input: { user_id?: string };
  try { input = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const userId = String(input.user_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Invalid staff account' }, 400);
  const { data: target } = await admin.from('profiles').select('email,first_name,role,is_active').eq('id', userId).single();
  if (!target || !['staff', 'admin'].includes(target.role)) return json({ error: 'Staff account not found' }, 404);
  const { data: authTarget, error: authTargetError } = await admin.auth.admin.getUserById(userId);
  if (authTargetError || !authTarget?.user) return json({ error: 'Staff account not found' }, 404);
  const targetEmail = String(authTarget.user.email || target.email || '').trim().toLowerCase();
  if (!targetEmail) return json({ error: 'Staff account not found' }, 404);
  const linkType = authTarget.user.email_confirmed_at || authTarget.user.confirmed_at ? 'recovery' : 'invite';
  const redirectTo = `${origin === 'null' ? 'http://localhost:5173' : origin}${routerBase ? `/${routerBase}` : ''}/reset-password`;
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: linkType, email: targetEmail, options: { redirectTo } });
  if (linkError || !link?.properties?.action_link) return json({ error: 'Could not create password reset link' }, 500);
  const isInvite = linkType === 'invite';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${fromName} <${from}>`,
      to: [targetEmail],
      subject: isInvite ? 'Complete your Astrid Nails staff invitation' : 'Your Astrid Nails staff password reset',
      text: isInvite
        ? `Hi ${target.first_name || 'there'},\n\nAn administrator invited you to join the Astrid Nails staff. Use this one-time link to confirm your email and choose a password:\n\n${link.properties.action_link}\n\nIf you did not expect this, contact the salon administrator.`
        : `Hi ${target.first_name || 'there'},\n\nAn administrator requested a password reset for your staff account. Use this one-time link to choose a new password:\n\n${link.properties.action_link}\n\nIf you did not expect this, contact the salon administrator.`,
    }),
  });
  if (!response.ok) return json({ error: 'Password reset email could not be sent' }, 502);
  return json({ success: true });
});
