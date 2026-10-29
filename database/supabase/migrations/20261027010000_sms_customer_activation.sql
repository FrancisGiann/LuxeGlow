-- Staged SMS customer activation. Do not apply before the Edge gateway, Auth
-- Send SMS hook, and direct-API security tests are reviewed together.
begin;

create table if not exists public.sms_customer_rollout (
  singleton boolean primary key default true check (singleton),
  started_at timestamptz not null default now()
);
insert into public.sms_customer_rollout (singleton) values (true)
on conflict (singleton) do nothing;
alter table public.sms_customer_rollout enable row level security;
revoke all on public.sms_customer_rollout from public, anon, authenticated;

-- An alias proves no inbox ownership. Only a later Auth email confirmation does.
create table if not exists public.customer_login_aliases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_normalized text not null unique,
  phone_e164 text not null,
  created_at timestamptz not null default now(),
  email_verified_at timestamptz,
  constraint alias_email_format check (email_normalized = lower(trim(email_normalized)) and
    char_length(email_normalized) <= 254 and email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint alias_phone_format check (phone_e164 ~ '^\+639[0-9]{9}$')
);
alter table public.customer_login_aliases enable row level security;
revoke all on public.customer_login_aliases from public, anon, authenticated;
grant select, insert, update on public.customer_login_aliases to service_role;

create table if not exists public.sms_send_claims (
  hook_id text primary key,
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists sms_send_claims_phone_time_idx on public.sms_send_claims(phone_hash, created_at);
create index if not exists sms_send_claims_time_idx on public.sms_send_claims(created_at);
alter table public.sms_send_claims enable row level security;
revoke all on public.sms_send_claims from public, anon, authenticated;

create or replace function public.reserve_sms_send(p_hook_id text, p_phone_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_hook_id is null or char_length(p_hook_id) > 128 or p_hook_id !~ '^[A-Za-z0-9_-]+$'
     or p_phone_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  -- A global lock makes the daily cap exact under concurrent signup bursts.
  perform pg_catalog.pg_advisory_xact_lock(2100, 1);
  if exists (select 1 from public.sms_send_claims where hook_id = p_hook_id) or
     (select count(*) from public.sms_send_claims where created_at > now() - interval '1 day') >= 10 or
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

create or replace function public.prevent_customer_identity_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    new.email := old.email;
    new.legacy_customer_id := old.legacy_customer_id;
    new.legacy_staff_id := old.legacy_staff_id;
    new.username := old.username;
    if old.role = 'customer' and exists
      (select 1 from public.customer_login_aliases a where a.user_id = old.id) then
      new.phone := old.phone;
    end if;
    if not public.is_admin() and new.is_active then
      new.is_active := old.is_active;
    end if;
  end if;
  -- Several older customer SECURITY DEFINER RPCs check is_active directly.
  -- Keep that column itself false unless the new customer's current Auth
  -- phone is confirmed and bound to the claimed alias, even for an admin edit.
  if new.role = 'customer' and exists (
    select 1 from auth.users u join public.sms_customer_rollout r on r.singleton
     where u.id = new.id and u.created_at >= r.started_at and
       (u.phone_confirmed_at is null or u.phone !~ '^\+639[0-9]{9}$' or
        not exists (select 1 from public.customer_login_aliases a
                    where a.user_id = u.id and a.phone_e164 = u.phone))
  ) then
    new.is_active := false;
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_customer_identity_changes() from public, anon, authenticated;

-- Supabase phone signup has no auth.users.email. Keep the email typed in the
-- form as an unverified profile contact/alias; email delivery is gated below.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(nullif(new.email, ''), new.raw_user_meta_data ->> 'pending_login_email', '')));
  v_sms_signup boolean;
begin
  if v_email = '' or char_length(v_email) > 254 then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;
  select exists (select 1 from public.sms_customer_rollout r where r.singleton and new.created_at >= r.started_at)
    into v_sms_signup;
  insert into public.profiles (id, email, first_name, last_name, phone, is_active)
  values (new.id, v_email,
    left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 100),
    left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 100),
    left(nullif(trim(coalesce(new.phone, new.raw_user_meta_data ->> 'phone', '')), ''), 50),
    not v_sms_signup)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Reserve aliases after Auth confirms the phone. The service-role Edge
-- function supplies the bearer-verified user ID; a direct client cannot call.
create or replace function public.claim_customer_login_alias(p_user_id uuid, p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user auth.users%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_email = '' or char_length(v_email) > 254 or
     v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 2100));
  select * into v_user from auth.users where id = p_user_id for update;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found or v_user.id is null or
     (v_user.email is not null and lower(v_user.email) <> v_email) or
     v_user.phone_confirmed_at is null or v_user.phone !~ '^\+639[0-9]{9}$' or
     v_profile.role <> 'customer' or lower(trim(v_profile.email)) <> v_email or
     not exists (select 1 from public.sms_customer_rollout r
                  where r.singleton and v_user.created_at >= r.started_at) or
     exists (select 1 from auth.users u where lower(u.email) = v_email and u.id <> p_user_id) then
    return false;
  end if;
  insert into public.customer_login_aliases(user_id,email_normalized,phone_e164)
  values (p_user_id,v_email,v_user.phone)
  on conflict (user_id) do update set phone_e164 = excluded.phone_e164
    where public.customer_login_aliases.email_normalized = excluded.email_normalized;
  if not found then return false; end if;
  update public.profiles set is_active = true where id = p_user_id;
  return true;
exception when unique_violation then
  return false;
end;
$$;
revoke all on function public.claim_customer_login_alias(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_customer_login_alias(uuid,text) to service_role;

-- Prevent a direct email Auth signup/change from colliding with a reserved
-- alias. The owner may later attach that same address via email confirmation.
create or replace function public.prevent_auth_email_alias_collision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(new.email), 2100));
  end if;
  if new.email is not null and exists (
    select 1 from public.customer_login_aliases a
    where a.email_normalized = lower(new.email) and a.user_id <> new.id
  ) then raise exception 'Email address unavailable' using errcode = '23505'; end if;
  return new;
end;
$$;
drop trigger if exists auth_email_alias_collision on auth.users;
create trigger auth_email_alias_collision before insert or update of email on auth.users
for each row execute function public.prevent_auth_email_alias_collision();

-- Keep the verified alias and the Auth email state separate until the inbox
-- confirmation event. This trigger also preserves existing welcome semantics.
create or replace function public.mark_customer_alias_email_verified()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.customer_login_aliases a set email_verified_at = new.email_confirmed_at
      where a.user_id = new.id and a.email_normalized = lower(new.email);
  end if;
  return new;
end;
$$;
drop trigger if exists customer_alias_email_verified on auth.users;
create trigger customer_alias_email_verified after update of email_confirmed_at on auth.users
for each row execute function public.mark_customer_alias_email_verified();

-- If Auth changes a phone, immediately suspend new SMS customers until the
-- same alias is rebound to the newly confirmed number by the service function.
create or replace function public.suspend_changed_customer_phone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (old.phone is distinct from new.phone or old.phone_confirmed_at is distinct from new.phone_confirmed_at)
     and exists (select 1 from public.customer_login_aliases a where a.user_id = new.id
                 and (a.phone_e164 is distinct from new.phone or new.phone_confirmed_at is null)) then
    update public.profiles set is_active = false where id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists customer_phone_changed on auth.users;
create trigger customer_phone_changed after update of phone, phone_confirmed_at on auth.users
for each row execute function public.suspend_changed_customer_phone();

-- Removing or rebinding an alias must also close older RPC paths that trust
-- profiles.is_active. A new claim can reactivate after current phone proof.
create or replace function public.suspend_customer_on_alias_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.email_normalized is not distinct from old.email_normalized
     and new.phone_e164 is not distinct from old.phone_e164 then return new; end if;
  update public.profiles set is_active = false where id = old.user_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists customer_alias_changed on public.customer_login_aliases;
create trigger customer_alias_changed after update or delete on public.customer_login_aliases
for each row execute function public.suspend_customer_on_alias_change();

-- The original inactive-account policy already covers owned tables. Strengthen
-- its helper so a direct Auth token cannot bypass SMS via profile edits.
create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.is_active
      and (p.role <> 'customer' or
        u.created_at < (select started_at from public.sms_customer_rollout where singleton) or
        (u.phone_confirmed_at is not null and u.phone ~ '^\+639[0-9]{9}$' and
          exists (select 1 from public.customer_login_aliases a where a.user_id = u.id
                  and a.phone_e164 = u.phone)))
  );
$$;
revoke all on function public.is_active_account() from public, anon, authenticated;
grant execute on function public.is_active_account() to authenticated;

-- New, unverified addresses must not receive notification mail. Keep the
-- existing future-only/idempotent welcome claim and SMTP handoff unchanged.
create or replace function public.claim_notification_outbox(p_limit integer default 25)
returns setof public.notification_outbox language sql security definer set search_path = public as $$
  update public.notification_outbox n set claimed_at = now(), attempts = attempts + 1
   where n.id in (
     select q.id from public.notification_outbox q
     join public.profiles p on p.id = q.recipient_id
     join auth.users u on u.id = q.recipient_id
     where q.sent_at is null and q.available_at <= now()
       and (q.kind <> 'welcome' or q.welcome_delivery_started_at is null)
       and (q.claimed_at is null or q.claimed_at < now() - interval '10 minutes')
       and (u.created_at < (select started_at from public.sms_customer_rollout where singleton)
         or p.role <> 'customer' or
         (u.email_confirmed_at is not null and exists (
           select 1 from public.customer_login_aliases a where a.user_id = u.id
             and a.email_normalized = lower(u.email)
             and a.email_normalized = lower(p.email)
             and a.email_verified_at is not null)))
     order by q.id for update of q skip locked limit least(greatest(coalesce(p_limit,25),1),100)
   ) returning n.*;
$$;
revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;

commit;
