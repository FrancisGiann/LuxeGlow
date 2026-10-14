-- Switch booking and staff ratings to independent, non-login roster IDs.
-- Old profile-backed appointments retain their original staff_id and block
-- new capacity globally until those active reservations resolve.
begin;

-- Capture assignments created after the additive roster migration but before
-- this cutover. The id is retained so published ratings and history stay put.
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

alter table public.appointments
  add column if not exists staff_member_id uuid
  references public.staff_members(id) on delete restrict;

alter table public.appointments
  drop constraint if exists appointments_staff_assignment_xor_check;
alter table public.appointments
  add constraint appointments_staff_assignment_xor_check
  check (staff_id is null or staff_member_id is null);

create index if not exists appointments_staff_member_date_idx
  on public.appointments (staff_member_id, local_date, local_time);

alter table public.appointments
  drop constraint if exists appointments_staff_member_no_overlap;
do $$
begin
  alter table public.appointments
    add constraint appointments_staff_member_no_overlap
    exclude using gist (staff_member_id with =, booking_range with &&)
    where (staff_member_id is not null and status in ('Pending', 'Confirmed'));
exception when duplicate_object then null;
end $$;

create or replace function public.protect_appointment_staff_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bypass boolean := coalesce(auth.role(), '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin');
begin
  if v_bypass or current_setting('app.allow_staff_assignment', true) = 'true' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.staff_id is not null or new.staff_member_id is not null then
      raise exception 'Staff assignment must be set through the booking workflow'
        using errcode = '42501';
    end if;
  elsif old.staff_id is distinct from new.staff_id
     or old.staff_member_id is distinct from new.staff_member_id then
    raise exception 'Staff assignment is immutable outside the booking workflow'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_appointment_staff_assignment() from public;
drop trigger if exists appointments_protect_staff_assignment on public.appointments;
create trigger appointments_protect_staff_assignment
before insert or update on public.appointments
for each row execute function public.protect_appointment_staff_assignment();

-- Every assigned UUID now resolves to a roster record. The old profile table
-- remains untouched and continues to back login accounts and notifications.
create or replace view public.published_staff_aggregates as
select coalesce(a.staff_member_id, a.staff_id) as staff_id,
       m.full_name as display_name,
       round(avg(r.staff_rating)::numeric, 1) as average_rating,
       count(r.staff_rating)::bigint as rating_count
  from public.appointments a
  join public.staff_members m on m.id = coalesce(a.staff_member_id, a.staff_id)
  left join public.reviews r
    on r.appointment_id = a.id and r.is_published and r.staff_rating is not null
 where coalesce(a.staff_member_id, a.staff_id) is not null
 group by coalesce(a.staff_member_id, a.staff_id), m.full_name;
revoke all on public.published_staff_aggregates from public, anon, authenticated;

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
  select m.id,
         m.full_name,
         m.position_title,
         coalesce(s.average_rating, 0),
         coalesce(s.rating_count, 0)
    from public.staff_members m
    left join public.published_staff_aggregates s on s.staff_id = m.id
   where m.record_kind = 'staff' and m.is_active and m.is_bookable
   order by m.full_name, m.id;
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
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  return query
  select m.id,
         m.full_name,
         coalesce(round(avg(r.staff_rating)::numeric, 1), 0),
         count(r.staff_rating)::bigint
    from public.staff_members m
    left join public.appointments a
      on coalesce(a.staff_member_id, a.staff_id) = m.id
    left join public.reviews r
      on r.appointment_id = a.id and r.is_published and r.staff_rating is not null
   group by m.id, m.full_name
   order by m.full_name, m.id;
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
         coalesce(m.full_name, 'Unassigned')
    from public.appointments a
    left join public.staff_members m on m.id = coalesce(a.staff_member_id, a.staff_id)
   where a.customer_id = auth.uid();
end;
$$;
revoke all on function public.get_my_appointment_staff() from public;
grant execute on function public.get_my_appointment_staff() to authenticated;

create or replace function public.book_appointment(
  p_service_ids text[], p_staff_id uuid, p_date date, p_time time
)
returns table(appointment_id uuid, reference_no text, total_price numeric,
  total_duration_minutes integer, assigned_staff_id uuid, assigned_staff_name text)
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
  v_package_count integer;
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
  if p_date is null or p_time is null
     or p_date < (now() at time zone 'Asia/Manila')::date
     or p_date > ((now() at time zone 'Asia/Manila')::date + 60) then
    raise exception 'Date must be within the next 60 days';
  end if;
  if extract(second from p_time) <> 0 or extract(minute from p_time)::integer % 30 <> 0 then
    raise exception 'Choose a 30-minute slot';
  end if;
  if p_service_ids is null or cardinality(p_service_ids) < 1 then raise exception 'Select at least one service'; end if;

  perform s.id from public.services s
   where s.id = any(p_service_ids) order by s.id for share;
  select count(*), coalesce(sum(price), 0), coalesce(sum(duration_minutes), 0),
         count(*) filter (where item_type = 'package')
    into v_service_count, v_total, v_duration, v_package_count
    from public.services where id = any(p_service_ids) and is_active;
  if v_service_count <> cardinality(p_service_ids) then raise exception 'One or more services are unavailable'; end if;
  if v_package_count > 1 then raise exception 'Only one package can be selected per booking'; end if;
  if v_duration > 600 then raise exception 'The selected services exceed the daily booking limit'; end if;

  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  select h.open_time, h.close_time, h.is_closed into v_open, v_close, v_closed
    from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null then raise exception 'Salon is closed on that date'; end if;
  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  if p_time < v_open or v_start + make_interval(mins => v_duration)
       > ((p_date + v_close) at time zone 'Asia/Manila') then
    raise exception 'The selected services do not fit within salon hours';
  end if;
  if v_start < now() then raise exception 'That time has already passed'; end if;

  perform pg_advisory_xact_lock(hashtextextended('booking-date:' || p_date::text, 19071990));
  if p_staff_id is not null then
    perform 1 from public.staff_members m
     where m.id = p_staff_id and m.record_kind = 'staff'
       and m.is_active and m.is_bookable
     for share;
    if not found then raise exception 'Choose an available team member'; end if;
    v_staff_id := p_staff_id;
  else
    select candidates.id into v_staff_id
      from public.staff_members candidates
     where candidates.record_kind = 'staff'
       and candidates.is_active and candidates.is_bookable
       and not exists (
         select 1 from public.appointments a
          where a.status in ('Pending', 'Confirmed')
            and (a.staff_member_id = candidates.id or a.staff_member_id is null)
            and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_duration), '[)')
       )
     order by
       (select coalesce(sum(extract(epoch from (upper(a.booking_range) - lower(a.booking_range))) / 60), 0)
          from public.appointments a where a.staff_member_id = candidates.id
            and a.local_date = p_date and a.status in ('Pending', 'Confirmed')) asc,
       (select count(*) from public.appointments a where a.staff_member_id = candidates.id
          and a.local_date = p_date and a.status in ('Pending', 'Confirmed')) asc,
       candidates.id asc
     limit 1
     for share of candidates;
    if v_staff_id is null then raise exception 'That time is no longer available' using errcode = '23P01'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_staff_id::text || ':' || p_date::text, 19071990));
  if exists (
    select 1 from public.appointments a
     where a.status in ('Pending', 'Confirmed')
       and (a.staff_member_id = v_staff_id or a.staff_member_id is null)
       and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_duration), '[)')
  ) then raise exception 'That time is no longer available' using errcode = '23P01'; end if;
  select m.full_name into v_staff_name from public.staff_members m where m.id = v_staff_id;
  perform set_config('app.allow_staff_assignment', 'true', true);
  loop
    v_reference := 'LX-' || to_char(p_date, 'YYYYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.appointments
      (reference_no, customer_id, staff_member_id, local_date, local_time,
       start_at, total_duration_minutes, total_price)
    values (v_reference, v_user, v_staff_id, p_date, p_time, v_start, v_duration, v_total)
    on conflict on constraint appointments_reference_no_key do nothing
    returning id into v_appointment_id;
    exit when v_appointment_id is not null;
  end loop;
  insert into public.appointment_services(appointment_id, service_id, service_name, unit_price, duration_minutes)
    select v_appointment_id, id, name, price, duration_minutes
      from public.services where id = any(p_service_ids) and is_active;
  return query select v_appointment_id, v_reference, v_total, v_duration, v_staff_id, v_staff_name;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;
revoke all on function public.book_appointment(text[], uuid, date, time) from public, anon;
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
  if p_date is null or p_date < (now() at time zone 'Asia/Manila')::date
     or p_date > ((now() at time zone 'Asia/Manila')::date + 60) then
    raise exception 'Date must be within the next 60 days';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 1 or p_duration_minutes > 600 then
    raise exception 'Choose a valid appointment duration';
  end if;
  if p_staff_id is not null and not exists (
    select 1 from public.staff_members m where m.id = p_staff_id
      and m.record_kind = 'staff' and m.is_active and m.is_bookable
  ) then raise exception 'Choose an available team member'; end if;
  select h.open_time, h.close_time, h.is_closed into v_open, v_close, v_closed
    from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null
     or ((p_date + v_open) at time zone 'Asia/Manila') + make_interval(mins => p_duration_minutes)
          > ((p_date + v_close) at time zone 'Asia/Manila') then
    return;
  end if;
  return query
  with slots as (
    select generated_at::time as slot_time
      from generate_series(p_date + v_open, p_date + v_close - make_interval(mins => p_duration_minutes), interval '30 minutes') generated_at
  )
  select to_char(s.slot_time, 'HH12:MI AM'),
         case when p_staff_id is null then exists (
           select 1 from public.staff_members m
            where m.record_kind = 'staff' and m.is_active and m.is_bookable
              and not exists (
                select 1 from public.appointments a
                 where a.status in ('Pending', 'Confirmed')
                   and (a.staff_member_id = m.id or a.staff_member_id is null)
                   and a.booking_range && tstzrange(
                     (p_date + s.slot_time) at time zone 'Asia/Manila',
                     ((p_date + s.slot_time) at time zone 'Asia/Manila') + make_interval(mins => p_duration_minutes), '[)')
              )
         ) else not exists (
           select 1 from public.appointments a
            where a.status in ('Pending', 'Confirmed')
              and (a.staff_member_id = p_staff_id or a.staff_member_id is null)
              and a.booking_range && tstzrange(
                (p_date + s.slot_time) at time zone 'Asia/Manila',
                ((p_date + s.slot_time) at time zone 'Asia/Manila') + make_interval(mins => p_duration_minutes), '[)')
         ) end
    from slots s
   where (p_date + s.slot_time) at time zone 'Asia/Manila' >= now()
   order by s.slot_time;
end;
$$;
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
  v_reset_no_show_review boolean := false;
begin
  if not public.is_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
  if p_date is null or p_time is null
     or p_date < (now() at time zone 'Asia/Manila')::date
     or p_date > ((now() at time zone 'Asia/Manila')::date + 60)
     or extract(second from p_time) <> 0
     or extract(minute from p_time)::integer % 30 <> 0 then
    raise exception 'Choose a valid future 30-minute slot';
  end if;
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found or v_appointment.status in ('Completed', 'Cancelled') then
    raise exception 'That appointment cannot be rescheduled';
  end if;
  if v_appointment.arrived_at is not null then
    raise exception 'An appointment marked arrived cannot be rescheduled' using errcode = '55000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  select h.open_time, h.close_time, h.is_closed into v_open, v_close, v_closed
    from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null then raise exception 'Salon is closed on that date'; end if;
  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  if p_time < v_open or v_start + make_interval(mins => v_appointment.total_duration_minutes)
       > ((p_date + v_close) at time zone 'Asia/Manila') then
    raise exception 'The appointment does not fit within salon hours';
  end if;
  if v_start < now() then raise exception 'That time has already passed'; end if;
  perform pg_advisory_xact_lock(hashtextextended('booking-date:' || p_date::text, 19071990));
  if v_appointment.staff_member_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_appointment.staff_member_id::text || ':' || p_date::text, 19071990));
  elsif v_appointment.staff_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_appointment.staff_id::text || ':' || p_date::text, 19071990));
  end if;
  if exists (
    select 1 from public.appointments a
     where a.id <> v_appointment.id and a.status in ('Pending', 'Confirmed')
       and (v_appointment.staff_member_id is null
         or a.staff_member_id = v_appointment.staff_member_id
         or a.staff_member_id is null)
       and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_appointment.total_duration_minutes), '[)')
  ) then raise exception 'That time is no longer available' using errcode = '23P01'; end if;
  v_reset_no_show_review := v_appointment.no_show_reviewed_at is not null
    and (v_appointment.local_date is distinct from p_date or v_appointment.local_time is distinct from p_time);
  if v_reset_no_show_review then perform set_config('app.allow_no_show_review', 'true', true); end if;
  perform set_config('app.allow_appointment_reschedule', 'true', true);
  update public.appointments
     set local_date = p_date, local_time = p_time, start_at = v_start,
         no_show_reviewed_at = case when v_reset_no_show_review then null else no_show_reviewed_at end
   where id = v_appointment.id returning * into v_appointment;
  return v_appointment;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;
revoke all on function public.reschedule_appointment(uuid, date, time) from public;
grant execute on function public.reschedule_appointment(uuid, date, time) to authenticated;

create or replace function public.customer_reschedule_appointment(
  p_appointment_id uuid, p_date date, p_time time, p_reason text
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_appointment public.appointments;
  v_start timestamptz;
  v_open time;
  v_close time;
  v_closed boolean;
  v_reason text := regexp_replace(coalesce(p_reason, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_now timestamptz := clock_timestamp();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user and p.role = 'customer' and p.is_active) then
    raise exception 'Active customer access required' using errcode = '42501';
  end if;
  if p_appointment_id is null then raise exception 'Appointment is required' using errcode = '22023'; end if;
  if char_length(v_reason) not between 1 and 500 then
    raise exception 'Enter a rescheduling reason between 1 and 500 characters';
  end if;
  if p_date is null or p_time is null
     or p_date < (v_now at time zone 'Asia/Manila')::date
     or p_date > ((v_now at time zone 'Asia/Manila')::date + 60)
     or extract(second from p_time) <> 0
     or extract(minute from p_time)::integer % 30 <> 0 then
    raise exception 'Choose a valid date and 30-minute time within the next 60 days';
  end if;
  select * into v_appointment from public.appointments a
   where a.id = p_appointment_id and a.customer_id = v_user for update;
  if not found then raise exception 'Appointment not found' using errcode = 'P0002'; end if;
  v_now := clock_timestamp();
  if v_appointment.status not in ('Pending', 'Confirmed')
     or v_appointment.start_at <= v_now or v_appointment.arrived_at is not null then
    raise exception 'That appointment is no longer eligible for customer changes';
  end if;
  if p_date = v_appointment.local_date and p_time = v_appointment.local_time then
    raise exception 'Choose a different date or time';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  select h.open_time, h.close_time, h.is_closed into v_open, v_close, v_closed
    from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null then raise exception 'Salon is closed on that date'; end if;
  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  if p_time < v_open or v_start + make_interval(mins => v_appointment.total_duration_minutes)
       > ((p_date + v_close) at time zone 'Asia/Manila') then
    raise exception 'The appointment does not fit within salon hours';
  end if;
  if v_start <= v_now then raise exception 'That time has already passed'; end if;
  perform pg_advisory_xact_lock(hashtextextended('booking-date:' || p_date::text, 19071990));
  if v_appointment.staff_member_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_appointment.staff_member_id::text || ':' || p_date::text, 19071990));
  elsif v_appointment.staff_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_appointment.staff_id::text || ':' || p_date::text, 19071990));
  end if;
  if exists (
    select 1 from public.appointments a
     where a.id <> v_appointment.id and a.status in ('Pending', 'Confirmed')
       and (v_appointment.staff_member_id is null
         or a.staff_member_id = v_appointment.staff_member_id
         or a.staff_member_id is null)
       and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_appointment.total_duration_minutes), '[)')
  ) then raise exception 'That time is no longer available' using errcode = '23P01'; end if;
  perform set_config('app.allow_customer_appointment_action', 'true', true);
  perform set_config('app.allow_appointment_reschedule', 'true', true);
  update public.appointments
     set local_date = p_date,
         local_time = p_time,
         start_at = v_start,
         customer_reschedule_reason = v_reason,
         status = case when status = 'Confirmed' then 'Pending' else status end
   where id = v_appointment.id returning * into v_appointment;
  return v_appointment;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;
revoke all on function public.customer_reschedule_appointment(uuid, date, time, text) from public, anon, service_role;
grant execute on function public.customer_reschedule_appointment(uuid, date, time, text) to authenticated;

create or replace function public.protect_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bypass boolean := coalesce(auth.role(), '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin');
  v_admin boolean := false;
  v_completed boolean := false;
  v_staff_assigned boolean := false;
begin
  if tg_op = 'UPDATE' then
    if old.customer_id is distinct from new.customer_id then raise exception 'Review ownership is immutable'; end if;
    if old.appointment_id is distinct from new.appointment_id then raise exception 'Review appointment is immutable'; end if;
    if old.created_at is distinct from new.created_at then raise exception 'Review timestamp is immutable'; end if;
  end if;
  if not v_bypass then
    v_admin := public.is_admin();
    select exists (
      select 1 from public.appointments a where a.id = new.appointment_id
        and a.customer_id = new.customer_id and a.status = 'Completed'
    ), exists (
      select 1 from public.appointments a where a.id = new.appointment_id
        and coalesce(a.staff_member_id, a.staff_id) is not null
    ) into v_completed, v_staff_assigned;
    if (tg_op = 'INSERT' or not v_admin) and new.customer_id is distinct from auth.uid() then
      raise exception 'Review ownership is invalid' using errcode = '42501';
    end if;
    if not v_completed then raise exception 'Only completed visits can be reviewed' using errcode = '42501'; end if;
    if tg_op = 'INSERT' or not v_admin then
      if not v_staff_assigned and new.staff_rating is not null then
        raise exception 'Staff rating requires an assigned team member';
      end if;
    elsif new.staff_rating is distinct from old.staff_rating
       and not v_staff_assigned and new.staff_rating is not null then
      raise exception 'Staff rating requires an assigned team member';
    end if;
    if tg_op = 'INSERT' and not v_admin then new.is_published := false; end if;
  end if;
  if not v_admin and not v_bypass and tg_op = 'UPDATE' then
    if new.rating is distinct from old.rating
       or new.staff_rating is distinct from old.staff_rating
       or new.review_text is distinct from old.review_text then
      new.is_published := false;
    else
      new.is_published := old.is_published;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_review_fields() from public;
drop trigger if exists reviews_protect_fields on public.reviews;
create trigger reviews_protect_fields before insert or update on public.reviews
for each row execute function public.protect_review_fields();

comment on column public.reviews.staff_rating is
  'Optional separate 1–5 rating for an assigned roster member';
comment on column public.appointments.staff_id is
  'Legacy profile assignment retained for appointment and rating history';
comment on column public.appointments.staff_member_id is
  'Assigned independent staff roster record for new bookings';

commit;
