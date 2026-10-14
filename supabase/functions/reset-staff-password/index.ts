import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer';
import { buildStaffPasswordEmail, resolveStaffPasswordEmailProvider } from '../_shared/staffPasswordEmail.js';

const origin = Deno.env.get('ALLOWED_ORIGIN') || 'null';
const routerBase = String(Deno.env.get('APP_ROUTER_BASE') || '/').replace(/^\/+|\/+$/g, '');
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const url = Deno.env.get('SUPABASE_URL');
const resendKey = Deno.env.get('RESEND_API_KEY')?.trim() || '';
const smtpHost = Deno.env.get('MAIL_HOST')?.trim() || 'smtp.gmail.com';
const smtpPortValue = Deno.env.get('MAIL_PORT')?.trim();
const smtpPort = smtpPortValue ? Number(smtpPortValue) : 465;
const smtpUser = Deno.env.get('MAIL_USERNAME')?.trim() || '';
const smtpPass = Deno.env.get('MAIL_PASSWORD') || '';
const fromAddress = Deno.env.get('MAIL_FROM_ADDRESS')?.trim() || smtpUser;
const fromName = (Deno.env.get('MAIL_FROM_NAME') || 'Astrid Nails & Beauty Bar')
  .replace(/[\r\n\0]+/gu, ' ')
  .trim()
  .slice(0, 120) || 'Astrid Nails & Beauty Bar';
const emailProvider = resolveStaffPasswordEmailProvider({
  resendKey,
  smtpUser,
  smtpPass,
  smtpPort,
  fromAddress,
});
const smtpTransporter = emailProvider === 'smtp'
  ? nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: 'TLSv1.2' },
  })
  : null;
const EMAIL_ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u;
const STAFF_USER_ID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu;

async function sendStaffPasswordEmail({ to, firstName, linkType, actionLink }: {
  to: string;
  firstName: string;
  linkType: 'invite' | 'recovery';
  actionLink: string;
}) {
  const isInvite = linkType === 'invite';
  const message = buildStaffPasswordEmail({ isInvite, firstName, actionLink });

  try {
    if (emailProvider === 'resend') {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <${fromAddress || 'appointments@example.com'}>`,
          to: [to],
          subject: message.subject,
          text: message.text,
        }),
      });
      return response.ok;
    }

    if (emailProvider === 'smtp' && smtpTransporter) {
      await smtpTransporter.sendMail({
        from: { name: fromName, address: fromAddress },
        to,
        subject: message.subject,
        text: message.text,
      });
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!url || !serviceKey || !emailProvider) return json({ error: 'Function is not configured' }, 500);
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Authentication required' }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return json({ error: 'Authentication required' }, 401);
  const { data: callerProfile } = await admin.from('profiles').select('role,is_active').eq('id', caller.user.id).single();
  if (callerProfile?.role !== 'admin' || !callerProfile.is_active) return json({ error: 'Admin access required' }, 403);
  let input: unknown;
  try { input = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'Invalid staff account' }, 400);
  const payload = input as { user_id?: unknown };
  if (Object.keys(payload).some((key) => key !== 'user_id')) return json({ error: 'Invalid staff account' }, 400);
  const userId = typeof payload.user_id === 'string' ? payload.user_id : '';
  if (!STAFF_USER_ID_PATTERN.test(userId)) return json({ error: 'Invalid staff account' }, 400);
  const { data: target } = await admin.from('profiles').select('email,first_name,role,is_active').eq('id', userId).single();
  if (!target || !['head', 'admin'].includes(target.role)) return json({ error: 'Staff account not found' }, 404);
  const { data: authTarget, error: authTargetError } = await admin.auth.admin.getUserById(userId);
  if (authTargetError || !authTarget?.user) return json({ error: 'Staff account not found' }, 404);
  const targetEmail = String(authTarget.user.email || target.email || '').trim().toLowerCase();
  if (targetEmail.length > 254 || !EMAIL_ADDRESS_PATTERN.test(targetEmail)) return json({ error: 'Staff account not found' }, 404);
  const linkType = authTarget.user.email_confirmed_at || authTarget.user.confirmed_at ? 'recovery' : 'invite';
  const redirectTo = `${origin === 'null' ? 'http://localhost:5173' : origin}${routerBase ? `/${routerBase}` : ''}/reset-password`;
  let linkResult;
  try {
    linkResult = await admin.auth.admin.generateLink({ type: linkType, email: targetEmail, options: { redirectTo } });
  } catch {
    return json({ error: 'Could not create password reset link' }, 500);
  }
  const { data: link, error: linkError } = linkResult;
  if (linkError || !link?.properties?.action_link) return json({ error: 'Could not create password reset link' }, 500);
  const sent = await sendStaffPasswordEmail({
    to: targetEmail,
    firstName: target.first_name || 'there',
    linkType,
    actionLink: link.properties.action_link,
  });
  if (!sent) return json({ error: 'Password reset email could not be sent' }, 502);
  return json({ success: true });
});
