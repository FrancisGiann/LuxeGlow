-- Configurable salon schedule, privacy-safe availability, deterministic
-- staff assignment, and separate visit/staff ratings.
-- All wall-clock values are Asia/Manila local time.

begin;

create table if not exists public.salon_weekly_hours (
  day_of_week smallint primary key,
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint salon_weekly_hours_day_check check (day_of_week between 1 and 7),
  constraint salon_weekly_hours_window_check check (
    (is_closed and open_time is null and close_time is null)
    or (not is_closed and open_time is not null and close_time is not null and close_time > open_time)
  )
);

insert into public.salon_weekly_hours(day_of_week, open_time, close_time, is_closed)
values
  (1, time '10:00', time '20:00', false),
  (2, time '10:00', time '20:00', false),
  (3, time '10:00', time '20:00', false),
  (4, time '10:00', time '20:00', false),
  (5, time '10:00', time '20:00', false),
  (6, time '10:00', time '20:00', false),
  (7, time '11:00', time '18:00', false)
on conflict (day_of_week) do nothing;

create table if not exists public.salon_closures (
  closure_date date primary key,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_closures_reason_length check (reason is null or char_length(reason) <= 500)
);

alter table public.reviews add column if not exists staff_rating integer;
do $$
begin
  alter table public.reviews add constraint reviews_staff_rating_check
    check (staff_rating is null or staff_rating between 1 and 5);
exception when duplicate_object then null;
end $$;

create index if not exists salon_closures_date_idx on public.salon_closures(closure_date);
create index if not exists reviews_staff_rating_idx on public.reviews(is_published, staff_rating)
  where staff_rating is not null;

-- A small internal helper keeps every booking/reschedule/availability path on
-- the same weekly-hours and full-day-closure rules.
-- Appointment validation and schedule mutation share this transaction lock so
-- a schedule cannot change between a final hours check and the appointment write.
create or replace function public.salon_hours_for_date(p_date date)
returns table(open_time time, close_time time, is_closed boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select w.open_time, w.close_time,
         (w.is_closed or c.closure_date is not null) as is_closed
    from public.salon_weekly_hours w
    left join public.salon_closures c on c.closure_date = p_date
   where w.day_of_week = extract(isodow from p_date)::smallint;
$$;

revoke all on function public.salon_hours_for_date(date) from public;

create or replace function public.get_salon_schedule()
returns table(day_of_week smallint, open_time time, close_time time, is_closed boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select day_of_week, open_time, close_time, is_closed
    from public.salon_weekly_hours
   order by day_of_week;
$$;

revoke all on function public.get_salon_schedule() from public;
grant execute on function public.get_salon_schedule() to anon, authenticated;

create or replace function public.get_salon_closures(p_from date, p_to date)
returns table(closure_date date, reason text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 370 then
    raise exception 'Choose a valid closure date range';
  end if;
  return query
    select c.closure_date, c.reason
      from public.salon_closures c
     where c.closure_date between p_from and p_to
     order by c.closure_date;
end;
$$;

revoke all on function public.get_salon_closures(date, date) from public;
grant execute on function public.get_salon_closures(date, date) to anon, authenticated;

create or replace function public.save_salon_hours(
  p_day_of_week smallint,
  p_open_time time,
  p_close_time time,
  p_is_closed boolean
)
returns public.salon_weekly_hours
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.salon_weekly_hours;
begin
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  if p_day_of_week is null or p_day_of_week not between 1 and 7 then
    raise exception 'Choose a valid day';
  end if;
  if p_is_closed is null then
    raise exception 'Choose whether this day is closed';
  end if;
  if p_is_closed and (p_open_time is not null or p_close_time is not null) then
    raise exception 'A closed day cannot have opening hours';
  end if;
  if not p_is_closed and (p_open_time is null or p_close_time is null or p_close_time <= p_open_time) then
    raise exception 'Closing time must be after opening time';
  end if;
  if not p_is_closed and (extract(second from p_open_time) <> 0 or extract(second from p_close_time) <> 0 or extract(minute from p_open_time)::integer % 30 <> 0 or extract(minute from p_close_time)::integer % 30 <> 0) then
    raise exception 'Opening hours must use 30-minute increments';
  end if;
  insert into public.salon_weekly_hours(day_of_week, open_time, close_time, is_closed, updated_at)
  values (p_day_of_week, case when p_is_closed then null else p_open_time end,
          case when p_is_closed then null else p_close_time end, p_is_closed, now())
  on conflict (day_of_week) do update
    set open_time = excluded.open_time, close_time = excluded.close_time,
        is_closed = excluded.is_closed, updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.save_salon_hours(smallint, time, time, boolean) from public;
grant execute on function public.save_salon_hours(smallint, time, time, boolean) to authenticated;

create or replace function public.save_salon_closure(p_closure_date date, p_reason text default null)
returns public.salon_closures
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.salon_closures;
begin
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  if p_closure_date is null or p_closure_date < (now() at time zone 'Asia/Manila')::date then
    raise exception 'Closures must be today or in the future';
  end if;
  if p_reason is not null and char_length(trim(p_reason)) > 500 then
    raise exception 'Closure reason is too long';
  end if;
  insert into public.salon_closures(closure_date, reason, updated_at)
  values (p_closure_date, nullif(trim(p_reason), ''), now())
  on conflict (closure_date) do update set reason = excluded.reason, updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.save_salon_closure(date, text) from public;
grant execute on function public.save_salon_closure(date, text) to authenticated;

create or replace function public.delete_salon_closure(p_closure_date date)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  if p_closure_date is null then raise exception 'Choose a closure date'; end if;
  delete from public.salon_closures where closure_date = p_closure_date;
  return found;
end;
$$;

revoke all on function public.delete_salon_closure(date) from public;
grant execute on function public.delete_salon_closure(date) to authenticated;

-- Existing active appointments are never rewritten when hours change. Staff
-- can query these references after saving a schedule and contact customers.
create or replace function public.get_schedule_conflicts(p_from date default null, p_to date default null)
returns table(reference_no text, local_date date, local_time time, status text, reason text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
  p_from := coalesce(p_from, (now() at time zone 'Asia/Manila')::date);
  p_to := coalesce(p_to, p_from + 370);
  if p_from > p_to or p_to - p_from > 370 then raise exception 'Choose a valid conflict range'; end if;
  return query
  select a.reference_no, a.local_date, a.local_time, a.status,
         case when c.closure_date is not null then 'Full-day closure'
              when h.is_closed then 'Weekly closure'
              when h.open_time is null or h.close_time is null then 'No opening hours'
              when a.start_at + make_interval(mins => a.total_duration_minutes)
                   > ((a.local_date + h.close_time) at time zone 'Asia/Manila') then 'Appointment ends after closing time'
              when a.local_time < h.open_time then 'Appointment starts before opening time'
              else 'Schedule conflict' end
    from public.appointments a
    left join public.salon_weekly_hours h on h.day_of_week = extract(isodow from a.local_date)::smallint
    left join public.salon_closures c on c.closure_date = a.local_date
   where a.status in ('Pending', 'Confirmed')
     and a.local_date between p_from and p_to
     and (c.closure_date is not null or h.is_closed or h.open_time is null or h.close_time is null
          or a.local_time < h.open_time
          or a.start_at + make_interval(mins => a.total_duration_minutes)
             > ((a.local_date + h.close_time) at time zone 'Asia/Manila'))
   order by a.local_date, a.local_time, a.reference_no;
end;
$$;

revoke all on function public.get_schedule_conflicts(date, date) from public;
grant execute on function public.get_schedule_conflicts(date, date) to authenticated;

-- Rating data is append-once per completed appointment. The trigger protects
-- direct table writes in addition to RLS and prevents rating another visit.
create or replace function public.protect_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bypass boolean := coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin');
  v_admin boolean := false;
  v_completed boolean := false;
  v_staff_assigned boolean := false;
begin
  if tg_op = 'UPDATE' then
    if old.customer_id is distinct from new.customer_id then
      raise exception 'Review ownership is immutable';
    end if;
    if old.appointment_id is distinct from new.appointment_id then
      raise exception 'Review appointment is immutable';
    end if;
    if old.created_at is distinct from new.created_at then
      raise exception 'Review timestamp is immutable';
    end if;
  end if;
  if not v_bypass then
    v_admin := public.is_admin();
    select exists (
      select 1 from public.appointments a
       where a.id = new.appointment_id and a.customer_id = new.customer_id and a.status = 'Completed'
    ), exists (
      select 1 from public.appointments a where a.id = new.appointment_id and a.staff_id is not null
    ) into v_completed, v_staff_assigned;
    if (tg_op = 'INSERT' or not v_admin) and new.customer_id is distinct from auth.uid() then
      raise exception 'Review ownership is invalid' using errcode = '42501';
    end if;
    if not v_completed then
      raise exception 'Only completed visits can be reviewed' using errcode = '42501';
    end if;
    -- Moderators may publish legacy reviews whose staff_rating predates this
    -- migration, but every new customer review (and every rating edit) must
    -- match the appointment's assignment state.
    if tg_op = 'INSERT' or not v_admin then
      if v_staff_assigned and new.staff_rating is null then
        raise exception 'Staff rating is required for an assigned team member';
      elsif not v_staff_assigned and new.staff_rating is not null then
        raise exception 'Staff rating requires an assigned team member';
      end if;
    elsif new.staff_rating is distinct from old.staff_rating then
      if v_staff_assigned and new.staff_rating is null then
        raise exception 'Staff rating is required for an assigned team member';
      elsif not v_staff_assigned and new.staff_rating is not null then
        raise exception 'Staff rating requires an assigned team member';
      end if;
    end if;
  end if;
  if not v_admin and not v_bypass and tg_op = 'UPDATE' then
    new.is_published := old.is_published;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_review_fields() from public;
drop trigger if exists reviews_protect_fields on public.reviews;
create trigger reviews_protect_fields before insert or update on public.reviews
for each row execute function public.protect_review_fields();

-- Staff can inspect reviews but only administrators may moderate or otherwise
-- manage review rows. Customer insert/update remains governed by the owner
-- policies above and the trigger's immutable-field checks.
drop policy if exists reviews_staff_manage on public.reviews;
create policy reviews_staff_manage on public.reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace view public.published_staff_aggregates as
select a.staff_id,
       coalesce(nullif(trim(p.first_name || ' ' || left(p.last_name, 1) || '.'), '.'), 'Team member') as display_name,
       round(avg(r.staff_rating)::numeric, 1) as average_rating,
       count(r.staff_rating)::bigint as rating_count
  from public.appointments a
  join public.profiles p on p.id = a.staff_id
  left join public.reviews r on r.appointment_id = a.id and r.is_published and r.staff_rating is not null
 where a.staff_id is not null and p.role in ('staff', 'admin') and p.is_active
 group by a.staff_id, p.first_name, p.last_name;

revoke all on public.published_staff_aggregates from public, anon, authenticated;

drop function if exists public.get_bookable_staff();
create or replace function public.get_bookable_staff()
returns table(id uuid, display_name text, average_rating numeric, rating_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         coalesce(nullif(trim(p.first_name || ' ' || left(p.last_name, 1) || '.'), '.'), 'Team member'),
         coalesce(s.average_rating, 0), coalesce(s.rating_count, 0)
    from public.profiles p
    left join public.published_staff_aggregates s on s.staff_id = p.id
   where p.role in ('staff', 'admin') and p.is_active and p.accepts_appointments
   order by p.first_name, p.last_name, p.created_at, p.id;
$$;

revoke all on function public.get_bookable_staff() from public;
grant execute on function public.get_bookable_staff() to anon, authenticated;

create or replace function public.get_staff_rating_aggregates()
returns table(staff_id uuid, display_name text, average_rating numeric, rating_count bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
  return query
  select p.id,
         coalesce(nullif(trim(p.first_name || ' ' || left(p.last_name, 1) || '.'), '.'), 'Team member'),
         coalesce(round(avg(r.staff_rating)::numeric, 1), 0),
         count(r.staff_rating)::bigint
    from public.profiles p
    left join public.appointments a on a.staff_id = p.id
    left join public.reviews r on r.appointment_id = a.id and r.is_published and r.staff_rating is not null
   where p.role in ('staff', 'admin')
   group by p.id, p.first_name, p.last_name
   order by 2, 1;
end;
$$;

revoke all on function public.get_staff_rating_aggregates() from public;
grant execute on function public.get_staff_rating_aggregates() to authenticated;

-- Replace the previous staff-scoped RPCs. NULL means “no preference”; the
-- selected staff is chosen under the date lock by load (minutes), count, id.
drop function if exists public.book_appointment(text[], date, time);
drop function if exists public.book_appointment(text[], uuid, date, time);
create or replace function public.book_appointment(
  p_service_ids text[], p_staff_id uuid, p_date date, p_time time
)
returns table(appointment_id uuid, reference_no text, total_price numeric, total_duration_minutes integer, assigned_staff_id uuid, assigned_staff_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_appointment_id uuid;
  v_reference text;
  v_total numeric(10,2);
  v_duration integer;
  v_service_count integer;
  v_start timestamptz;
  v_open time;
  v_close time;
  v_staff_id uuid;
  v_staff_name text;
  v_closed boolean;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_user and role = 'customer' and is_active) then
    raise exception 'Only active customer accounts can book' using errcode = '42501';
  end if;
  if p_date is null or p_time is null or p_date < (now() at time zone 'Asia/Manila')::date
     or p_date > ((now() at time zone 'Asia/Manila')::date + 60) then
    raise exception 'Date must be within the next 60 days';
  end if;
  if extract(second from p_time) <> 0 or extract(minute from p_time)::integer % 30 <> 0 then raise exception 'Choose a 30-minute slot'; end if;
  if p_service_ids is null or cardinality(p_service_ids) < 1 then raise exception 'Select at least one service'; end if;
  select count(*), coalesce(sum(price), 0), coalesce(sum(duration_minutes), 0)
    into v_service_count, v_total, v_duration
    from public.services where id = any(p_service_ids) and is_active;
  if v_service_count <> cardinality(p_service_ids) then raise exception 'One or more services are unavailable'; end if;
  if v_duration > 600 then raise exception 'The selected services exceed the daily booking limit'; end if;

  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  select h.open_time, h.close_time, h.is_closed into v_open, v_close, v_closed
    from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null then raise exception 'Salon is closed on that date'; end if;
  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  if p_time < v_open or v_start + make_interval(mins => v_duration) > ((p_date + v_close) at time zone 'Asia/Manila') then
    raise exception 'The selected services do not fit within salon hours';
  end if;
  if v_start < now() then raise exception 'That time has already passed'; end if;

  perform pg_advisory_xact_lock(hashtextextended('booking-date:' || p_date::text, 19071990));
  if p_staff_id is not null then
    if not exists (select 1 from public.profiles where id = p_staff_id and role in ('staff', 'admin') and is_active and accepts_appointments) then raise exception 'Choose an available team member'; end if;
    v_staff_id := p_staff_id;
  else
    select candidates.id into v_staff_id
      from public.profiles candidates
     where candidates.role in ('staff', 'admin') and candidates.is_active and candidates.accepts_appointments
       and not exists (
         select 1 from public.appointments a where a.status in ('Pending', 'Confirmed')
           and (a.staff_id = candidates.id or a.staff_id is null)
           and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_duration), '[)'))
     order by
       (select coalesce(sum(extract(epoch from (upper(a.booking_range) - lower(a.booking_range))) / 60), 0)
          from public.appointments a where a.staff_id = candidates.id and a.local_date = p_date and a.status in ('Pending', 'Confirmed')) asc,
       (select count(*) from public.appointments a where a.staff_id = candidates.id and a.local_date = p_date and a.status in ('Pending', 'Confirmed')) asc,
       candidates.id asc
     limit 1;
    if v_staff_id is null then raise exception 'That time is no longer available' using errcode = '23P01'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_staff_id::text || ':' || p_date::text, 19071990));
  if exists (select 1 from public.appointments a where a.status in ('Pending', 'Confirmed') and (a.staff_id = v_staff_id or a.staff_id is null) and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_duration), '[)')) then
    raise exception 'That time is no longer available' using errcode = '23P01';
  end if;
  select coalesce(nullif(trim(first_name || ' ' || left(last_name, 1) || '.'), '.'), 'Team member') into v_staff_name from public.profiles where id = v_staff_id;
  loop
    v_reference := 'LX-' || to_char(p_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.appointments(reference_no, customer_id, staff_id, local_date, local_time, start_at, total_duration_minutes, total_price)
    values (v_reference, v_user, v_staff_id, p_date, p_time, v_start, v_duration, v_total)
    on conflict on constraint appointments_reference_no_key do nothing
    returning id into v_appointment_id;
    exit when v_appointment_id is not null;
  end loop;
  insert into public.appointment_services(appointment_id, service_id, service_name, unit_price, duration_minutes)
    select v_appointment_id, id, name, price, duration_minutes from public.services where id = any(p_service_ids) and is_active;
  return query select v_appointment_id, v_reference, v_total, v_duration, v_staff_id, v_staff_name;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;

revoke all on function public.book_appointment(text[], uuid, date, time) from public;
grant execute on function public.book_appointment(text[], uuid, date, time) to authenticated;

create or replace function public.get_available_slots(
  p_staff_id uuid, p_date date, p_duration_minutes integer
)
returns table(slot_time text, available boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_open time;
  v_close time;
  v_closed boolean;
begin
  if p_date is null or p_date < (now() at time zone 'Asia/Manila')::date or p_date > ((now() at time zone 'Asia/Manila')::date + 60) then raise exception 'Date must be within the next 60 days'; end if;
  if p_duration_minutes is null or p_duration_minutes < 1 or p_duration_minutes > 600 then raise exception 'Choose a valid appointment duration'; end if;
  if p_staff_id is not null and not exists (select 1 from public.profiles where id = p_staff_id and role in ('staff', 'admin') and is_active and accepts_appointments) then raise exception 'Choose an available team member'; end if;
  select h.open_time, h.close_time, h.is_closed into v_open, v_close, v_closed from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null or ((p_date + v_open) at time zone 'Asia/Manila') + make_interval(mins => p_duration_minutes) > ((p_date + v_close) at time zone 'Asia/Manila') then return; end if;
  return query
  with slots as (
    select generated_at::time as slot_time from generate_series(p_date + v_open, p_date + v_close - make_interval(mins => p_duration_minutes), interval '30 minutes') generated_at
  )
  select to_char(s.slot_time, 'HH12:MI AM'), case when p_staff_id is null then exists (
    select 1 from public.profiles p where p.role in ('staff', 'admin') and p.is_active and p.accepts_appointments and not exists (
      select 1 from public.appointments a where a.status in ('Pending', 'Confirmed') and (a.staff_id = p.id or a.staff_id is null) and a.booking_range && tstzrange((p_date + s.slot_time) at time zone 'Asia/Manila', ((p_date + s.slot_time) at time zone 'Asia/Manila') + make_interval(mins => p_duration_minutes), '[)')
    )
  ) else not exists (
    select 1 from public.appointments a where a.status in ('Pending', 'Confirmed') and (a.staff_id = p_staff_id or a.staff_id is null) and a.booking_range && tstzrange((p_date + s.slot_time) at time zone 'Asia/Manila', ((p_date + s.slot_time) at time zone 'Asia/Manila') + make_interval(mins => p_duration_minutes), '[)')
  ) end
  from slots s where (p_date + s.slot_time) at time zone 'Asia/Manila' >= now() order by s.slot_time;
end;
$$;

drop function if exists public.get_available_slots(date, integer);
revoke all on function public.get_available_slots(uuid, date, integer) from public;
grant execute on function public.get_available_slots(uuid, date, integer) to anon, authenticated;

create or replace function public.reschedule_appointment(p_appointment_id uuid, p_date date, p_time time)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appointment public.appointments;
  v_start timestamptz;
  v_open time;
  v_close time;
  v_closed boolean;
begin
  if not public.is_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
  if p_date is null or p_time is null or p_date < (now() at time zone 'Asia/Manila')::date or p_date > ((now() at time zone 'Asia/Manila')::date + 60) or extract(second from p_time) <> 0 or extract(minute from p_time)::integer % 30 <> 0 then raise exception 'Choose a valid future 30-minute slot'; end if;
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found or v_appointment.status in ('Completed', 'Cancelled') then raise exception 'That appointment cannot be rescheduled'; end if;
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  select h.open_time, h.close_time, h.is_closed into v_open, v_close, v_closed from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null then raise exception 'Salon is closed on that date'; end if;
  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  if p_time < v_open or v_start + make_interval(mins => v_appointment.total_duration_minutes) > ((p_date + v_close) at time zone 'Asia/Manila') then raise exception 'The appointment does not fit within salon hours'; end if;
  if v_start < now() then raise exception 'That time has already passed'; end if;
  perform pg_advisory_xact_lock(hashtextextended('booking-date:' || p_date::text, 19071990));
  if v_appointment.staff_id is null then
    if exists (select 1 from public.appointments a where a.id <> v_appointment.id and a.status in ('Pending', 'Confirmed') and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_appointment.total_duration_minutes), '[)')) then raise exception 'That time is no longer available' using errcode = '23P01'; end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(v_appointment.staff_id::text || ':' || p_date::text, 19071990));
    if exists (select 1 from public.appointments a where a.id <> v_appointment.id and a.status in ('Pending', 'Confirmed') and (a.staff_id = v_appointment.staff_id or a.staff_id is null) and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_appointment.total_duration_minutes), '[)')) then raise exception 'That time is no longer available' using errcode = '23P01'; end if;
  end if;
  perform set_config('app.allow_appointment_reschedule', 'true', true);
  update public.appointments set local_date = p_date, local_time = p_time, start_at = v_start where id = v_appointment.id returning * into v_appointment;
  return v_appointment;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;

revoke all on function public.reschedule_appointment(uuid, date, time) from public;
grant execute on function public.reschedule_appointment(uuid, date, time) to authenticated;

alter table public.salon_weekly_hours enable row level security;
alter table public.salon_closures enable row level security;
revoke all on public.salon_weekly_hours, public.salon_closures from anon, authenticated;
grant all on public.salon_weekly_hours, public.salon_closures to service_role;

drop policy if exists salon_weekly_hours_public_read on public.salon_weekly_hours;
drop policy if exists salon_weekly_hours_staff_write on public.salon_weekly_hours;
create policy salon_weekly_hours_staff_write on public.salon_weekly_hours for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists salon_closures_public_read on public.salon_closures;
drop policy if exists salon_closures_staff_write on public.salon_closures;
create policy salon_closures_staff_write on public.salon_closures for all to authenticated using (public.is_staff()) with check (public.is_staff());

comment on column public.reviews.staff_rating is 'Separate 1–5 assigned-staff rating; required for new reviews of assigned appointments and NULL for unassigned appointments';

commit;
