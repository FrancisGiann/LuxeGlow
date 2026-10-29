-- Apply after 20261027010000_sms_customer_activation.sql. No client role can read
-- recovery secrets or call these service-role-only state transitions.
begin;

create table public.password_recovery_challenges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  destination_hash text not null check (destination_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  consumed_at timestamptz
);
create index password_recovery_challenges_user_time on public.password_recovery_challenges(user_id, created_at desc);
create index password_recovery_challenges_destination_time on public.password_recovery_challenges(destination_hash, created_at desc);
create index password_recovery_challenges_ip_time on public.password_recovery_challenges(ip_hash, created_at desc);
alter table public.password_recovery_challenges enable row level security;
revoke all on public.password_recovery_challenges from public, anon, authenticated;

create table public.password_recovery_grants (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null unique references public.password_recovery_challenges(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
alter table public.password_recovery_grants enable row level security;
revoke all on public.password_recovery_grants from public, anon, authenticated;

-- Count every request, including unknown accounts, before any identity lookup.
create table public.password_recovery_request_ips (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index password_recovery_request_ip_time on public.password_recovery_request_ips(ip_hash, created_at desc);
alter table public.password_recovery_request_ips enable row level security;
revoke all on public.password_recovery_request_ips from public, anon, authenticated;
create function public.reserve_password_recovery_ip(p_ip_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 2101));
  if (select count(*) from public.password_recovery_request_ips
      where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 10 then return false; end if;
  insert into public.password_recovery_request_ips(ip_hash) values(p_ip_hash);
  return true;
end;
$$;
revoke all on function public.reserve_password_recovery_ip(text) from public, anon, authenticated;
grant execute on function public.reserve_password_recovery_ip(text) to service_role;

-- Returns only a reservation decision; the caller must send to the verified
-- destination read from auth.users, never to an address supplied by the client.
create function public.reserve_password_recovery(
  p_id uuid, p_user_id uuid, p_channel text, p_secret_hash text,
  p_destination_hash text, p_ip_hash text, p_expires_at timestamptz
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_id is null or p_user_id is null or p_channel not in ('sms', 'email')
    or p_secret_hash !~ '^[0-9a-f]{64}$' or p_destination_hash !~ '^[0-9a-f]{64}$'
    or p_ip_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now()
    or p_expires_at > now() + interval '15 minutes' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(2100, 2);
  if (select count(*) from public.password_recovery_challenges where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 10
    or (select count(*) from public.password_recovery_challenges where destination_hash = p_destination_hash and created_at > now() - interval '1 hour') >= 3
    or (select count(*) from public.password_recovery_challenges where user_id = p_user_id and created_at > now() - interval '1 hour') >= 3
    or exists (select 1 from public.password_recovery_challenges where user_id = p_user_id and channel = p_channel and created_at > now() - interval '60 seconds')
  then return false; end if;
  if p_channel = 'sms' and not public.reserve_sms_send('recovery_' || p_id::text, p_destination_hash) then return false; end if;
  update public.password_recovery_challenges set consumed_at = now()
    where user_id = p_user_id and consumed_at is null;
  insert into public.password_recovery_challenges(id,user_id,channel,secret_hash,destination_hash,ip_hash,expires_at)
    values(p_id,p_user_id,p_channel,p_secret_hash,p_destination_hash,p_ip_hash,p_expires_at);
  return true;
end;
$$;
revoke all on function public.reserve_password_recovery(uuid,uuid,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_password_recovery(uuid,uuid,text,text,text,text,timestamptz) to service_role;

-- Verification is atomic and bounded to five attempts. A successful check
-- consumes the challenge and creates a separate, reset-only grant.
create table public.password_recovery_verification_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index password_recovery_verification_ip_time on public.password_recovery_verification_attempts(ip_hash, created_at desc);
alter table public.password_recovery_verification_attempts enable row level security;
revoke all on public.password_recovery_verification_attempts from public, anon, authenticated;

create function public.verify_password_recovery(
  p_id uuid, p_secret_hash text, p_grant_hash text, p_ip_hash text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_challenge public.password_recovery_challenges%rowtype;
begin
  if p_id is null or p_secret_hash !~ '^[0-9a-f]{64}$' or p_grant_hash !~ '^[0-9a-f]{64}$'
    or p_ip_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 2102));
  if (select count(*) from public.password_recovery_verification_attempts
      where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 20 then return false; end if;
  insert into public.password_recovery_verification_attempts(ip_hash) values(p_ip_hash);
  select * into v_challenge from public.password_recovery_challenges where id = p_id for update;
  if not found or v_challenge.consumed_at is not null or v_challenge.expires_at <= now() or v_challenge.attempts >= 5 then return false; end if;
  update public.password_recovery_challenges set attempts = attempts + 1 where id = p_id;
  if v_challenge.secret_hash <> p_secret_hash then return false; end if;
  update public.password_recovery_challenges set consumed_at = now() where id = p_id;
  insert into public.password_recovery_grants(token_hash,user_id,challenge_id,expires_at)
    values(p_grant_hash,v_challenge.user_id,p_id,now() + interval '10 minutes');
  return true;
end;
$$;
revoke all on function public.verify_password_recovery(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.verify_password_recovery(uuid,text,text,text) to service_role;

create function public.claim_password_recovery_grant(p_grant_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  if p_grant_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  update public.password_recovery_grants set consumed_at = now()
    where token_hash = p_grant_hash and consumed_at is null and expires_at > now()
    returning user_id into v_user_id;
  return v_user_id;
end;
$$;
revoke all on function public.claim_password_recovery_grant(text) from public, anon, authenticated;
grant execute on function public.claim_password_recovery_grant(text) to service_role;

-- Any password change, including a staff/native Auth recovery, clears custom
-- grants. Session revocation needs the rollout gate documented separately.
create function public.invalidate_password_recovery_on_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    delete from public.password_recovery_grants where user_id = new.id;
    delete from public.password_recovery_challenges where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.invalidate_password_recovery_on_change() from public, anon, authenticated;
create trigger invalidate_password_recovery_on_change after update of encrypted_password on auth.users
  for each row execute function public.invalidate_password_recovery_on_change();
create function public.invalidate_password_recovery_on_identity_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.phone is distinct from old.phone or new.phone_confirmed_at is distinct from old.phone_confirmed_at
    or new.email is distinct from old.email or new.email_confirmed_at is distinct from old.email_confirmed_at then
    delete from public.password_recovery_grants where user_id = new.id;
    delete from public.password_recovery_challenges where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.invalidate_password_recovery_on_identity_change() from public, anon, authenticated;
create trigger invalidate_password_recovery_on_identity_change
  after update of phone,phone_confirmed_at,email,email_confirmed_at on auth.users
  for each row execute function public.invalidate_password_recovery_on_identity_change();

-- A service-side alias replacement must also cancel already issued grants.
create function public.invalidate_password_recovery_on_alias_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
  else
    if new.email_normalized is not distinct from old.email_normalized
       and new.phone_e164 is not distinct from old.phone_e164 then return new; end if;
    v_user_id := new.user_id;
  end if;
  delete from public.password_recovery_grants where user_id = v_user_id;
  delete from public.password_recovery_challenges where user_id = v_user_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.invalidate_password_recovery_on_alias_change() from public, anon, authenticated;
create trigger invalidate_password_recovery_on_alias_change
  after update or delete on public.customer_login_aliases
  for each row execute function public.invalidate_password_recovery_on_alias_change();

-- GoTrue sessions are removed after an administrative password update. Existing
-- stateless access JWTs still live until expiry; sensitive RLS/session checks
-- and JWT lifetime are a required rollout review.
create function public.revoke_password_recovery_sessions(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null then return false; end if;
  delete from auth.sessions where user_id = p_user_id;
  return true;
end;
$$;
revoke all on function public.revoke_password_recovery_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_password_recovery_sessions(uuid) to service_role;
commit;
