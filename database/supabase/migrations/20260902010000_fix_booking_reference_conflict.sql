-- Fix booking reference conflict inference and allow any non-empty service list.
-- The named unique constraint avoids a collision with the function's
-- reference_no output column. This forward migration preserves the deployed
-- staff-scoped booking behavior while correcting the function body.
-- The initial schema's `reference_no text not null unique` declaration creates
-- the appointments_reference_no_key constraint targeted below.

begin;

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
  if p_service_ids is null or cardinality(p_service_ids) < 1 then
    raise exception 'Select at least one service';
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
    on conflict on constraint appointments_reference_no_key do nothing
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

commit;
