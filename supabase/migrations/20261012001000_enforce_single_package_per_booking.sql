begin;

-- One booking may contain at most one current catalog package. Lock the
-- selected catalog rows before reading their type, price, and duration so an
-- admin edit cannot race the validation and appointment-service snapshot.
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
  if p_date is null or p_time is null or p_date < (now() at time zone 'Asia/Manila')::date
     or p_date > ((now() at time zone 'Asia/Manila')::date + 60) then
    raise exception 'Date must be within the next 60 days';
  end if;
  if extract(second from p_time) <> 0 or extract(minute from p_time)::integer % 30 <> 0 then raise exception 'Choose a 30-minute slot'; end if;
  if p_service_ids is null or cardinality(p_service_ids) < 1 then raise exception 'Select at least one service'; end if;

  perform s.id
    from public.services s
   where s.id = any(p_service_ids)
   order by s.id
   for share;

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

revoke all on function public.book_appointment(text[], uuid, date, time) from public, anon;
grant execute on function public.book_appointment(text[], uuid, date, time) to authenticated;

commit;
