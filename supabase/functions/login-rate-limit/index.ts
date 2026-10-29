import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizePhMobile } from '../_shared/smsHook.js';
import { classifyLoginAuthFailure } from '../_shared/loginAuthFailure.js';
import { readBoundedBody } from '../_shared/readBoundedBody.js';

const origin = Deno.env.get('ALLOWED_ORIGIN') || 'null';
const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_BODY_BYTES = 4096;
const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = 'Unable to sign in right now. Please try again later.';
const INVALID_CREDENTIALS = 'Invalid email or password.';

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, ...extraHeaders },
});

function firstForwardedValue(value: string | null) {
  return String(value || '').split(',')[0].trim().slice(0, 200) || 'unknown';
}

function requestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? firstForwardedValue(forwarded) : '';
}

async function hashKey(secret: string, namespace: string, value: string) {
  const input = new TextEncoder().encode(`${secret}:${namespace}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)) return json({ error: 'Invalid request.' }, 413);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authProxyKey = Deno.env.get('AUTH_PROXY_SECRET_KEY');
  const hashSecret = Deno.env.get('LOGIN_RATE_LIMIT_SECRET');
  if (!url || !serviceKey || typeof authProxyKey !== 'string' || !authProxyKey.startsWith('sb_secret_') || typeof hashSecret !== 'string' || hashSecret.length < 32) {
    return json({ error: GENERIC_ERROR }, 503);
  }

  let input: { email?: string; password?: string; mode?: string };
  try {
    const body = await readBoundedBody(request, MAX_BODY_BYTES);
    if (body === null) return json({ error: 'Invalid request.' }, 413);
    input = JSON.parse(body);
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  if (!input || typeof input !== 'object' || !['customer', 'staff'].includes(input.mode || '')) return json({ error: 'Invalid request.' }, 400);
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email) || !password || password.length > MAX_PASSWORD_LENGTH) {
    return json({ error: INVALID_CREDENTIALS }, 401);
  }

  const ip = requestIp(request);
  if (!ip || ip === 'unknown') return json({ error: GENERIC_ERROR }, 503);
  // Do not let a caller vary a forwarding header to reset the per-account
  // password budget. The separate IP bucket remains an additional limit.
  const identifierHash = await hashKey(hashSecret, 'identity', email);
  const ipHash = await hashKey(hashSecret, 'ip', ip);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: reservation, error: reservationError } = await admin.rpc('reserve_login_attempt', {
    p_identifier_hash: identifierHash,
    p_ip_hash: ipHash,
  });
  if (reservationError || reservation?.allowed !== true) {
    if (reservation?.allowed === false) {
      const retryAfter = Number(reservation?.retry_after) > 0 ? Math.ceil(Number(reservation.retry_after)) : 0;
      return json({ error: 'Too many sign-in attempts. Please try again later.' }, 429, { 'Retry-After': String(retryAfter || 900) });
    }
    return json({ error: GENERIC_ERROR }, 503);
  }

  const releaseReservation = async () => {
    await admin.rpc('release_login_attempt', { p_identifier_hash: identifierHash, p_ip_hash: ipHash });
  };

  let alias: { user_id: string; phone_e164: string; email_verified_at: string | null } | null = null;
  if (input.mode === 'customer' && Deno.env.get('SMS_ALIAS_LOGIN_ENABLED') === 'true') {
    const { data, error } = await admin.from('customer_login_aliases')
      .select('user_id,phone_e164,email_verified_at').eq('email_normalized', email).maybeSingle();
    if (error) {
      await releaseReservation();
      return json({ error: GENERIC_ERROR }, 503);
    }
    alias = data;
  }
  const aliasPhone = alias && !alias.email_verified_at ? alias.phone_e164 : null;

  let authResponse: Response;
  try {
    authResponse = await fetch(`${url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: authProxyKey,
        'Sb-Forwarded-For': ip,
        'Content-Type': 'application/json',
        'x-supabase-api-version': '2024-01-01',
      },
      body: JSON.stringify(aliasPhone ? { phone: aliasPhone, password } : { email, password }),
    });
  } catch {
    await releaseReservation();
    return json({ error: GENERIC_ERROR }, 503);
  }

  let authData: Record<string, unknown> = {};
  try { authData = await authResponse.json(); } catch { /* Keep generic response below. */ }
  const authUser = authData.user && typeof authData.user === 'object' ? authData.user as Record<string, unknown> : null;
  if (authResponse.status === 429) {
    await releaseReservation();
    const upstreamRetryAfter = Number(authResponse.headers.get('Retry-After'));
    const retryAfterHeader = Number.isFinite(upstreamRetryAfter) && upstreamRetryAfter > 0 ? String(Math.ceil(upstreamRetryAfter)) : '60';
    return json({ error: 'Too many sign-in attempts. Please try again later.' }, 429, { 'Retry-After': retryAfterHeader });
  }
  if (!authResponse.ok || typeof authData.access_token !== 'string' || typeof authData.refresh_token !== 'string' || typeof authUser?.id !== 'string') {
    // Do not expose GoTrue's account or credential details. Failed credential
    // responses keep their reservation; provider/server failures release it.
    if (authResponse.status >= 400 && authResponse.status < 500) {
      if (aliasPhone) return json({ error: INVALID_CREDENTIALS }, 401);
      const failure = classifyLoginAuthFailure(authResponse.status, authData);
      return json(failure.body, failure.status);
    }
    await releaseReservation();
    return json({ error: GENERIC_ERROR }, 503);
  }

  if (aliasPhone) {
    const [{ data: latestAlias, error: aliasError }, { data: current, error: userError },
      { data: profile, error: profileError }] = await Promise.all([
      admin.from('customer_login_aliases').select('user_id,phone_e164,email_verified_at').eq('email_normalized', email).maybeSingle(),
      admin.auth.admin.getUserById(alias!.user_id),
      admin.from('profiles').select('role,is_active').eq('id', alias!.user_id).maybeSingle(),
    ]);
    if (aliasError || userError || profileError || authUser.id !== alias!.user_id ||
        latestAlias?.user_id !== alias!.user_id || latestAlias?.phone_e164 !== aliasPhone ||
        latestAlias?.email_verified_at || normalizePhMobile(current?.user?.phone) !== aliasPhone ||
        !current?.user?.phone_confirmed_at || profile?.role !== 'customer' || !profile?.is_active) {
      // The issued tokens never leave this server when the alias or phone gate
      // changed during password verification.
      return json({ error: INVALID_CREDENTIALS }, 401);
    }
  }

  await releaseReservation();
  return json({
    success: true,
    session: {
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      expires_in: authData.expires_in,
      expires_at: authData.expires_at,
      token_type: authData.token_type,
      user: authUser,
    },
  });
});
