import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const migration = async (name) => {
  const deployed = await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
  const mirror = await readFile(new URL(`../../database/supabase/migrations/${name}`, import.meta.url), 'utf8');
  assert.equal(deployed, mirror);
  return deployed;
};

test('new SMS customers require password AMR and a current server session for owned data', async () => {
  const sql = await migration('20261027050000_sms_customer_session_boundary.sql');
  assert.match(sql, /v_method = 'password'/);
  assert.match(sql, /v_method = 'token_refresh'/);
  assert.match(sql, /raise exception 'Authentication unavailable'/);
  assert.match(sql, /from auth\.sessions s/);
  assert.match(sql, /auth\.jwt\(\)->'amr'/);
  assert.match(sql, /public\.customer_password_session_allowed\(\)/);
  assert.match(sql, /as restrictive for select to authenticated/);
  assert.match(sql, /as restrictive for all to authenticated/);
  assert.match(sql, /grant execute on function public\.sms_customer_access_token_hook\(jsonb\) to supabase_auth_admin/);
});

test('Auth phones with or without a plus sign use one verified alias binding', async () => {
  const sql = await migration('20261027080000_sms_auth_phone_canonicalization.sql');
  assert.match(sql, /when p_phone ~ '\^\\\+639\[0-9\]\{9\}\$' then p_phone/);
  assert.match(sql, /when p_phone ~ '\^639\[0-9\]\{9\}\$' then '\+' \|\| p_phone/);
  for (const name of [
    'prevent_customer_identity_changes', 'claim_customer_login_alias',
    'suspend_changed_customer_phone', 'sms_customer_access_token_hook', 'is_active_account',
  ]) {
    const definition = sql.match(new RegExp(`create or replace function public\\.${name}\\s*\\([\\s\\S]*?\\$\\$;`))?.[0];
    assert.ok(definition, `${name} is updated`);
    assert.match(definition, /public\.ph_auth_phone_e164\(/);
  }
  assert.match(sql, /v_user\.phone_confirmed_at is null or public\.ph_auth_phone_e164\(v_user\.phone\) is null/);
  assert.match(sql, /a\.phone_e164 = public\.ph_auth_phone_e164\(u\.phone\)/);
});

test('every customer SECURITY DEFINER RPC that trusts profile activity gets the session guard', async () => {
  const sql = await migration('20261027060000_sms_customer_rpc_session_gate.sql');
  const guarded = [
    'get_my_appointment_staff', 'book_appointment', 'customer_cancel_appointment',
    'reconcile_expired_pending_appointments', 'request_appointment_reschedule', 'get_reschedule_slots',
  ];
  for (const name of guarded) {
    const definition = sql.match(new RegExp(`create or replace function public\\.${name}\\s*\\([\\s\\S]*?\\$\\$;`))?.[0];
    assert.ok(definition, `${name} is covered`);
    assert.match(definition, /public\.has_sms_customer_alias\(\) and not public\.customer_password_session_allowed\(\)/);
  }
});

test('recovery revokes server sessions and the signup OTP session is removed after alias claim', async () => {
  const recovery = await migration('20261027020000_dual_channel_recovery.sql');
  assert.match(recovery, /delete from auth\.sessions where user_id = p_user_id/);
  const source = await readFile(new URL('../src/api/endpoints.js', import.meta.url), 'utf8');
  assert.match(source, /claim-sms-signup[\s\S]*?signOut\(\{ scope: 'local' \}\)/);
});
