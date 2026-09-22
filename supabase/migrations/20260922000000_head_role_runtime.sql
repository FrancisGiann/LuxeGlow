begin;

create or replace function public.reconcile_expired_pending_appointments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_cancelled integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role
    into v_role
    from public.profiles p
   where p.id = v_user_id
     and p.is_active = true;

  if not found then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  update public.appointments
     set status = 'Cancelled'
   where status = 'Pending'
     and start_at < now() - interval '15 minutes'
     and (v_role in ('head', 'admin') or customer_id = v_user_id);
  get diagnostics v_cancelled = row_count;

  return v_cancelled;
end;
$$;

revoke all on function public.reconcile_expired_pending_appointments() from public, anon, service_role;
grant execute on function public.reconcile_expired_pending_appointments() to authenticated;

create or replace function public.enqueue_staff_booking_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT'
     or session_user in ('postgres', 'supabase_admin')
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  insert into public.staff_notifications(recipient_id, appointment_id, type, title, message)
  select p.id,
         new.id,
         'new_booking',
         'New appointment request',
         'New appointment request ' || new.reference_no || ' has been received.'
    from public.profiles p
   where p.role in ('head', 'admin')
     and p.is_active = true
  on conflict (recipient_id, appointment_id, type) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_staff_booking_notifications() from public;

create or replace view public.published_staff_aggregates as
select a.staff_id,
       coalesce(nullif(trim(p.first_name || ' ' || left(p.last_name, 1) || '.'), '.'), 'Team member') as display_name,
       round(avg(r.staff_rating)::numeric, 1) as average_rating,
       count(r.staff_rating)::bigint as rating_count
  from public.appointments a
  join public.profiles p on p.id = a.staff_id
  left join public.reviews r on r.appointment_id = a.id and r.is_published and r.staff_rating is not null
 where a.staff_id is not null
   and (
     (p.role in ('head', 'admin') and p.is_active)
     or (p.role = 'customer' and not p.is_active and p.position_title is not null)
   )
 group by a.staff_id, p.first_name, p.last_name;

revoke all on public.published_staff_aggregates from public, anon, authenticated;

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
   where (p.role in ('head', 'admin') and p.is_active)
      or (p.role = 'customer' and not p.is_active and p.position_title is not null)
   group by p.id, p.first_name, p.last_name
   order by 2, 1;
end;
$$;

revoke all on function public.get_staff_rating_aggregates() from public;
grant execute on function public.get_staff_rating_aggregates() to authenticated;

drop function if exists public.book_appointment(text[], date, time);
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
    if not exists (select 1 from public.profiles where id = p_staff_id and role in ('head', 'admin') and is_active and accepts_appointments) then raise exception 'Choose an available team member'; end if;
    v_staff_id := p_staff_id;
  else
    select candidates.id into v_staff_id
      from public.profiles candidates
     where candidates.role in ('head', 'admin') and candidates.is_active and candidates.accepts_appointments
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
  if p_staff_id is not null and not exists (select 1 from public.profiles where id = p_staff_id and role in ('head', 'admin') and is_active and accepts_appointments) then raise exception 'Choose an available team member'; end if;
  select h.open_time, h.close_time, h.is_closed into v_open, v_close, v_closed from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null or ((p_date + v_open) at time zone 'Asia/Manila') + make_interval(mins => p_duration_minutes) > ((p_date + v_close) at time zone 'Asia/Manila') then return; end if;
  return query
  with slots as (
    select generated_at::time as slot_time from generate_series(p_date + v_open, p_date + v_close - make_interval(mins => p_duration_minutes), interval '30 minutes') generated_at
  )
  select to_char(s.slot_time, 'HH12:MI AM'), case when p_staff_id is null then exists (
    select 1 from public.profiles p where p.role in ('head', 'admin') and p.is_active and p.accepts_appointments and not exists (
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

commit;
