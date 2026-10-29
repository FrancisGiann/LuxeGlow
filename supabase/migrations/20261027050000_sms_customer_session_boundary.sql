-- Staged Auth boundary for new SMS customers. Configure the Custom Access
-- Token Hook only after this migration and direct Auth tests succeed.
begin;

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
        and u.phone_confirmed_at is not null and u.phone = a.phone_e164
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
revoke all on function public.sms_customer_access_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.sms_customer_access_token_hook(jsonb) to supabase_auth_admin;

create or replace function public.customer_password_session_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"password"}]'::jsonb
    and exists (select 1 from auth.sessions s
      where s.user_id = auth.uid() and s.id::text = auth.jwt()->>'session_id');
$$;
revoke all on function public.customer_password_session_allowed() from public, anon, authenticated;
grant execute on function public.customer_password_session_allowed() to authenticated;

create or replace function public.has_sms_customer_alias()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.customer_login_aliases a where a.user_id = auth.uid());
$$;
revoke all on function public.has_sms_customer_alias() from public, anon, authenticated;
grant execute on function public.has_sms_customer_alias() to authenticated;

create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.is_active
      and (p.role <> 'customer' or
        u.created_at < (select started_at from public.sms_customer_rollout where singleton) or
        (u.phone_confirmed_at is not null and u.phone ~ '^\+639[0-9]{9}$' and
          exists (select 1 from public.customer_login_aliases a where a.user_id = u.id
                  and a.phone_e164 = u.phone) and
          public.customer_password_session_allowed()))
  );
$$;
revoke all on function public.is_active_account() from public, anon, authenticated;
grant execute on function public.is_active_account() to authenticated;

-- Do not let the brief signup OTP session read an activated customer's
-- profile after the alias is claimed. Staff and pre-rollout users are unchanged.
drop policy if exists sms_customer_profile_read on public.profiles;
create policy sms_customer_profile_read on public.profiles
  as restrictive for select to authenticated
  using (not public.has_sms_customer_alias()
    or public.customer_password_session_allowed());

drop policy if exists sms_customer_reschedule_requests on public.appointment_reschedule_requests;
create policy sms_customer_reschedule_requests on public.appointment_reschedule_requests
  as restrictive for all to authenticated
  using (public.is_active_account()) with check (public.is_active_account());

commit;
