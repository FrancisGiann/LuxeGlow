import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashPhone, parseSmsHookPayload, smsRecipientAllowed, verifyStandardWebhook } from '../_shared/smsHook.js';
import { readBoundedBody } from '../_shared/readBoundedBody.js';

const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
Deno.serve(async (request) => {
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  if (Deno.env.get('SMS_SENDING_ENABLED') !== 'true') return respond({ error: 'SMS sending is disabled' }, 503);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hookSecret = Deno.env.get('SMS_HOOK_SECRET');
  const rateSecret = Deno.env.get('SMS_RATE_SECRET');
  const providerKey = Deno.env.get('UNISMS_SECRET_KEY');
  const senderId = Deno.env.get('UNISMS_SENDER_ID');
  const sendScope = Deno.env.get('SMS_SEND_SCOPE');
  const testPhone = Deno.env.get('SMS_TEST_PHONE');
  if (!url || !serviceKey || !hookSecret || !rateSecret || !providerKey || !senderId) {
    return respond({ error: 'SMS delivery unavailable' }, 503);
  }
  if (sendScope !== 'test' && sendScope !== 'public') return respond({ error: 'SMS delivery unavailable' }, 503);
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > 8192)) {
    return respond({ error: 'Invalid request' }, 413);
  }
  const rawBody = await readBoundedBody(request, 8192);
  if (rawBody === null) return respond({ error: 'Invalid request' }, 413);
  const hookId = await verifyStandardWebhook(rawBody, request.headers, hookSecret);
  if (!hookId) return respond({ error: 'Unauthorized' }, 401);
  const sms = parseSmsHookPayload(rawBody);
  if (!sms) return respond({ error: 'Invalid SMS request' }, 400);
  const phoneHash = await hashPhone(sms.phone, rateSecret);
  if (!smsRecipientAllowed(sendScope, testPhone, sms.phone)) {
    return respond({ error: 'SMS delivery unavailable' }, 503);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Auth's hook omits an explicit purpose. A previously activated customer
  // changing phones must never receive a signup-labelled OTP through it.
  const { data: existingAlias, error: aliasError } = await admin.from('customer_login_aliases')
    .select('user_id').eq('user_id', sms.userId).maybeSingle();
  if (aliasError) return respond({ error: 'SMS delivery unavailable' }, 503);
  if (existingAlias) return respond({ error: 'This SMS purpose is unavailable' }, 400);
  const { data: reserved, error: reserveError } = await admin.rpc('reserve_sms_send', {
    p_hook_id: hookId, p_phone_hash: phoneHash,
  });
  if (reserveError) return respond({ error: 'SMS delivery unavailable' }, 503);
  if (reserved !== true) return respond({ error: 'Please wait before requesting another code' }, 429);
  try {
    const authorization = btoa(`${providerKey}:`);
    const response = await fetch('https://unismsapi.com/api/sms', {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: sms.phone, sender_id: senderId,
        content: `LuxeGlow signup code: ${sms.otp}. Expires in 5 minutes. Do not share this code.` }),
      signal: AbortSignal.timeout(4000),
    });
    if (response.status !== 201) return respond({ error: 'Could not send code to this number' }, response.status === 422 ? 422 : 503);
    // Hosted GoTrue validates the hook response's MIME type even though the
    // Send SMS hook does not consume a response payload. Return JSON so a
    // successful provider send does not make signup fail afterward.
    return respond({});
  } catch {
    // A timed-out provider response is uncertain. The hook ID stays consumed;
    // never retry it automatically and risk duplicate paid messages.
    return respond({ error: 'SMS delivery unavailable' }, 503);
  }
});
