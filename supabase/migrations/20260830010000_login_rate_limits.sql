-- Guest login throttling for the browser's app-side gateway.
-- Only keyed SHA-256 identity (email + IP) and IP keys are stored; GoTrue
-- remains the credential boundary.

begin;

create table if not exists public.login_rate_limits (
  scope text not null check (scope in ('identity', 'ip')),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  primary key (scope, key_hash)
);

alter table public.login_rate_limits enable row level security;
revoke all on table public.login_rate_limits from public, anon, authenticated;
create index if not exists login_rate_limits_window_started_idx
  on public.login_rate_limits(window_started_at);

drop function if exists public.check_login_rate_limit(text, text, timestamptz);
drop function if exists public.record_login_failure(text, text, timestamptz);
drop function if exists public.reset_login_rate_limit(text, text, timestamptz);

create or replace function public.reserve_login_attempt(
  p_identifier_hash text,
  p_ip_hash text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blocked_until timestamptz;
begin
  if p_identifier_hash is null or p_ip_hash is null
     or p_identifier_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid rate-limit key.';
  end if;

  -- Keep cleanup bounded so a login request cannot trigger an unbounded scan.
  delete from public.login_rate_limits
   where ctid in (
     select ctid
       from public.login_rate_limits
      where window_started_at < p_now - interval '24 hours'
      order by window_started_at asc
      limit 100
   );

  insert into public.login_rate_limits(scope, key_hash)
  values ('identity', p_identifier_hash), ('ip', p_ip_hash)
  on conflict (scope, key_hash) do nothing;

  -- Lock both rows in the same order for every request. This makes the
  -- reservation itself atomic and prevents parallel burst bypasses.
  perform 1
    from public.login_rate_limits
   where (scope, key_hash) in (('identity', p_identifier_hash), ('ip', p_ip_hash))
   order by scope
   for update;

  select max(blocked_until)
    into v_blocked_until
    from public.login_rate_limits
   where (scope, key_hash) in (('identity', p_identifier_hash), ('ip', p_ip_hash));
  if v_blocked_until is not null and v_blocked_until > p_now then
    return jsonb_build_object(
      'allowed', false,
      'retry_after', greatest(1, ceil(extract(epoch from (v_blocked_until - p_now))))::integer
    );
  end if;

  update public.login_rate_limits
     set failed_attempts = 0, window_started_at = p_now, blocked_until = null
   where (scope, key_hash) in (('identity', p_identifier_hash), ('ip', p_ip_hash))
     and (window_started_at <= p_now - interval '15 minutes' or blocked_until <= p_now);

  update public.login_rate_limits
     set failed_attempts = failed_attempts + 1,
         blocked_until = case
           when scope = 'identity' and failed_attempts + 1 >= 5 then p_now + interval '15 minutes'
           when scope = 'ip' and failed_attempts + 1 >= 20 then p_now + interval '15 minutes'
           else null
         end
   where (scope, key_hash) in (('identity', p_identifier_hash), ('ip', p_ip_hash));

  select max(blocked_until) into v_blocked_until
    from public.login_rate_limits
   where (scope, key_hash) in (('identity', p_identifier_hash), ('ip', p_ip_hash));
  return jsonb_build_object(
    'allowed', true,
    'retry_after', case when v_blocked_until is not null and v_blocked_until > p_now then greatest(1, ceil(extract(epoch from (v_blocked_until - p_now))))::integer else 0 end
  );
end;
$$;

create or replace function public.release_login_attempt(
  p_identifier_hash text,
  p_ip_hash text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blocked_until timestamptz;
begin
  if p_identifier_hash is null or p_ip_hash is null
     or p_identifier_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid rate-limit key.';
  end if;

  perform 1
    from public.login_rate_limits
   where (scope, key_hash) in (('identity', p_identifier_hash), ('ip', p_ip_hash))
   order by scope
   for update;

  update public.login_rate_limits
     set failed_attempts = greatest(0, failed_attempts - 1),
         blocked_until = case
           when scope = 'identity' and failed_attempts - 1 < 5 then null
           when scope = 'ip' and failed_attempts - 1 < 20 then null
           else blocked_until
         end,
         window_started_at = case when failed_attempts <= 1 then p_now else window_started_at end
   where (scope, key_hash) in (('identity', p_identifier_hash), ('ip', p_ip_hash));

  select max(blocked_until) into v_blocked_until
    from public.login_rate_limits
   where (scope, key_hash) in (('identity', p_identifier_hash), ('ip', p_ip_hash));
  return jsonb_build_object(
    'allowed', true,
    'retry_after', case when v_blocked_until is not null and v_blocked_until > p_now then greatest(1, ceil(extract(epoch from (v_blocked_until - p_now))))::integer else 0 end
  );
end;
$$;

revoke all on function public.reserve_login_attempt(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.release_login_attempt(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_login_attempt(text, text, timestamptz) to service_role;
grant execute on function public.release_login_attempt(text, text, timestamptz) to service_role;

commit;
