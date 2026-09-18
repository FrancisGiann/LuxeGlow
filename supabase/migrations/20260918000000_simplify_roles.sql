begin;

-- 1. Add 'head' to the app_role enum
alter type public.app_role add value if not exists 'head';

commit;

begin;

-- 2. Enforce at most one active Head
create unique index if not exists profiles_single_active_head
  on public.profiles ((true))
  where role = 'head' and is_active = true;

-- 3. Update is_staff() to include 'head'
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('head', 'admin') and is_active
  );
$$;

-- 4. Update prevent_customer_role_escalation() to allow admin to set 'head'
create or replace function public.prevent_customer_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Head may manage appointments/catalog content, but cannot promote
  -- themselves (or another member) to admin or head. The service role is used
  -- only by the audited import/invite boundaries.
  if old.role is distinct from new.role
     and not public.is_admin()
     and coalesce(auth.role(), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    new.role := old.role;
  end if;
  return new;
end;
$$;

-- 5. Update get_bookable_staff() to include deactivated roster members
drop function if exists public.get_bookable_staff();
create function public.get_bookable_staff()
returns table (
  id uuid,
  display_name text,
  position_title text,
  average_rating numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         coalesce(nullif(trim(p.first_name || ' ' || left(p.last_name, 1) || '.'), '.'), 'Team member'),
         p.position_title,
         coalesce(s.average_rating, 0),
         coalesce(s.rating_count, 0)
    from public.profiles p
    left join public.published_staff_aggregates s on s.staff_id = p.id
   where (p.role in ('head', 'admin') and p.is_active and p.accepts_appointments)
      or (p.role = 'customer' and p.is_active = false and p.accepts_appointments and p.position_title is not null)
   order by p.first_name, p.last_name, p.created_at, p.id;
$$;
revoke all on function public.get_bookable_staff() from public;
grant execute on function public.get_bookable_staff() to anon, authenticated;

-- Also update the constraint and trigger for position_title, as we're moving from 'staff' to 'head'
-- and allowing deactivated roster members (customer) to retain it.
alter table public.profiles drop constraint if exists profiles_position_title_check;
alter table public.profiles
  add constraint profiles_position_title_check
  check (
    position_title is null
    or (
      (role in ('head', 'admin') or (role = 'customer' and is_active = false))
      and char_length(position_title) between 1 and 100
      and position_title ~ '[^[:space:]]'
    )
  );

create or replace function public.protect_profile_position_title()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bypass boolean := coalesce(auth.role(), '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin');
begin
  if new.position_title is not null then
    new.position_title := nullif(
      btrim(regexp_replace(new.position_title, '[[:space:]]+', ' ', 'g')),
      ''
    );
  end if;

  if tg_op = 'UPDATE' then
    if new.position_title is distinct from old.position_title
       and not v_bypass
       and not public.is_admin() then
      raise exception 'Only administrators can change a staff position title'
        using errcode = '42501';
    end if;
  elsif new.position_title is not null
        and not v_bypass
        and not public.is_admin() then
    raise exception 'Only administrators can set a staff position title'
      using errcode = '42501';
  end if;

  if not (new.role in ('head', 'admin') or (new.role = 'customer' and new.is_active = false)) then
    new.position_title := null;
  end if;
  return new;
end;
$$;

commit;

begin;

-- Migrate existing staff to inactive customer role, retaining their appointments and roster presence.
update public.profiles
set role = 'customer',
    is_active = false
where role = 'staff';

-- Auth users will be disconnected naturally as their profile no longer grants staff access.
commit;
