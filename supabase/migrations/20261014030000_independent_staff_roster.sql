-- Independent, non-login team roster. Booking RPCs continue using profiles
-- until the coordinated booking cutover migration is deployed.
begin;

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  roster_key text not null unique,
  record_kind text not null check (record_kind in ('owner', 'staff', 'legacy')),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 201),
  position_title text,
  is_active boolean not null default true,
  is_bookable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_members_roster_key_check
    check (roster_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint staff_members_position_title_check
    check (position_title is null or char_length(btrim(position_title)) between 1 and 100),
  constraint staff_members_bookable_kind_check
    check (record_kind = 'staff' or not is_bookable)
);

create index if not exists staff_members_active_bookable_idx
  on public.staff_members (is_active, is_bookable, full_name)
  where record_kind = 'staff';

drop trigger if exists staff_members_touch_updated_at on public.staff_members;
create trigger staff_members_touch_updated_at
before update on public.staff_members
for each row execute function public.touch_updated_at();

alter table public.staff_members enable row level security;
revoke all on public.staff_members from public, anon, authenticated;
grant select, insert on public.staff_members to authenticated;
grant update (full_name, position_title, is_active, is_bookable)
  on public.staff_members to authenticated;

drop policy if exists staff_members_staff_read on public.staff_members;
create policy staff_members_staff_read on public.staff_members
  for select to authenticated
  using (public.is_staff());

drop policy if exists staff_members_admin_insert on public.staff_members;
create policy staff_members_admin_insert on public.staff_members
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists staff_members_admin_update on public.staff_members;
create policy staff_members_admin_update on public.staff_members
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Preserve old profile-backed identities for appointment and rating history.
-- These records are inactive and never bookable; appointments are not changed.
insert into public.staff_members
  (id, roster_key, record_kind, full_name, position_title, is_active, is_bookable)
select distinct on (p.id)
       p.id,
       'legacy-' || p.id::text,
       'legacy',
       coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Legacy team member'),
       nullif(btrim(regexp_replace(coalesce(p.position_title, ''), '[[:space:]]+', ' ', 'g')), ''),
       false,
       false
  from public.appointments a
  join public.profiles p on p.id = a.staff_id
 where a.staff_id is not null
 order by p.id, p.created_at
on conflict (id) do nothing;

-- These five records have no email, phone, role, Auth identity, or login.
insert into public.staff_members
  (roster_key, record_kind, full_name, is_active, is_bookable)
values
  ('owner-leth-s-alfabete', 'owner', 'Leth S. Alfabete', true, false),
  ('staff-jhona-hael-amparado', 'staff', 'Jhona Hael Amparado', true, true),
  ('staff-jen-reyes', 'staff', 'Jen Reyes', true, true),
  ('staff-adelia-pondaulda', 'staff', 'Adelia Pondaulda', true, true),
  ('staff-abcel-racal', 'staff', 'Abcel Racal', true, true)
on conflict (roster_key) do nothing;

commit;
