-- Normalize Supabase Auth's stored 639… phones to canonical +639….
-- No auth.users rows or existing aliases are rewritten.
begin;
create or replace function public.ph_auth_phone_e164(p_phone text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_phone ~ '^\+639[0-9]{9}$' then p_phone
    when p_phone ~ '^639[0-9]{9}$' then '+' || p_phone
    else null
  end;
$$;
revoke all on function public.ph_auth_phone_e164(text) from public, anon, authenticated;

-- prevent_customer_identity_changes
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
       (u.phone_confirmed_at is null or public.ph_auth_phone_e164(u.phone) is null or
        not exists (select 1 from public.customer_login_aliases a
                    where a.user_id = u.id and a.phone_e164 = public.ph_auth_phone_e164(u.phone)))
  ) then
    new.is_active := false;
  end if;
  return new;
end;
$$;

-- claim_customer_login_alias
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
     v_user.phone_confirmed_at is null or public.ph_auth_phone_e164(v_user.phone) is null or
     v_profile.role <> 'customer' or lower(trim(v_profile.email)) <> v_email or
     not exists (select 1 from public.sms_customer_rollout r
                  where r.singleton and v_user.created_at >= r.started_at) or
     exists (select 1 from auth.users u where lower(u.email) = v_email and u.id <> p_user_id) then
    return false;
  end if;
  insert into public.customer_login_aliases(user_id,email_normalized,phone_e164)
  values (p_user_id,v_email,public.ph_auth_phone_e164(v_user.phone))
  on conflict (user_id) do update set phone_e164 = excluded.phone_e164
    where public.customer_login_aliases.email_normalized = excluded.email_normalized;
  if not found then return false; end if;
  update public.profiles set is_active = true where id = p_user_id;
  return true;
exception when unique_violation then
  return false;
end;
$$;

-- suspend_changed_customer_phone
create or replace function public.suspend_changed_customer_phone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (old.phone is distinct from new.phone or old.phone_confirmed_at is distinct from new.phone_confirmed_at)
     and exists (select 1 from public.customer_login_aliases a where a.user_id = new.id
                 and (a.phone_e164 is distinct from public.ph_auth_phone_e164(new.phone) or new.phone_confirmed_at is null)) then
    update public.profiles set is_active = false where id = new.id;
  end if;
  return new;
end;
$$;

-- sms_customer_access_token_hook
create or replace function public.sms_customer_access_token_hook(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (event->>'user_id')::uuid;
  v_method text := event->>'authentication_method';
  v_claims jsonb := event->'claims';
begin
  -- Preserve every existing email account and staff path. A signup phone OTP
  -- can issue a token before the alias is claimed, but that token cannot read
  -- the newly activated customer data under the RLS helper below.
  if exists (select 1 from public.customer_login_aliases a where a.user_id = v_user_id) then
    if not exists (
      select 1 from public.customer_login_aliases a
      join auth.users u on u.id = a.user_id
      join public.profiles p on p.id = a.user_id
      where a.user_id = v_user_id and p.role = 'customer' and p.is_active
        and u.phone_confirmed_at is not null and public.ph_auth_phone_e164(u.phone) = a.phone_e164
    ) then
      raise exception 'Authentication unavailable' using errcode = '42501';
    end if;
    if v_method = 'password' then
      return event;
    end if;
    if v_method = 'token_refresh' and
       coalesce(v_claims->'amr', '[]'::jsonb) @> '[{"method":"password"}]'::jsonb and
       exists (select 1 from auth.sessions s where s.user_id = v_user_id
         and s.id::text = v_claims->>'session_id') then
      return event;
    end if;
    -- Direct phone/email OTP, magic link, native recovery and invitation
    -- routes must not mint a customer access token after alias activation.
    raise exception 'Authentication unavailable' using errcode = '42501';
  end if;
  return event;
end;
$$;

-- is_active_account
create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.is_active
      and (p.role <> 'customer' or
        u.created_at < (select started_at from public.sms_customer_rollout where singleton) or
        (u.phone_confirmed_at is not null and public.ph_auth_phone_e164(u.phone) is not null and
          exists (select 1 from public.customer_login_aliases a where a.user_id = u.id
                  and a.phone_e164 = public.ph_auth_phone_e164(u.phone)) and
          public.customer_password_session_allowed()))
  );
$$;

commit;
