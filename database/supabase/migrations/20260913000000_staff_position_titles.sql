-- Optional, administrator-managed staff titles. Public clients receive only
-- this title alongside the existing abbreviated name and published ratings.
begin;

alter table public.profiles
  add column if not exists position_title text;

do $$
begin
  alter table public.profiles
    add constraint profiles_position_title_check
    check (
      position_title is null
      or (
        role in ('staff', 'admin')
        and char_length(position_title) between 1 and 100
        and position_title ~ '[^[:space:]]'
      )
    );
exception when duplicate_object then null;
end $$;

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

  if new.role not in ('staff', 'admin') then
    new.position_title := null;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_position_title() from public;

-- Run after the existing role-protection triggers, so a staff member cannot
-- bypass this check by submitting a role change and a title change together.
drop trigger if exists profiles_z_position_title_guard on public.profiles;
create trigger profiles_z_position_title_guard
before insert or update on public.profiles
for each row execute function public.protect_profile_position_title();

-- PostgreSQL cannot change a table-returning function's result type with
-- CREATE OR REPLACE, so recreate it and restore its public execute grants.
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
   where p.role in ('staff', 'admin') and p.is_active and p.accepts_appointments
   order by p.first_name, p.last_name, p.created_at, p.id;
$$;

revoke all on function public.get_bookable_staff() from public;
grant execute on function public.get_bookable_staff() to anon, authenticated;

commit;
