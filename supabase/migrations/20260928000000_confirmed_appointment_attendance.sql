begin;

alter table public.appointments
  add column if not exists arrived_at timestamptz,
  add column if not exists no_show_reviewed_at timestamptz;

-- Attendance timestamps can only be written through the RPCs below.
create or replace function public.protect_appointment_attendance_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.arrived_at is distinct from new.arrived_at
     and current_setting('app.allow_appointment_arrival', true) is distinct from 'true' then
    raise exception 'Arrival must be recorded through the arrival workflow';
  end if;
  if old.no_show_reviewed_at is distinct from new.no_show_reviewed_at
     and current_setting('app.allow_no_show_review', true) is distinct from 'true' then
    raise exception 'No-show decisions must use the staff workflow';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_appointment_attendance_fields() from public;
drop trigger if exists appointments_protect_attendance on public.appointments;
create trigger appointments_protect_attendance
before update on public.appointments
for each row execute function public.protect_appointment_attendance_fields();

-- Keep the existing staff status workflow available while preventing direct
-- browser writes to either attendance timestamp.
revoke update on public.appointments from authenticated;
grant update (status) on public.appointments to authenticated;

create or replace function public.mark_appointment_arrived(p_appointment_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_start_at timestamptz;
  v_arrived_at timestamptz;
  v_now timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = v_user_id and p.is_active = true and p.role in ('head', 'admin')
  ) then
    raise exception 'Active staff access required' using errcode = '42501';
  end if;
  if p_appointment_id is null then
    raise exception 'Appointment is required' using errcode = '22023';
  end if;

  select a.status, a.start_at, a.arrived_at
    into v_status, v_start_at, v_arrived_at
    from public.appointments a
   where a.id = p_appointment_id
   for update;
  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  v_now := clock_timestamp();
  if v_status <> 'Confirmed' then
    raise exception 'Only confirmed appointments can be marked arrived' using errcode = '55000';
  end if;
  if v_start_at > v_now + interval '15 minutes' then
    raise exception 'Arrival can only be recorded from 15 minutes before the scheduled start' using errcode = '55000';
  end if;

  if v_arrived_at is null then
    perform set_config('app.allow_appointment_arrival', 'true', true);
    update public.appointments
       set arrived_at = clock_timestamp()
     where id = p_appointment_id
     returning arrived_at into v_arrived_at;
  end if;
  return v_arrived_at;
end;
$$;

revoke all on function public.mark_appointment_arrived(uuid) from public, anon, service_role;
grant execute on function public.mark_appointment_arrived(uuid) to authenticated;

create or replace function public.respond_to_no_show(p_appointment_id uuid, p_cancel boolean)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_start_at timestamptz;
  v_arrived_at timestamptz;
  v_reviewed_at timestamptz;
  v_now timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = v_user_id and p.is_active = true and p.role in ('head', 'admin')
  ) then
    raise exception 'Active staff access required' using errcode = '42501';
  end if;
  if p_appointment_id is null or p_cancel is null then
    raise exception 'Appointment and staff decision are required' using errcode = '22023';
  end if;

  select a.status, a.start_at, a.arrived_at, a.no_show_reviewed_at
    into v_status, v_start_at, v_arrived_at, v_reviewed_at
    from public.appointments a
   where a.id = p_appointment_id
   for update;
  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  v_now := clock_timestamp();
  if v_status <> 'Confirmed' then
    return 'not_eligible';
  end if;
  if v_arrived_at is not null then
    return 'arrived';
  end if;
  if v_reviewed_at is not null then
    return 'already_reviewed';
  end if;
  if v_start_at > v_now - interval '15 minutes' then
    return 'not_due';
  end if;

  if p_cancel then
    -- The row lock and conditional update serialize this choice with arrival.
    update public.appointments
       set status = 'Cancelled'
     where id = p_appointment_id and status = 'Confirmed' and arrived_at is null;
    if not found then
      return 'not_eligible';
    end if;
    return 'cancelled';
  end if;

  perform set_config('app.allow_no_show_review', 'true', true);
  update public.appointments
     set no_show_reviewed_at = v_now
   where id = p_appointment_id and status = 'Confirmed' and arrived_at is null;
  if not found then
    return 'not_eligible';
  end if;
  return 'kept';
end;
$$;

revoke all on function public.respond_to_no_show(uuid, boolean) from public, anon, service_role;
grant execute on function public.respond_to_no_show(uuid, boolean) to authenticated;

commit;
