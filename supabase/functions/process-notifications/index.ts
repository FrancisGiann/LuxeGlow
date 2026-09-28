import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'null',
  'Access-Control-Allow-Headers': 'authorization, x-cron-token, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const cronSecret = Deno.env.get('CRON_SECRET_TOKEN');
const smtpHost = Deno.env.get('MAIL_HOST')?.trim() || 'smtp.gmail.com';
const smtpPortValue = Deno.env.get('MAIL_PORT')?.trim();
const smtpPort = smtpPortValue ? Number(smtpPortValue) : 465;
const smtpUser = Deno.env.get('MAIL_USERNAME')?.trim();
const smtpPass = Deno.env.get('MAIL_PASSWORD');
const fromAddress = Deno.env.get('MAIL_FROM_ADDRESS')?.trim() || smtpUser || '';
const fromName = Deno.env.get('MAIL_FROM_NAME') || 'Astrid Nails & Beauty Bar';
const smtpConfigured = !!smtpUser && !!smtpPass && !!fromAddress && smtpPort === 465;
const transporter = smtpConfigured
  ? nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: { user: smtpUser!, pass: smtpPass! },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: 'TLSv1.2' },
  })
  : null;

if (!serviceKey || !supabaseUrl || !cronSecret) console.error('Missing notification worker credentials or CRON_SECRET_TOKEN');
if (!smtpConfigured) console.error('Missing SMTP credentials or MAIL_PORT is not 465');

// EMAIL_DELIVERY_HELPERS_START
const EMAIL_ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u;
const NOTIFICATION_KINDS = new Set([
  'pending',
  'confirmed',
  'reminder',
  'cancelled',
  'completed',
  'welcome',
  'password_changed',
]);

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** @param {unknown} value @param {string} label */
function requireEmail(value, label) {
  const email = typeof value === 'string' ? value.trim() : '';
  if (email.length > 254 || !EMAIL_ADDRESS_PATTERN.test(email)) {
    throw new Error(`${label} is not a valid email address`);
  }
  return email;
}

/** @param {unknown} value @param {string} fallback @param {number} maxLength */
function cleanHeader(value, fallback, maxLength) {
  return (typeof value === 'string' ? value : fallback)
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .trim()
    .slice(0, maxLength) || fallback;
}

/**
 * @param {{
 *   job: { id: number | string | bigint; kind: string; payload?: Record<string, unknown> | unknown[] | null },
 *   profile: { email?: unknown; first_name?: unknown },
 *   fromAddress: string,
 *   fromName: string
 * }} options
 */
function buildNotificationEmail({ job, profile, fromAddress, fromName }) {
  const jobId = String(job?.id ?? '');
  if (!/^\d+$/u.test(jobId) || jobId === '0') throw new Error('Notification job id is invalid');
  if (!NOTIFICATION_KINDS.has(job?.kind)) throw new Error('Notification kind is invalid');

  const to = requireEmail(profile?.email, 'Recipient');
  const from = requireEmail(fromAddress, 'Sender');
  const senderName = cleanHeader(fromName, 'Astrid Nails & Beauty Bar', 100)
    .replace(/[<>]/gu, '')
    .replaceAll('"', '\\"');
  const firstName = (typeof profile?.first_name === 'string' ? profile.first_name : '').trim().slice(0, 100) || 'there';
  const payload = job?.payload && typeof job.payload === 'object' && !Array.isArray(job.payload)
    ? job.payload
    : {};
  const subject = cleanHeader(payload.title, 'Astrid Nails update', 200);
  const message = (typeof payload.message === 'string' ? payload.message.trim() : '') || 'You have an appointment update.';
  const boundedMessage = message.slice(0, 10000);
  const safeFirstName = escapeHtml(firstName);
  const safeMessage = escapeHtml(boundedMessage);

  const html = job.kind === 'welcome'
    ? `<p>Hi ${safeFirstName},</p><p>${safeMessage}</p><p>We look forward to seeing you!</p>`
    : job.kind === 'password_changed'
      ? `<p>Hi ${safeFirstName},</p><p>${safeMessage}</p>`
      : `<p>Hi ${safeFirstName},</p><p>${safeMessage}</p><p>Astrid Nails &amp; Beauty Bar</p>`;

  return {
    from: `"${senderName}" <${from}>`,
    to,
    subject,
    html,
    text: `Hi ${firstName},\n\n${boundedMessage}\n\nAstrid Nails & Beauty Bar`,
  };
}

/**
 * @param {Parameters<typeof buildNotificationEmail>[0]} options
 * @param {(message: ReturnType<typeof buildNotificationEmail>) => Promise<unknown>} sendMail
 */
async function sendNotificationEmail(options, sendMail) {
  if (typeof sendMail !== 'function') throw new Error('SMTP transport is not configured');
  await sendMail(buildNotificationEmail(options));
}
// EMAIL_DELIVERY_HELPERS_END

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!serviceKey || !supabaseUrl || !cronSecret || !smtpConfigured || !transporter) return json({ error: 'Function is not configured' }, 500);

  const supplied = request.headers.get('x-cron-token') || '';
  if (supplied.length !== cronSecret.length || supplied !== cronSecret) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  
  const { error: maintenanceError } = await admin.rpc('run_appointment_maintenance');
  if (maintenanceError) {
    console.error('maintenance failed', maintenanceError);
    return json({ error: 'Maintenance failed' }, 500);
  }
  
  const { data: jobs, error: claimError } = await admin.rpc('claim_notification_outbox', { p_limit: 25 });
  if (claimError) {
    console.error('claim failed', claimError);
    return json({ error: 'Could not claim notification jobs' }, 500);
  }

  let sent = 0;
  let failed = 0;
  for (const job of jobs || []) {
    try {
      const { data: profile, error: profileError } = await admin.from('profiles').select('email,first_name').eq('id', job.recipient_id).single();
      if (profileError || !profile?.email) throw new Error('Recipient profile is missing an email');
      await sendNotificationEmail({
        job,
        profile,
        fromAddress,
        fromName,
      }, (message) => transporter.sendMail(message));

      const { error: updateError } = await admin.from('notification_outbox').update({ sent_at: new Date().toISOString(), claimed_at: null, last_error: null }).eq('id', job.id);
      if (updateError) throw updateError;
      sent += 1;
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 500);
      const { error: retryError } = await admin.from('notification_outbox').update({ claimed_at: null, available_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), last_error: message }).eq('id', job.id);
      if (retryError) console.error('notification retry scheduling failed', job.id, retryError.message);
      console.error('notification job failed', job.id, message);
      failed += 1;
    }
  }
  return json({ claimed: jobs?.length || 0, sent, failed });
});
