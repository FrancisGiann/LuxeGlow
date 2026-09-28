import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const workerSource = read('supabase/functions/process-notifications/index.ts');
const helpers = workerSource.match(/\/\/ EMAIL_DELIVERY_HELPERS_START([\s\S]*?)\/\/ EMAIL_DELIVERY_HELPERS_END/)?.[1];
assert.ok(helpers, 'email helpers must stay available for focused unit tests');
const helperModule = { exports: {} };
runInNewContext(`${helpers}\nmodule.exports = { buildNotificationEmail, sendNotificationEmail };`, { module: helperModule });
const { buildNotificationEmail, sendNotificationEmail } = helperModule.exports;

const baseEmail = {
  job: { id: 123, kind: 'pending', payload: { title: 'Booking request received', message: 'Your appointment is waiting.' } },
  profile: { email: 'customer@example.com', first_name: 'Taylor' },
  fromAddress: 'appointments@astrid.example',
  fromName: 'Astrid Nails & Beauty Bar',
};

test('booking and status changes both write customer outbox jobs', () => {
  const migration = read('supabase/migrations/20260827000000_initial.sql').toLowerCase();
  const bookingRpc = read('supabase/migrations/20260922000000_head_role_runtime.sql').toLowerCase();
  assert.match(migration, /create trigger appointments_enqueue_notification after insert or update of status on public\.appointments/);
  const trigger = migration.match(/create or replace function public\.enqueue_appointment_notification\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/)?.[1] || '';
  assert.match(trigger, /if tg_op = 'insert' or old\.status is distinct from new\.status/);
  assert.match(trigger, /insert into public\.notification_outbox\(appointment_id, recipient_id, kind, payload\)/);
  assert.match(trigger, /values \(new\.id, new\.customer_id, v_type,/);
  assert.match(bookingRpc, /insert into public\.appointments\(reference_no, customer_id, staff_id,/);
  assert.match(migration, /when 'pending' then 'pending'[\s\S]*when 'confirmed' then 'confirmed'/);
});

test('scheduler setup invokes the worker every minute using Vault-held credentials', () => {
  const schedule = read('database/supabase/schedule_notification_worker.sql');
  assert.match(schedule, /create extension if not exists pg_cron/i);
  assert.match(schedule, /create extension if not exists pg_net/i);
  assert.match(schedule, /cron\.schedule\(\s*'process-notifications',\s*'\* \* \* \* \*'/i);
  assert.match(schedule, /from vault\.decrypted_secrets[\s\S]*notification_worker_project_url/i);
  assert.match(schedule, /from vault\.decrypted_secrets[\s\S]*notification_worker_cron_token/i);
  assert.doesNotMatch(schedule, /re_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{20,}/);
});

test('worker requires SSL SMTP on port 465 and supports Gmail sender fallback', () => {
  assert.match(workerSource, /import nodemailer from 'npm:nodemailer'/);
  assert.match(workerSource, /const smtpPort = smtpPortValue \? Number\(smtpPortValue\) : 465/);
  assert.match(workerSource, /const smtpConfigured =[^;]*smtpPort === 465/);
  assert.match(workerSource, /secure: true/);
  assert.match(workerSource, /tls: \{ minVersion: 'TLSv1\.2' \}/);
  assert.match(workerSource, /MAIL_FROM_ADDRESS'\)\?\.trim\(\) \|\| smtpUser/);
  assert.doesNotMatch(workerSource, /RESEND_API_KEY/);
});

test('notification email uses the configured SMTP sender and message content', async () => {
  let captured;
  await sendNotificationEmail(baseEmail, async (message) => { captured = message; });

  assert.equal(captured.from, '"Astrid Nails & Beauty Bar" <appointments@astrid.example>');
  assert.equal(captured.to, 'customer@example.com');
  assert.equal(captured.subject, 'Booking request received');
  assert.match(captured.html, /^<!doctype html><html lang="en">/);
  assert.match(captured.html, /role="presentation"/);
  assert.match(captured.html, /width:100%;max-width:600px/);
  assert.match(captured.html, /background-color:#5a1846/);
  assert.match(captured.html, /BOOKING REQUEST/);
  assert.match(captured.html, /Hi Taylor,/);
  assert.match(captured.html, /Your appointment is waiting\./);
  assert.match(captured.html, /Astrid Nails &amp; Beauty Bar/);
  assert.equal(captured.text, [
    'Hi Taylor,',
    '',
    'Booking request received',
    '',
    'Your appointment is waiting.',
    '',
    'Thank you for choosing Astrid Nails & Beauty Bar.',
    '',
    'BOOKING UPDATE · Astrid Nails & Beauty Bar',
  ].join('\n'));
});

test('booking status emails include escaped booking references and kind-specific labels', () => {
  const bookingKinds = [
    ['pending', 'BOOKING REQUEST'],
    ['confirmed', 'APPOINTMENT CONFIRMED'],
    ['reminder', 'APPOINTMENT REMINDER'],
    ['cancelled', 'APPOINTMENT CANCELLED'],
    ['completed', 'VISIT COMPLETE'],
  ];

  for (const [kind, label] of bookingKinds) {
    const email = buildNotificationEmail({
      ...baseEmail,
      job: { id: 123, kind, payload: { title: `Update: ${kind}`, message: 'Your appointment has an update.', reference_no: 'LG-2026-007 <img src=x>' } },
    });

    assert.match(email.html, new RegExp(label));
    assert.match(email.html, /BOOKING UPDATE/);
    assert.match(email.html, /Booking reference/);
    assert.match(email.html, /LG-2026-007 &lt;img src=x&gt;/);
    assert.doesNotMatch(email.html, /<div[^>]*>LG-2026-007 <img/u);
    assert.match(email.text, /Booking reference: LG-2026-007 <img src=x>/);
  }
});

test('welcome and password notices use account styling without booking details', () => {
  const welcome = buildNotificationEmail({
    ...baseEmail,
    job: { id: 124, kind: 'welcome', payload: { title: 'Welcome to Astrid', message: 'Your email has been verified.', reference_no: 'SHOULD-NOT-APPEAR' } },
  });
  const passwordChanged = buildNotificationEmail({
    ...baseEmail,
    job: { id: 125, kind: 'password_changed', payload: { title: 'Password changed', message: 'Your password was changed.', reference_no: 'SHOULD-NOT-APPEAR' } },
  });

  assert.match(welcome.html, /WELCOME/);
  assert.match(welcome.html, /ACCOUNT NOTICE/);
  assert.match(welcome.html, /We’re glad you’re here\./);
  assert.doesNotMatch(welcome.html, /BOOKING UPDATE|Booking reference|SHOULD-NOT-APPEAR/);
  assert.match(passwordChanged.html, /ACCOUNT SECURITY/);
  assert.match(passwordChanged.html, /ACCOUNT NOTICE/);
  assert.doesNotMatch(passwordChanged.html, /BOOKING UPDATE|Booking reference|SHOULD-NOT-APPEAR/);
});

test('Supabase Auth templates use supported variables and preserve their action links', () => {
  const expectedVariables = {
    'confirmation.html': ['ConfirmationURL'],
    'invite.html': ['ConfirmationURL'],
    'magic_link.html': ['ConfirmationURL', 'Token'],
    'email_change.html': ['ConfirmationURL', 'NewEmail'],
    'recovery.html': ['ConfirmationURL'],
    'reauthentication.html': ['Token'],
    'password_changed_notification.html': ['Email'],
    'email_changed_notification.html': ['Email', 'OldEmail'],
  };
  const confirmationLinkTemplates = new Set([
    'confirmation.html',
    'invite.html',
    'magic_link.html',
    'email_change.html',
    'recovery.html',
  ]);

  for (const [name, variables] of Object.entries(expectedVariables)) {
    const html = read(`supabase/email-templates/${name}`);
    const foundVariables = [...html.matchAll(/\{\{\s*\.\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/gu)]
      .map((match) => match[1]);

    assert.ok(html.startsWith('<!doctype html>'), `${name} must be a complete HTML document`);
    assert.match(html, /role="presentation"/);
    assert.match(html, /width:100%;max-width:600px/);
    assert.match(html, /background-color:#5a1846/);
    assert.deepEqual([...new Set(foundVariables)].sort(), [...variables].sort(), `${name} uses only its supported Supabase variables`);
    if (confirmationLinkTemplates.has(name)) assert.match(html, /href="\{\{ \.ConfirmationURL \}\}"/);
    if (name.endsWith('_notification.html')) assert.doesNotMatch(html, /ConfirmationURL|href=/u);
  }

  assert.match(read('supabase/email-templates/magic_link.html'), /\{\{ \.Token \}\}/);
  assert.match(read('supabase/email-templates/reauthentication.html'), /\{\{ \.Token \}\}/);
  assert.match(read('supabase/email-templates/email_change.html'), /\{\{ \.NewEmail \}\}/);
});

test('message, greeting, reference, and headers are safely normalized and escaped', () => {
  const email = buildNotificationEmail({
    ...baseEmail,
    fromName: 'Astrid\r\nBcc: attacker@example.com <spoof>',
    profile: { email: 'customer@example.com', first_name: '<img src=x>' },
    job: { id: '9007199254740993', kind: 'confirmed', payload: { title: 'Confirmed\r\nBcc: attacker@example.com', message: '<script>alert(1)</script>\r\nSecond line', reference_no: 'REF\n<script>bad</script>' } },
  });

  assert.equal(email.subject, 'Confirmed Bcc: attacker@example.com');
  assert.equal(email.from, '"Astrid Bcc: attacker@example.com spoof" <appointments@astrid.example>');
  assert.match(email.html, /&lt;img src=x&gt;/);
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(email.html, /&lt;\/script&gt;<br>Second line/);
  assert.match(email.html, /REF &lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(email.html, /<script>|<img src=x>/);
  assert.match(email.text, /Booking reference: REF <script>bad<\/script>/);
  assert.match(email.html, /Confirmed Bcc: attacker@example\.com/);
  assert.doesNotMatch(email.html, /Confirmed<br>Bcc:/u);
});

test('untrusted message length is bounded in both HTML and plain text', () => {
  const email = buildNotificationEmail({
    ...baseEmail,
    job: { id: 126, kind: 'password_changed', payload: { title: 'Password changed', message: 'x'.repeat(10050) } },
  });

  assert.match(email.text, /x{10000}/u);
  assert.doesNotMatch(email.text, /x{10001}/u);
  assert.match(email.html, /x{10000}/u);
  assert.doesNotMatch(email.html, /x{10001}/u);
  assert.match(email.html, /word-wrap:break-word;overflow-wrap:anywhere;/u);
});

test('invalid recipient and SMTP errors remain retryable errors', async () => {
  assert.throws(() => buildNotificationEmail({
    ...baseEmail,
    profile: { email: 'invalid-address', first_name: 'Taylor' },
  }), /Recipient is not a valid email address/);

  await assert.rejects(() => sendNotificationEmail(baseEmail, async () => { throw new Error('SMTP connection failed'); }), /SMTP connection failed/);
  await assert.rejects(() => sendNotificationEmail(baseEmail), /SMTP transport is not configured/);
});
