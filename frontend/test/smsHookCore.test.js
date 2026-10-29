import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPhone, normalizePhMobile, parseSmsHookPayload, smsRecipientAllowed, verifyStandardWebhook } from '../../supabase/functions/_shared/smsHook.js';

test('accepts the published Standard Webhooks test vector, then rejects tampering', async () => {
  const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
  const headers = new Headers({
    'webhook-id': 'msg_p5jXN8AQM9LWM0D4loKWxJek',
    'webhook-timestamp': '1614265330',
    'webhook-signature': 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
  });
  assert.equal(await verifyStandardWebhook('{"test": 2432232314}', headers, secret, 1614265330), headers.get('webhook-id'));
  assert.equal(await verifyStandardWebhook('{"test": 2432232315}', headers, secret, 1614265330), null);
  assert.equal(await verifyStandardWebhook('{"test": 2432232314}', headers, secret, 1614265631), null);
});

test('requires Philippine mobile and numeric provider OTP', () => {
  const id = '6481a5c1-3d37-4a56-9f6a-bee08c554965';
  assert.equal(normalizePhMobile('0917 123 4567'), '+639171234567');
  assert.equal(normalizePhMobile('+15551234567'), null);
  const user = { id, phone: '+639171234567', app_metadata: { provider: 'phone' }, user_metadata: { pending_login_email: 'test@example.test' } };
  assert.deepEqual(parseSmsHookPayload(JSON.stringify({ user, sms: { otp: '123456' } })),
    { userId: id, phone: '+639171234567', otp: '123456' });
  assert.deepEqual(parseSmsHookPayload(JSON.stringify({ user: { ...user, phone: '639171234567' }, sms: { otp: '123456' } })),
    { userId: id, phone: '+639171234567', otp: '123456' });
  assert.equal(parseSmsHookPayload(JSON.stringify({ user, sms: { otp: 'abc' } })), null);
  assert.equal(parseSmsHookPayload(JSON.stringify({ user: { ...user, phone_confirmed_at: 'now' }, sms: { otp: '123456' } })), null);
  assert.equal(parseSmsHookPayload(JSON.stringify({ user: { ...user, user_metadata: {} }, sms: { otp: '123456' } })), null);
  assert.equal(parseSmsHookPayload(JSON.stringify({ user: { phone: '+639171234567', app_metadata: { provider: 'phone' } }, sms: { otp: '123456' } })), null);
});

test('phone hashes are keyed and stable for limits without storing raw numbers', async () => {
  const a = await hashPhone('+639171234567', 'a'.repeat(32));
  const b = await hashPhone('+639171234567', 'b'.repeat(32));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test('controlled test sending accepts only the configured recipient and fails closed', () => {
  assert.equal(smsRecipientAllowed('test', '639171234567', '+639171234567'), true);
  assert.equal(smsRecipientAllowed('test', '+639171234567', '+639181234567'), false);
  assert.equal(smsRecipientAllowed('test', '', '+639171234567'), false);
  assert.equal(smsRecipientAllowed('test', 'not-a-number', '+639171234567'), false);
  assert.equal(smsRecipientAllowed(undefined, '+639171234567', '+639171234567'), false);
  assert.equal(smsRecipientAllowed('public', '', '+639181234567'), true);
});
