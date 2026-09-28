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

  assert.deepEqual(JSON.parse(JSON.stringify(captured)), {
    from: '"Astrid Nails & Beauty Bar" <appointments@astrid.example>',
    to: 'customer@example.com',
    subject: 'Booking request received',
    html: '<p>Hi Taylor,</p><p>Your appointment is waiting.</p><p>Astrid Nails &amp; Beauty Bar</p>',
    text: 'Hi Taylor,\n\nYour appointment is waiting.\n\nAstrid Nails & Beauty Bar',
  });
});

test('message content is HTML-escaped and mail headers are bounded against injection', () => {
  const email = buildNotificationEmail({
    ...baseEmail,
    fromName: 'Astrid\r\nBcc: attacker@example.com <spoof>',
    profile: { email: 'customer@example.com', first_name: '<img src=x>' },
    job: { id: '9007199254740993', kind: 'confirmed', payload: { title: 'Confirmed\r\nBcc: attacker@example.com', message: '<script>alert(1)</script>' } },
  });

  assert.equal(email.subject, 'Confirmed Bcc: attacker@example.com');
  assert.equal(email.from, '"Astrid Bcc: attacker@example.com spoof" <appointments@astrid.example>');
  assert.match(email.html, /&lt;img src=x&gt;/);
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('invalid recipient and SMTP errors remain retryable errors', async () => {
  assert.throws(() => buildNotificationEmail({
    ...baseEmail,
    profile: { email: 'invalid-address', first_name: 'Taylor' },
  }), /Recipient is not a valid email address/);

  await assert.rejects(() => sendNotificationEmail(baseEmail, async () => { throw new Error('SMTP connection failed'); }), /SMTP connection failed/);
  await assert.rejects(() => sendNotificationEmail(baseEmail), /SMTP transport is not configured/);
});
