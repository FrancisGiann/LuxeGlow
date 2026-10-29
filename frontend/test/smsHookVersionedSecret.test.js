import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { verifyStandardWebhook } from '../../supabase/functions/_shared/smsHook.js';

test('Supabase versioned hook secret verifies only the signed request body', async () => {
  const key = randomBytes(32);
  const secret = `v1,whsec_${key.toString('base64')}`;
  const id = 'signup-test';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = '{"sms":{"otp":"000000"}}';
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  const headers = new Headers({
    'webhook-id': id,
    'webhook-timestamp': timestamp,
    'webhook-signature': `v1,${signature}`,
  });

  assert.equal(await verifyStandardWebhook(body, headers, secret), id);
  assert.equal(await verifyStandardWebhook(`${body} `, headers, secret), null);
  assert.equal(await verifyStandardWebhook(body, headers, `v1,whsec_${randomBytes(32).toString('base64')}`), null);
});
