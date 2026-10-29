-- Apply before setting SMS_SEND_SCOPE=public. Existing send claims count toward
-- the rolling window, so this can temporarily block all new sends.
begin;

create or replace function public.reserve_sms_send(p_hook_id text, p_phone_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_hook_id is null or char_length(p_hook_id) > 128 or p_hook_id !~ '^[A-Za-z0-9_-]+$'
     or p_phone_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(2100, 1);
  if exists (select 1 from public.sms_send_claims where hook_id = p_hook_id) or
     (select count(*) from public.sms_send_claims where created_at > now() - interval '1 day') >= 2 or
     (select count(*) from public.sms_send_claims where phone_hash = p_phone_hash
        and created_at > now() - interval '1 hour') >= 3 or
     exists (select 1 from public.sms_send_claims where phone_hash = p_phone_hash
       and created_at > now() - interval '60 seconds') then return false; end if;
  insert into public.sms_send_claims(hook_id,phone_hash) values (p_hook_id,p_phone_hash);
  return true;
end;
$$;
revoke all on function public.reserve_sms_send(text,text) from public, anon, authenticated;
grant execute on function public.reserve_sms_send(text,text) to service_role;

commit;
