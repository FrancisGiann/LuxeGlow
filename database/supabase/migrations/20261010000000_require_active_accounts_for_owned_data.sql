begin;

-- Keep an inactive user's own profile readable so the client can discover the
-- revocation, while requiring active accounts for owned business data.
create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and p.is_active = true
  );
$$;

revoke all on function public.is_active_account() from public, anon, authenticated;
grant execute on function public.is_active_account() to authenticated;

-- Restrictive policies compose with the existing ownership/staff policies:
-- ownership and role checks still determine which rows an active user may
-- access, while this policy blocks every authenticated inactive account.
drop policy if exists active_account_appointments on public.appointments;
create policy active_account_appointments on public.appointments
  as restrictive for all to authenticated
  using (public.is_active_account())
  with check (public.is_active_account());

drop policy if exists active_account_appointment_services on public.appointment_services;
create policy active_account_appointment_services on public.appointment_services
  as restrictive for all to authenticated
  using (public.is_active_account())
  with check (public.is_active_account());

drop policy if exists active_account_user_notifications on public.user_notifications;
create policy active_account_user_notifications on public.user_notifications
  as restrictive for all to authenticated
  using (public.is_active_account())
  with check (public.is_active_account());

drop policy if exists active_account_reviews on public.reviews;
create policy active_account_reviews on public.reviews
  as restrictive for all to authenticated
  using (public.is_active_account())
  with check (public.is_active_account());

drop policy if exists active_account_profile_updates on public.profiles;
create policy active_account_profile_updates on public.profiles
  as restrictive for update to authenticated
  using (public.is_active_account())
  with check (public.is_active_account());

commit;
