begin;

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
  if v_start_at is null
     or (v_start_at at time zone 'Asia/Manila')::date
        is distinct from (v_now at time zone 'Asia/Manila')::date then
    raise exception 'Arrival can only be recorded on the appointment calendar date in Asia/Manila' using errcode = '55000';
  end if;

  if v_arrived_at is null then
    perform set_config('app.allow_appointment_arrival', 'true', true);
    update public.appointments
       set arrived_at = v_now
     where id = p_appointment_id
     returning arrived_at into v_arrived_at;
  end if;
  return v_arrived_at;
end;
$$;

revoke all on function public.mark_appointment_arrived(uuid) from public, anon, service_role;
grant execute on function public.mark_appointment_arrived(uuid) to authenticated;

commit;
