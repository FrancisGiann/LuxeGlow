import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../../supabase/functions/process-notifications/index.ts', import.meta.url), 'utf8');
const handlerSource = source.slice(source.indexOf('Deno.serve('));
function fixture({ failSend = false, missingRecipient = false, reminderStatus = 'Confirmed', kind = 'pending' } = {}) {
  const updates = []; const messages = []; let handler;
  const job = { id: 9001, appointment_id: 'qa-appointment', recipient_id: 'qa-customer', kind, payload: {} };
  const admin = {
    async rpc(name) { return { data: name === 'claim_notification_outbox' ? [job] : null, error: null }; },
    from(table) {
      const chain = { select() { return chain; }, eq() { return chain; },
        update(value) { updates.push({ table, value }); return chain; },
        async single() { return { data: missingRecipient ? null : { email: 'customer@example.test', first_name: 'QA' }, error: null }; },
        async maybeSingle() { return { data: table === 'appointments' ? { status: reminderStatus, start_at: new Date(Date.now()+3600000).toISOString() } : { id: job.id }, error: null }; },
        then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); }
      }; return chain;
    }
  };
  runInNewContext(handlerSource, { Deno: { serve(value) { handler = value; } }, serviceKey: 'test', supabaseUrl: 'https://example.test', cronSecret: 'qa-token', smtpConfigured: true,
    transporter: { async sendMail(message) { messages.push(message); if (failSend) throw new Error('fixture transport error'); } },
    createClient: () => admin, corsHeaders: {}, json: (body, status = 200) => ({ body, status }),
    sendNotificationEmail: async (options, sendMail) => sendMail({ to: options.profile.email }),
    fromAddress: 'sender@example.test', fromName: 'QA', Date, console: { error() {} }, Response,
  });
  return { updates, messages, run: () => handler({ method: 'POST', headers: { get: () => 'qa-token' } }) };
}
test('worker sends the claimed recipient and records successful completion', async () => {
  const f = fixture(); const r = await f.run(); assert.equal(r.body.sent, 1); assert.equal(f.messages[0].to, 'customer@example.test'); assert.ok(f.updates.some(u => u.value.sent_at && u.value.claimed_at === null));
});
test('worker retries SMTP failure after five minutes without marking delivery sent', async () => {
  const f = fixture({ failSend: true }); const before = Date.now(); const r = await f.run(); assert.equal(r.body.failed, 1); const retry = f.updates.at(-1).value; assert.equal(retry.claimed_at, null); assert.ok(Date.parse(retry.available_at) >= before + 300000); assert.equal(retry.sent_at, undefined);
});
test('missing recipient retries without attempting provider delivery', async () => {
  const f = fixture({ missingRecipient: true }); const r = await f.run(); assert.equal(r.body.failed, 1); assert.equal(f.messages.length, 0); assert.ok(f.updates.at(-1).value.available_at);
});
test('stale cancelled appointment reminders are acknowledged without sending', async () => {
  const f = fixture({ kind: 'reminder', reminderStatus: 'Cancelled' }); const r = await f.run(); assert.equal(r.body.sent, 0); assert.equal(r.body.failed, 0); assert.equal(f.messages.length, 0); assert.ok(f.updates.at(-1).value.sent_at);
});
