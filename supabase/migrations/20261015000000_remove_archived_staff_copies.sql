-- Remove archived profile copies while keeping profile-backed appointment history intact.
begin;

lock table public.staff_members in share row exclusive mode;

do $$
declare
  v_legacy_count bigint;
begin
  select count(*) into v_legacy_count
    from public.staff_members
   where record_kind = 'legacy';

  if v_legacy_count not in (0, 4) then
    raise exception 'Unexpected archived staff count; expected four copies or an already-clean roster';
  end if;

  if exists (
    select 1
      from public.staff_members m
      join public.appointments a on a.staff_member_id = m.id
     where m.record_kind = 'legacy'
  ) then
    raise exception 'Archived staff records still have direct appointment references';
  end if;

  if exists (
    select 1
      from public.staff_members m
      left join public.profiles p on p.id = m.id
     where m.record_kind = 'legacy'
       and (
         m.is_active
         or m.is_bookable
         or p.id is null
         or m.full_name is distinct from
           coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Legacy team member')
       )
  ) then
    raise exception 'Archived staff identity does not match its preserved profile';
  end if;
end
$$;

-- Keep new roster ratings and profile-backed historical ratings under the same
-- public identity while resolving each assignment through its actual source.
create or replace view public.published_staff_aggregates as
select coalesce(a.staff_member_id, a.staff_id) as staff_id,
       coalesce(
         m.full_name,
         nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
         'Legacy team member'
       ) as display_name,
       round(avg(r.staff_rating)::numeric, 1) as average_rating,
       count(r.staff_rating)::bigint as rating_count
  from public.appointments a
  left join public.staff_members m on m.id = a.staff_member_id
  left join public.profiles p on p.id = a.staff_id
  left join public.reviews r
    on r.appointment_id = a.id and r.is_published and r.staff_rating is not null
 where coalesce(a.staff_member_id, a.staff_id) is not null
 group by coalesce(a.staff_member_id, a.staff_id),
          coalesce(
            m.full_name,
            nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
            'Legacy team member'
          );
revoke all on public.published_staff_aggregates from public, anon, authenticated;

create or replace function public.get_staff_rating_aggregates()
returns table(staff_id uuid, display_name text, average_rating numeric, rating_count bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  return query
  with assignment_sources as (
    select m.id as staff_id, m.full_name as display_name, a.id as appointment_id
      from public.staff_members m
      left join public.appointments a on a.staff_member_id = m.id
    union all
    select p.id as staff_id,
           coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Legacy team member') as display_name,
           a.id as appointment_id
      from public.profiles p
      join public.appointments a on a.staff_id = p.id
     where not exists (
       select 1 from public.staff_members m where m.id = p.id
     )
  )
  select source.staff_id,
         source.display_name,
         coalesce(round(avg(r.staff_rating)::numeric, 1), 0),
         count(r.staff_rating)::bigint
    from assignment_sources source
    left join public.reviews r
      on r.appointment_id = source.appointment_id
     and r.is_published and r.staff_rating is not null
   group by source.staff_id, source.display_name
   order by source.display_name, source.staff_id;
end;
$$;
revoke all on function public.get_staff_rating_aggregates() from public;
grant execute on function public.get_staff_rating_aggregates() to authenticated;

create or replace function public.get_my_appointment_staff()
returns table (appointment_id uuid, staff_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role = 'customer' and p.is_active
  ) then
    raise exception 'Only active customer accounts can view appointment staff'
      using errcode = '42501';
  end if;
  return query
  select a.id,
         coalesce(a.staff_member_id, a.staff_id),
         coalesce(
           m.full_name,
           nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
           case when a.staff_id is not null then 'Legacy team member' end,
           'Unassigned'
         )
    from public.appointments a
    left join public.staff_members m on m.id = a.staff_member_id
    left join public.profiles p on p.id = a.staff_id
   where a.customer_id = auth.uid();
end;
$$;
revoke all on function public.get_my_appointment_staff() from public;
grant execute on function public.get_my_appointment_staff() to authenticated;

delete from public.staff_members
 where record_kind = 'legacy';

commit;
