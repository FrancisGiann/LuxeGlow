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
const BOOKING_NOTIFICATION_KINDS = new Set([
  'pending',
  'confirmed',
  'reminder',
  'cancelled',
  'completed',
]);
const NOTIFICATION_PRESENTATION = {
  pending: { label: 'BOOKING REQUEST', background: '#f3eadc', color: '#796323' },
  confirmed: { label: 'APPOINTMENT CONFIRMED', background: '#e9f2ec', color: '#315a42' },
  reminder: { label: 'APPOINTMENT REMINDER', background: '#f2ecf1', color: '#5a1846' },
  cancelled: { label: 'APPOINTMENT CANCELLED', background: '#f7ebea', color: '#8a3b39' },
  completed: { label: 'VISIT COMPLETE', background: '#f2ecf1', color: '#5a1846' },
  welcome: { label: 'WELCOME', background: '#f2ecf1', color: '#5a1846' },
  password_changed: { label: 'ACCOUNT SECURITY', background: '#f2ecf1', color: '#5a1846' },
};

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

/** @param {unknown} value */
function cleanEmailText(value) {
  return (typeof value === 'string' ? value : '')
    .replace(/\r\n?/gu, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '');
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
  const firstName = cleanEmailText(profile?.first_name).replace(/\n/gu, ' ').trim().slice(0, 100) || 'there';
  const payload = job?.payload && typeof job.payload === 'object' && !Array.isArray(job.payload)
    ? job.payload
    : {};
  const subject = cleanHeader(payload.title, 'Astrid Nails update', 200);
  const message = cleanEmailText(payload.message).trim() || 'You have an update from Astrid Nails & Beauty Bar.';
  const boundedMessage = message.slice(0, 10000);
  const presentation = NOTIFICATION_PRESENTATION[job.kind];
  const isBookingNotice = BOOKING_NOTIFICATION_KINDS.has(job.kind);
  const reference = isBookingNotice
    ? cleanEmailText(payload.reference_no).replace(/\n/gu, ' ').trim().slice(0, 120)
    : '';
  const safeFirstName = escapeHtml(firstName);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(boundedMessage).replace(/\n/gu, '<br>');
  const safeReference = escapeHtml(reference);
  const categoryLabel = isBookingNotice ? 'BOOKING UPDATE' : 'ACCOUNT NOTICE';
  const closing = job.kind === 'welcome'
    ? '<p style="margin:24px 0 0;color:#5e5360;font-size:14px;line-height:1.65;">We’re glad you’re here.</p>'
    : isBookingNotice
      ? '<p style="margin:24px 0 0;color:#5e5360;font-size:14px;line-height:1.65;">Thank you for choosing Astrid Nails &amp; Beauty Bar.</p>'
      : '';
  const referenceBlock = reference
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;border:1px solid #e8dece;background:#fbf8f3;"><tr><td style="padding:16px 18px;"><div style="color:#6f5966;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;line-height:1.4;text-transform:uppercase;">Booking reference</div><div style="overflow-wrap:anywhere;margin-top:6px;color:#5a1846;font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:bold;line-height:1.35;">${safeReference}</div></td></tr></table>`
    : '';

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${safeSubject}</title></head><body style="margin:0;padding:0;background-color:#f6f2ed;color:#302830;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f6f2ed;"><tr><td align="center" style="padding:28px 14px;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border:1px solid #e9e0d7;background-color:#ffffff;"><tr><td style="padding:25px 30px;background-color:#5a1846;border-bottom:3px solid #d5bd8f;"><div style="color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:bold;letter-spacing:.2px;line-height:1.2;">Astrid Nails</div><div style="margin-top:5px;color:#eadcc2;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;letter-spacing:2px;line-height:1.4;text-transform:uppercase;">&amp; Beauty Bar</div></td></tr><tr><td style="padding:32px 30px 34px;"><div style="display:inline-block;padding:7px 10px;background-color:${presentation.background};color:${presentation.color};font-size:10px;font-weight:bold;letter-spacing:1.1px;line-height:1.3;">${presentation.label}</div><p style="margin:22px 0 7px;color:#6f5966;font-size:14px;line-height:1.5;">Hi ${safeFirstName},</p><h1 style="margin:0;color:#382735;font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:normal;line-height:1.25;word-wrap:break-word;overflow-wrap:anywhere;">${safeSubject}</h1><p style="margin:18px 0 0;color:#514751;font-size:15px;line-height:1.75;word-wrap:break-word;overflow-wrap:anywhere;">${safeMessage}</p>${referenceBlock}${closing}<div style="height:1px;margin-top:30px;background-color:#eee7e0;font-size:1px;line-height:1px;">&nbsp;</div><p style="margin:18px 0 0;color:#6f5966;font-size:12px;line-height:1.6;">${categoryLabel} · Astrid Nails &amp; Beauty Bar</p></td></tr><tr><td style="padding:16px 30px;background-color:#fbf9f6;color:#6f5966;font-size:11px;line-height:1.6;">This email was sent to you by Astrid Nails &amp; Beauty Bar.</td></tr></table></td></tr></table></body></html>`;
  const textLines = [
    `Hi ${firstName},`,
    '',
    subject,
    '',
    boundedMessage,
  ];
  if (reference) textLines.push('', `Booking reference: ${reference}`);
  if (job.kind === 'welcome') textLines.push('', 'We’re glad you’re here.');
  if (isBookingNotice) textLines.push('', 'Thank you for choosing Astrid Nails & Beauty Bar.');
  textLines.push('', `${categoryLabel} · Astrid Nails & Beauty Bar`);

  return {
    from: `"${senderName}" <${from}>`,
    to,
    subject,
    html,
    text: textLines.join('\n'),
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
