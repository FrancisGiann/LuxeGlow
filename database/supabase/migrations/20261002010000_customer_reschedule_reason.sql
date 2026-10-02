begin;

alter table public.appointments
  add column if not exists customer_reschedule_reason text;
alter table public.appointments
  drop constraint if exists appointments_customer_reschedule_reason_check;
alter table public.appointments
  add constraint appointments_customer_reschedule_reason_check
  check (
    customer_reschedule_reason is null
    or char_length(regexp_replace(customer_reschedule_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 500
  );

comment on column public.appointments.customer_reschedule_reason is
  'Latest reason supplied by the customer when requesting an appointment reschedule.';

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
     or old.total_duration_minutes is distinct from new.total_duration_minutes
     or old.total_price is distinct from new.total_price
     or old.legacy_appointment_id is distinct from new.legacy_appointment_id
     or old.created_at is distinct from new.created_at) then
    raise exception 'Appointment details are immutable';
  end if;
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role'
     and (old.customer_cancellation_reason is distinct from new.customer_cancellation_reason
       or old.customer_reschedule_reason is distinct from new.customer_reschedule_reason)
     and current_setting('app.allow_customer_appointment_action', true) is distinct from 'true' then
    raise exception 'Customer appointment reasons can only be saved through the customer appointment workflow';
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

create or replace function public.enqueue_appointment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_title text;
  v_message text;
  v_customer_reschedule boolean := false;
begin
  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_type := public.notification_for_status(new.status);
  elsif old.local_date is distinct from new.local_date
     or old.local_time is distinct from new.local_time then
    v_type := 'rescheduled';
    v_customer_reschedule := coalesce(current_setting('app.allow_customer_appointment_action', true), '') = 'true';
    -- Remove reminders for the prior schedule before they can be delivered.
    -- The maintenance worker uses the same lock before creating reminders.
    perform pg_advisory_xact_lock(hashtextextended('appointment-maintenance-reminders', 19071990));
    delete from public.notification_outbox
     where appointment_id = new.id and kind = 'reminder' and sent_at is null;
    update public.user_notifications
       set is_read = true
     where appointment_id = new.id and type = 'reminder' and not is_read;
  elsif old.status is distinct from new.status then
    v_type := public.notification_for_status(new.status);
  end if;
  if v_type is null then return new; end if;

  v_title := case v_type
    when 'pending' then 'Booking request received'
    when 'confirmed' then 'Appointment confirmed'
    when 'completed' then 'Thanks for visiting'
    when 'cancelled' then 'Appointment cancelled'
    else 'Appointment rescheduled'
  end;
  v_message := case v_type
    when 'pending' then 'Your appointment request ' || new.reference_no || ' is waiting for salon confirmation.'
    when 'confirmed' then 'Your appointment ' || new.reference_no || ' has been confirmed.'
    when 'completed' then 'Your visit ' || new.reference_no || ' is complete. We would love your feedback.'
    when 'cancelled' then 'Your appointment ' || new.reference_no || ' has been cancelled.'
      || case when new.customer_cancellation_reason is null then '' else ' Reason: ' || new.customer_cancellation_reason end
    when 'rescheduled' then case when v_customer_reschedule then
      'Your appointment ' || new.reference_no || ' has been rescheduled to '
        || to_char(new.local_date, 'FMMonth FMDD, YYYY') || ' at '
        || to_char(new.local_date + new.local_time, 'HH12:MI AM') || ' Manila time and is pending salon confirmation. Reason: '
        || new.customer_reschedule_reason
      else 'The salon changed your appointment ' || new.reference_no || ' to '
        || to_char(new.local_date, 'FMMonth FMDD, YYYY') || ' at '
        || to_char(new.local_date + new.local_time, 'HH12:MI AM') || ' Manila time.'
      end
    else 'Your appointment ' || new.reference_no || ' was updated.'
  end;
  insert into public.user_notifications(customer_id, appointment_id, type, title, message)
  values (new.customer_id, new.id, v_type, v_title, v_message);
  insert into public.notification_outbox(appointment_id, recipient_id, kind, payload)
  values (
    new.id,
    new.customer_id,
    v_type,
    jsonb_build_object('reference_no', new.reference_no, 'title', v_title, 'message', v_message)
  );
  return new;
end;
$$;
drop trigger if exists appointments_enqueue_notification on public.appointments;
create trigger appointments_enqueue_notification
after insert or update of status, local_date, local_time on public.appointments
for each row execute function public.enqueue_appointment_notification();
revoke all on function public.enqueue_appointment_notification() from public;

-- Remove the deployed reason-free overload so it cannot bypass the new required reason.
drop function if exists public.customer_reschedule_appointment(uuid, date, time);

create or replace function public.customer_reschedule_appointment(
  p_appointment_id uuid,
  p_date date,
  p_time time,
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
  if p_date = v_appointment.local_date and p_time = v_appointment.local_time then
    raise exception 'Choose a different date or time';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  select h.open_time, h.close_time, h.is_closed
    into v_open, v_close, v_closed
    from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null then raise exception 'Salon is closed on that date'; end if;
  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  if p_time < v_open or v_start + make_interval(mins => v_appointment.total_duration_minutes)
       > ((p_date + v_close) at time zone 'Asia/Manila') then
    raise exception 'The appointment does not fit within salon hours';
  end if;
  if v_start <= v_now then raise exception 'That time has already passed'; end if;

  perform pg_advisory_xact_lock(hashtextextended('booking-date:' || p_date::text, 19071990));
  if v_appointment.staff_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_appointment.staff_id::text || ':' || p_date::text, 19071990));
  end if;
  if exists (
    select 1 from public.appointments a
     where a.id <> v_appointment.id
       and a.status in ('Pending', 'Confirmed')
       and (
         v_appointment.staff_id is null
         or a.staff_id = v_appointment.staff_id
         or a.staff_id is null
       )
       and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_appointment.total_duration_minutes), '[)')
  ) then
    raise exception 'That time is no longer available' using errcode = '23P01';
  end if;

  perform set_config('app.allow_customer_appointment_action', 'true', true);
  perform set_config('app.allow_appointment_reschedule', 'true', true);
  update public.appointments
     set local_date = p_date,
         local_time = p_time,
         start_at = v_start,
         customer_reschedule_reason = v_reason,
         status = case when status = 'Confirmed' then 'Pending' else status end
   where id = v_appointment.id
   returning * into v_appointment;
  return v_appointment;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;
revoke all on function public.customer_reschedule_appointment(uuid, date, time, text) from public, anon, service_role;
grant execute on function public.customer_reschedule_appointment(uuid, date, time, text) to authenticated;

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
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user and p.role = 'customer' and p.is_active) then
    raise exception 'Active customer access required' using errcode = '42501';
  end if;
  if p_appointment_id is null then raise exception 'Appointment is required' using errcode = '22023'; end if;
  if char_length(v_reason) not between 1 and 500 then
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
     set status = 'Cancelled', customer_cancellation_reason = v_reason
   where id = v_appointment.id
   returning * into v_appointment;
  return v_appointment;
end;
$$;
revoke all on function public.customer_cancel_appointment(uuid, text) from public, anon, service_role;
grant execute on function public.customer_cancel_appointment(uuid, text) to authenticated;

commit;
