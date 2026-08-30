-- Persist the staff-selected homepage preview without changing legacy service
-- rows. A trigger serializes additions and refuses the seventh selection.

begin;

do $$
declare
  curation_column_existed boolean;
begin
  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'services'
       and column_name = 'is_homepage_featured'
  ) into curation_column_existed;

  if not curation_column_existed then
    alter table public.services
      add column is_homepage_featured boolean default false;

    -- Preserve the pre-migration category-balanced homepage preview on the
    -- first rollout. Re-running this migration never resets staff choices.
    with ordered as (
      select id, category, display_order, name,
             row_number() over (
               partition by category
               order by (image_path is null), display_order, name, id
             ) as category_rank,
             min(display_order) over (partition by category) as category_order
        from public.services
       where is_active
    ), selected as (
      select id
        from ordered
       where category_rank = 1
       order by category_order, display_order, name, id
       limit 6
    )
    update public.services service
       set is_homepage_featured = true
      from selected
     where service.id = selected.id;
  end if;
end $$;

update public.services
   set is_homepage_featured = false
 where is_homepage_featured is null
    or (not is_active and is_homepage_featured);

alter table public.services
  alter column is_homepage_featured set default false,
  alter column is_homepage_featured set not null;

comment on column public.services.is_homepage_featured is
  'Staff-selected homepage preview membership; at most six rows may be true.';

create index if not exists services_homepage_featured_idx
  on public.services(is_homepage_featured)
  where is_homepage_featured;

create or replace function public.enforce_homepage_service_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- A hidden service cannot occupy a homepage slot. Clearing it here keeps
  -- deactivation and slot release atomic for every write path.
  if not new.is_active then
    new.is_homepage_featured := false;
  end if;

  if new.is_homepage_featured
     and (tg_op = 'INSERT' or not old.is_homepage_featured) then
    -- Every add checks the same transaction-scoped mutex before counting.
    -- This prevents concurrent staff updates from both observing six or fewer
    -- rows and committing a seventh selection.
    perform pg_advisory_xact_lock(hashtextextended('public.services.homepage_featured', 0));
    if not exists (
      select 1
        from public.services
       where id = new.id
         and is_homepage_featured
    ) and (
      select count(*) from public.services where is_homepage_featured
    ) >= 6 then
      raise exception using
        errcode = 'check_violation',
        message = 'At most 6 services may be featured on the homepage.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists services_homepage_featured_limit on public.services;
create trigger services_homepage_featured_limit
  before insert or update of is_homepage_featured, is_active on public.services
  for each row execute function public.enforce_homepage_service_limit();

-- 03000 intentionally removed broad browser writes to service metadata. Add
-- only the curation column back for the existing staff RLS policy; inserts
-- continue to use the false default and cannot claim a homepage slot.
grant update (is_homepage_featured) on public.services to authenticated;

commit;
