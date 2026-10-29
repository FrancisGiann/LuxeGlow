-- Recheck current password session inside customer SECURITY DEFINER RPCs.
-- auth.sessions deletion after a reset then closes these paths immediately.
begin;

-- get_my_appointment_staff
create or replace function public.get_my_appointment_staff()
returns table (appointment_id uuid, staff_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.has_sms_customer_alias() and not public.customer_password_session_allowed() then
    raise exception 'Active customer password session required' using errcode = '42501';
  end if;
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

-- book_appointment
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
  if public.has_sms_customer_alias() and not public.customer_password_session_allowed() then
    raise exception 'Active customer password session required' using errcode = '42501';
  end if;
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

-- customer_cancel_appointment
create or replace function public.customer_cancel_appointment(
  p_appointment_id uuid,
  p_reason text
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_appointment public.appointments;
  v_reason text := regexp_replace(coalesce(p_reason, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_now timestamptz := clock_timestamp();
begin
  if public.has_sms_customer_alias() and not public.customer_password_session_allowed() then
    raise exception 'Active customer password session required' using errcode = '42501';
  end if;
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user and p.role = 'customer' and p.is_active) then
    raise exception 'Active customer access required' using errcode = '42501';
  end if;
  if p_appointment_id is null then raise exception 'Appointment is required' using errcode = '22023'; end if;
  if char_length(v_reason) not between 1 and 500
     or regexp_replace(v_reason, '[[:space:]]', '', 'g') = '' then
    raise exception 'Enter a cancellation reason between 1 and 500 characters';
  end if;

  select * into v_appointment
    from public.appointments a
   where a.id = p_appointment_id and a.customer_id = v_user
   for update;
  if not found then raise exception 'Appointment not found' using errcode = 'P0002'; end if;
  v_now := clock_timestamp();
  if v_appointment.status not in ('Pending', 'Confirmed')
     or v_appointment.start_at <= v_now
     or v_appointment.arrived_at is not null then
    raise exception 'That appointment is no longer eligible for customer changes';
  end if;

  perform set_config('app.allow_customer_appointment_action', 'true', true);
  update public.appointments
     set status = 'Cancelled', cancellation_reason = v_reason, customer_cancellation_reason = v_reason
   where id = v_appointment.id
   returning * into v_appointment;
  perform set_config('app.allow_customer_appointment_action', 'false', true);
  return v_appointment;
end;
$$;

-- reconcile_expired_pending_appointments
create or replace function public.reconcile_expired_pending_appointments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_cancelled integer := 0;
  v_previous_marker text := current_setting('app.allow_expired_pending_reconciliation', true);
begin
  if public.has_sms_customer_alias() and not public.customer_password_session_allowed() then
    raise exception 'Active customer password session required' using errcode = '42501';
  end if;
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role into v_role
    from public.profiles p
   where p.id = v_user_id and p.is_active = true;
  if not found then raise exception 'Active profile required' using errcode = '42501'; end if;
  if v_role not in ('head', 'admin', 'customer') then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  perform set_config('app.allow_expired_pending_reconciliation', 'true', true);
  begin
    update public.appointments
       set status = 'Cancelled',
           cancellation_reason = 'Automatically cancelled because the appointment remained unconfirmed 15 minutes after its scheduled start.'
     where status = 'Pending'
       and start_at < clock_timestamp() - interval '15 minutes'
       and (v_role in ('head', 'admin') or customer_id = v_user_id);
    get diagnostics v_cancelled = row_count;
  exception when others then
    perform set_config('app.allow_expired_pending_reconciliation', coalesce(v_previous_marker, 'false'), true);
    raise;
  end;
  perform set_config('app.allow_expired_pending_reconciliation', coalesce(v_previous_marker, 'false'), true);
  return v_cancelled;
end;
$$;

-- request_appointment_reschedule
create or replace function public.request_appointment_reschedule(p_appointment_id uuid, p_date date, p_time time, p_reason text)
returns public.appointment_reschedule_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.appointments; r public.appointment_reschedule_requests; v_reason text := btrim(coalesce(p_reason,''));
begin
  if public.has_sms_customer_alias() and not public.customer_password_session_allowed() then
    raise exception 'Active customer password session required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer' and p.is_active) then
    raise exception 'Active customer access required' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 1 and 500 or regexp_replace(v_reason, '[[:space:]]', '', 'g') = '' then
    raise exception 'Enter a rescheduling reason between 1 and 500 characters' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule',19071990));
  select * into a from public.appointments where id = p_appointment_id and customer_id = auth.uid() for update;
  if not found then raise exception 'Appointment not found' using errcode = 'P0002'; end if;
  perform public.validate_reschedule_target(a.id,p_date,p_time);
  -- Retain every version. Approval always addresses a specific immutable ID.
  update public.appointment_reschedule_requests set status = 'superseded', resolved_at = clock_timestamp(), resolved_by = auth.uid(),
    resolution_reason = 'Replaced by a newer customer request.' where appointment_id = a.id and status = 'pending';
  insert into public.appointment_reschedule_requests(appointment_id,customer_id,original_start_at,original_status,
    original_staff_member_id,original_staff_id,original_duration_minutes,requested_date,requested_time,reason)
  values(a.id,a.customer_id,a.start_at,a.status,a.staff_member_id,a.staff_id,a.total_duration_minutes,p_date,p_time,v_reason) returning * into r;
  insert into public.user_notifications(customer_id,appointment_id,type,title,message)
  values(a.customer_id,a.id,'system','Reschedule request received','Your original appointment remains scheduled until the salon approves your requested change.');
  return r;
end;
$$;

-- get_reschedule_slots
create or replace function public.get_reschedule_slots(p_appointment_id uuid,p_date date)
returns table(slot_time text,available boolean) language plpgsql stable security definer set search_path = public, pg_temp as $$
declare a public.appointments; v_open time; v_close time; v_closed boolean; v_slot timestamp;
begin
  if public.has_sms_customer_alias() and not public.customer_password_session_allowed() then
    raise exception 'Active customer password session required' using errcode = '42501';
  end if;
  select * into a from public.appointments where id = p_appointment_id and customer_id = auth.uid();
  if not found or not exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer' and p.is_active) then
    raise exception 'Active appointment owner access required' using errcode = '42501';
  end if;
  if a.status not in ('Pending','Confirmed') or a.arrived_at is not null or a.start_at <= clock_timestamp() then
    raise exception 'This appointment is no longer eligible for a reschedule request' using errcode = '55000';
  end if;
  if p_date is null or p_date < (clock_timestamp() at time zone 'Asia/Manila')::date
    or p_date > (clock_timestamp() at time zone 'Asia/Manila')::date + 60 then
    raise exception 'Choose a date within the next 60 days' using errcode = '22023';
  end if;
  select h.open_time,h.close_time,h.is_closed into v_open,v_close,v_closed from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null then return; end if;
  for v_slot in select generate_series(p_date + v_open,p_date + v_close - make_interval(mins => a.total_duration_minutes),interval '30 minutes') loop
    begin
      perform public.validate_reschedule_target(a.id,p_date,v_slot::time);
      slot_time := to_char(v_slot,'HH12:MI AM'); available := true; return next;
    exception when exclusion_violation or sqlstate '22023' or sqlstate '55000' then
      null;
    end;
  end loop;
end;
$$;

commit;
