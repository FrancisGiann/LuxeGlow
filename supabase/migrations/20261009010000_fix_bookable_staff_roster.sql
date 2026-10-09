begin;

-- Deactivated legacy staff remain in the rating aggregates for historical
-- visits, but they are no longer valid candidates for booking or availability.
create or replace function public.get_bookable_staff()
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
   where p.role in ('head', 'admin')
     and p.is_active
     and p.accepts_appointments
   order by p.first_name, p.last_name, p.created_at, p.id;
$$;

revoke all on function public.get_bookable_staff() from public;
grant execute on function public.get_bookable_staff() to anon, authenticated;

commit;
