-- Staff-scoped appointment booking.
-- This is a forward migration. Existing unassigned appointments remain valid
-- legacy records and are treated as salon-wide blockers by booking RPCs.

begin;

alter table public.profiles
  add column if not exists accepts_appointments boolean not null default false;

-- Existing active staff are opted in. Administrators must be explicitly opted
-- in by an administrator, so this update intentionally excludes admin rows.
update public.profiles
   set accepts_appointments = true
 where role = 'staff' and is_active = true;

alter table public.appointments
  add column if not exists staff_id uuid references public.profiles(id) on delete set null;

-- Preserve NULL assignments on legacy appointments. Booking and rescheduling
-- RPCs treat those rows as salon-wide blockers because NULL is outside the
-- staff-scoped GiST exclusion key.

create index if not exists appointments_staff_date_idx
  on public.appointments(staff_id, local_date, local_time);

alter table public.appointments drop constraint if exists appointments_no_overlap;
do $$
begin
  alter table public.appointments add constraint appointments_staff_no_overlap
    exclude using gist (staff_id with =, booking_range with &&)
    where (staff_id is not null and status in ('Pending', 'Confirmed'));
exception when duplicate_object then null;
end $$;

-- Browser updates cannot opt profiles in/out. Only the existing admin
-- management boundary (or trusted service/import sessions) may do so.
create or replace function public.protect_appointment_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.accepts_appointments is distinct from new.accepts_appointments
     and session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.is_admin() then
    new.accepts_appointments := old.accepts_appointments;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_appointment_preferences() from public;
drop trigger if exists profiles_protect_appointment_preferences on public.profiles;
create trigger profiles_protect_appointment_preferences before update on public.profiles
for each row execute function public.protect_appointment_preferences();

-- Keep staff assignment immutable from direct browser updates. Future
-- assignment workflows must explicitly set their own trusted authorization.
create or replace function public.protect_appointment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role'
     and (old.customer_id is distinct from new.customer_id
     or old.reference_no is distinct from new.reference_no
     or old.staff_id is distinct from new.staff_id
     or old.total_duration_minutes is distinct from new.total_duration_minutes
     or old.total_price is distinct from new.total_price
     or old.legacy_appointment_id is distinct from new.legacy_appointment_id
     or old.created_at is distinct from new.created_at) then
    raise exception 'Appointment details are immutable';
  end if;
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role'
     and old.status in ('Completed', 'Cancelled') and old.status is distinct from new.status then
    raise exception 'A completed or cancelled appointment cannot be reopened';
  end if;
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role'
     and current_setting('app.allow_appointment_reschedule', true) is distinct from 'true'
     and (old.local_date is distinct from new.local_date
          or old.local_time is distinct from new.local_time
          or old.start_at is distinct from new.start_at) then
    raise exception 'Appointment time must be changed through the reschedule workflow';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_appointment_fields() from public;

create or replace function public.get_bookable_staff()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         coalesce(nullif(trim(p.first_name || ' ' || left(p.last_name, 1) || '.'), '.'), 'Team member')
    from public.profiles p
   where p.role in ('staff', 'admin')
     and p.is_active = true
     and p.accepts_appointments = true
   order by p.first_name, p.last_name, p.created_at, p.id;
$$;

revoke all on function public.get_bookable_staff() from public;
grant execute on function public.get_bookable_staff() to authenticated;

-- The customer dashboard gets names for only its own appointment IDs. This
-- avoids granting browser access to staff profile email/phone columns.
create or replace function public.get_my_appointment_staff()
returns table (appointment_id uuid, staff_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer' and p.is_active) then
    raise exception 'Only active customer accounts can view appointment staff' using errcode = '42501';
  end if;
  return query
  select a.id,
         a.staff_id,
         coalesce(nullif(trim(p.first_name || ' ' || left(p.last_name, 1) || '.'), '.'), 'Unassigned')
    from public.appointments a
    left join public.profiles p on p.id = a.staff_id
   where a.customer_id = auth.uid();
end;
$$;

revoke all on function public.get_my_appointment_staff() from public;
grant execute on function public.get_my_appointment_staff() to authenticated;

drop function if exists public.book_appointment(text[], date, time);
create or replace function public.book_appointment(
  p_service_ids text[],
  p_staff_id uuid,
  p_date date,
  p_time time
)
returns table (appointment_id uuid, reference_no text, total_price numeric, total_duration_minutes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_appointment_id uuid;
  v_reference text;
  v_total numeric(10,2);
  v_duration integer;
  v_service_count integer;
  v_start timestamptz;
  v_close_at timestamptz;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_user and role = 'customer' and is_active) then
    raise exception 'Only active customer accounts can book' using errcode = '42501';
  end if;
  if p_staff_id is null or not exists (
    select 1 from public.profiles
     where id = p_staff_id and role in ('staff', 'admin') and is_active and accepts_appointments
  ) then
    raise exception 'Choose an available team member';
  end if;
  if p_date is null or p_time is null or p_date < (now() at time zone 'Asia/Manila')::date
     or p_date > ((now() at time zone 'Asia/Manila')::date + 60) then
    raise exception 'Date must be within the next 60 days';
  end if;
  if extract(second from p_time) <> 0 or extract(minute from p_time)::integer % 30 <> 0 then
    raise exception 'Choose a 30-minute slot';
  end if;
  if extract(isodow from p_date) = 7 then
    if p_time < time '11:00' or p_time >= time '18:00' then raise exception 'Outside salon hours'; end if;
  elsif p_time < time '10:00' or p_time >= time '20:00' then
    raise exception 'Outside salon hours';
  end if;
  if p_service_ids is null or cardinality(p_service_ids) not between 1 and 8 then
    raise exception 'Select between one and eight services';
  end if;

  -- Serialize all attempts for one Manila date before the staff-scoped lock.
  -- The common lock keeps legacy NULL staff rows safe because NULL values are
  -- intentionally outside the GiST exclusion key.
  perform pg_advisory_xact_lock(hashtextextended('booking-date:' || p_date::text, 19071990));
  perform pg_advisory_xact_lock(hashtextextended(p_staff_id::text || ':' || p_date::text, 19071990));

  select count(*), coalesce(sum(price), 0), coalesce(sum(duration_minutes), 0)
    into v_service_count, v_total, v_duration
    from public.services
   where id = any(p_service_ids) and is_active;
  if v_service_count <> cardinality(p_service_ids) then raise exception 'One or more services are unavailable'; end if;
  if v_duration > 600 then raise exception 'The selected services exceed the daily booking limit'; end if;

  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  v_close_at := case when extract(isodow from p_date) = 7
    then (p_date + time '18:00') at time zone 'Asia/Manila'
    else (p_date + time '20:00') at time zone 'Asia/Manila'
  end;
  if v_start + make_interval(mins => v_duration) > v_close_at then
    if extract(isodow from p_date) = 7 then
      raise exception 'The selected services do not fit within Sunday hours';
    else
      raise exception 'The selected services do not fit within salon hours';
    end if;
  end if;
  if v_start < now() then raise exception 'That time has already passed'; end if;
  if exists (
    select 1 from public.appointments a
     where a.status in ('Pending', 'Confirmed')
       and (a.staff_id = p_staff_id or a.staff_id is null)
       and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_duration), '[)')
  ) then
    raise exception 'That time is no longer available' using errcode = '23P01';
  end if;

  loop
    v_reference := 'LX-' || to_char(p_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.appointments(reference_no, customer_id, staff_id, local_date, local_time, start_at, total_duration_minutes, total_price)
    values (v_reference, v_user, p_staff_id, p_date, p_time, v_start, v_duration, v_total)
    on conflict (reference_no) do nothing
    returning id into v_appointment_id;
    exit when v_appointment_id is not null;
  end loop;
  insert into public.appointment_services(appointment_id, service_id, service_name, unit_price, duration_minutes)
    select v_appointment_id, id, name, price, duration_minutes from public.services where id = any(p_service_ids) and is_active;
  return query select v_appointment_id, v_reference, v_total, v_duration;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;

revoke all on function public.book_appointment(text[], uuid, date, time) from public;
grant execute on function public.book_appointment(text[], uuid, date, time) to authenticated;

drop function if exists public.get_available_slots(date, integer);
create or replace function public.get_available_slots(
  p_staff_id uuid,
  p_date date,
  p_duration_minutes integer
)
returns table (slot_time text, available boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_open_at time;
  v_close_at time;
  v_duration integer := greatest(coalesce(p_duration_minutes, 0), 1);
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_staff_id is null or not exists (
    select 1 from public.profiles
     where id = p_staff_id and role in ('staff', 'admin') and is_active and accepts_appointments
  ) then
    raise exception 'Choose an available team member';
  end if;
  if p_date is null or p_date < (now() at time zone 'Asia/Manila')::date
     or p_date > ((now() at time zone 'Asia/Manila')::date + 60) then
    raise exception 'Date must be within the next 60 days';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 1 or p_duration_minutes > 600 then
    raise exception 'Choose a valid appointment duration';
  end if;
  v_open_at := case when extract(isodow from p_date) = 7 then time '11:00' else time '10:00' end;
  v_close_at := case when extract(isodow from p_date) = 7 then time '18:00' else time '20:00' end;
  return query
  with slots as (
    select generated_at::time as slot_time
      from generate_series(
        p_date + v_open_at,
        p_date + v_close_at - make_interval(mins => v_duration),
        interval '30 minutes'
      ) generated_at
  )
  select to_char(slots.slot_time, 'HH12:MI AM'), not exists (
    select 1 from public.appointments a
    where a.status in ('Pending', 'Confirmed')
      and (a.staff_id = p_staff_id or a.staff_id is null)
      and a.booking_range && tstzrange(
        (p_date + slots.slot_time) at time zone 'Asia/Manila',
        ((p_date + slots.slot_time) at time zone 'Asia/Manila') + make_interval(mins => v_duration), '[)'
      )
  )
  from slots
  where (p_date + slots.slot_time) at time zone 'Asia/Manila' >= now()
  order by slots.slot_time;
end;
$$;

revoke all on function public.get_available_slots(uuid, date, integer) from public;
grant execute on function public.get_available_slots(uuid, date, integer) to authenticated;

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_date date,
  p_time time
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments;
  v_start timestamptz;
  v_close_at timestamptz;
begin
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  if p_date is null or p_time is null or p_date < (now() at time zone 'Asia/Manila')::date
     or p_date > ((now() at time zone 'Asia/Manila')::date + 60)
     or extract(second from p_time) <> 0
     or extract(minute from p_time)::integer % 30 <> 0 then
    raise exception 'Choose a valid future 30-minute slot';
  end if;
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found or v_appointment.status in ('Completed', 'Cancelled') then
    raise exception 'That appointment cannot be rescheduled';
  end if;
  if (extract(isodow from p_date) = 7 and (p_time < time '11:00' or p_time >= time '18:00'))
     or (extract(isodow from p_date) <> 7 and (p_time < time '10:00' or p_time >= time '20:00')) then
    raise exception 'Outside salon hours';
  end if;
  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  v_close_at := case when extract(isodow from p_date) = 7
    then (p_date + time '18:00') at time zone 'Asia/Manila'
    else (p_date + time '20:00') at time zone 'Asia/Manila'
  end;
  if v_start + make_interval(mins => v_appointment.total_duration_minutes) > v_close_at then
    raise exception 'The appointment does not fit within salon hours';
  end if;
  if v_start < now() then raise exception 'That time has already passed'; end if;
  -- Use the same date-first lock order as customer bookings. This prevents a
  -- legacy unassigned reschedule from racing an assigned customer booking.
  perform pg_advisory_xact_lock(hashtextextended('booking-date:' || p_date::text, 19071990));
  if v_appointment.staff_id is null then
    perform pg_advisory_xact_lock(hashtextextended('unassigned:' || p_date::text, 19071990));
  else
    perform pg_advisory_xact_lock(hashtextextended(v_appointment.staff_id::text || ':' || p_date::text, 19071990));
  end if;
  if exists (
    select 1 from public.appointments a
     where a.id <> v_appointment.id and a.status in ('Pending', 'Confirmed')
       and (v_appointment.staff_id is null or a.staff_id = v_appointment.staff_id or a.staff_id is null)
       and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_appointment.total_duration_minutes), '[)')
  ) then
    raise exception 'That time is no longer available' using errcode = '23P01';
  end if;
  perform set_config('app.allow_appointment_reschedule', 'true', true);
  update public.appointments
     set local_date = p_date, local_time = p_time, start_at = v_start
   where id = v_appointment.id
   returning * into v_appointment;
  return v_appointment;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;

revoke all on function public.reschedule_appointment(uuid, date, time) from public;
grant execute on function public.reschedule_appointment(uuid, date, time) to authenticated;

-- Staff profile management remains admin-only for booking opt-in, while the
-- existing staff contact-management policies remain intact.
comment on column public.profiles.accepts_appointments is 'Whether this active staff/admin account may receive customer bookings';
comment on column public.appointments.staff_id is 'Assigned bookable team member; null is retained for legacy unassigned rows';

commit;
