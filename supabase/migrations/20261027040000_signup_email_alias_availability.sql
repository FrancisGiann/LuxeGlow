-- Extend the deployed email availability signal for SMS login aliases.
-- Apply after 20261027010000 and 20261027030000.
begin;
create or replace function public.check_signup_email_availability(p_email text, p_email_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_now timestamptz;
  v_retry integer;
  v_global text := repeat('0', 64);
  v_available boolean;
begin
  if v_email is null or octet_length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid request.';
  end if;
  delete from public.signup_email_check_limits where ctid in (
    select ctid from public.signup_email_check_limits
    where window_started_at < clock_timestamp() - interval '24 hours'
    order by window_started_at limit 100
  );
  insert into public.signup_email_check_limits(scope, key_hash)
    values ('global', v_global), ('email', p_email_hash) on conflict do nothing;
  -- Across replicas: serialize both budgets in a stable order before any lookup.
  perform 1 from public.signup_email_check_limits
    where (scope, key_hash) in (('global', v_global), ('email', p_email_hash))
    order by scope, key_hash for update;
  v_now := clock_timestamp();
  update public.signup_email_check_limits set attempts = 0, window_started_at = v_now
    where (scope, key_hash) in (('global', v_global), ('email', p_email_hash))
      and window_started_at <= v_now - interval '15 minutes';
  select max(greatest(1, ceil(extract(epoch from (window_started_at + interval '15 minutes' - v_now))))::integer)
    into v_retry from public.signup_email_check_limits
    where (scope, key_hash) in (('global', v_global), ('email', p_email_hash))
      and attempts >= case when scope = 'email' then 3 else 60 end;
  if v_retry is not null then
    return jsonb_build_object('allowed', false, 'retry_after', v_retry);
  end if;
  update public.signup_email_check_limits set attempts = attempts + 1
    where (scope, key_hash) in (('global', v_global), ('email', p_email_hash));
  -- All account states and roles yield the same bit. No profile data is exposed.
  -- Phone identities can reserve a login alias before verifying an inbox.
  -- Keep both namespaces unavailable while unique indexes decide races.
  select not exists(select 1 from auth.users where lower(btrim(email)) = v_email)
     and not exists(select 1 from public.customer_login_aliases where email_normalized = v_email)
    into v_available;
  return jsonb_build_object('allowed', true, 'available', v_available);
end;
$$;
commit;
