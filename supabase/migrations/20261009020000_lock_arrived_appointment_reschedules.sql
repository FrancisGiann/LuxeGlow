begin;

-- Attendance is tied to a specific scheduled visit. Once a team member records
-- arrival, that appointment cannot be moved to another date or time.
create or replace function public.protect_arrived_appointment_schedule()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role'
     and old.arrived_at is not null
     and (old.local_date is distinct from new.local_date
          or old.local_time is distinct from new.local_time
          or old.start_at is distinct from new.start_at) then
    raise exception 'An appointment marked arrived cannot be rescheduled' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_arrived_appointment_schedule() from public;
drop trigger if exists appointments_protect_arrived_schedule on public.appointments;
create trigger appointments_protect_arrived_schedule
before update on public.appointments
for each row execute function public.protect_arrived_appointment_schedule();

-- A "keep" decision applies only to the missed slot. If staff move that slot,
-- clear the marker so arrival/no-show follow-up applies to the new visit.
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
  if p_date is null or p_time is null or p_date < (now() at time zone 'Asia/Manila')::date or p_date > ((now() at time zone 'Asia/Manila')::date + 60) or extract(second from p_time) <> 0 or extract(minute from p_time)::integer % 30 <> 0 then raise exception 'Choose a valid future 30-minute slot'; end if;
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found or v_appointment.status in ('Completed', 'Cancelled') then raise exception 'That appointment cannot be rescheduled'; end if;
  if v_appointment.arrived_at is not null then
    raise exception 'An appointment marked arrived cannot be rescheduled' using errcode = '55000';
  end if;
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
  v_reset_no_show_review := v_appointment.no_show_reviewed_at is not null
    and (v_appointment.local_date is distinct from p_date or v_appointment.local_time is distinct from p_time);
  if v_reset_no_show_review then
    perform set_config('app.allow_no_show_review', 'true', true);
  end if;
  perform set_config('app.allow_appointment_reschedule', 'true', true);
  update public.appointments
     set local_date = p_date,
         local_time = p_time,
         start_at = v_start,
         no_show_reviewed_at = case when v_reset_no_show_review then null else no_show_reviewed_at end
   where id = v_appointment.id
   returning * into v_appointment;
  return v_appointment;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;

revoke all on function public.reschedule_appointment(uuid, date, time) from public;
grant execute on function public.reschedule_appointment(uuid, date, time) to authenticated;

commit;
