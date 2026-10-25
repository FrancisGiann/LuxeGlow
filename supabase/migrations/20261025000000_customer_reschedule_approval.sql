-- LOCAL REVIEW ONLY. Head and Admin approval authority is user-confirmed.
begin;

create table public.appointment_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id),
  customer_id uuid not null references public.profiles(id),
  original_start_at timestamptz not null,
  original_status text not null,
  original_staff_member_id uuid,
  original_staff_id uuid,
  original_duration_minutes integer not null,
  requested_date date not null,
  requested_time time not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded','stale','conflicted')),
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  resolution_reason text
);
create unique index appointment_one_pending_reschedule on public.appointment_reschedule_requests(appointment_id) where status = 'pending';
create index appointment_reschedule_requests_customer on public.appointment_reschedule_requests(customer_id, created_at desc);
alter table public.appointment_reschedule_requests enable row level security;
revoke all on public.appointment_reschedule_requests from public, anon, authenticated;
grant select on public.appointment_reschedule_requests to authenticated;
create policy reschedule_requests_read on public.appointment_reschedule_requests for select to authenticated
using (public.is_staff() or (customer_id = auth.uid() and exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer' and p.is_active
)));

-- Preserve the user-confirmed Head/Admin operational approval boundary.
create function public.can_approve_reschedule()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.is_staff() $$;
revoke all on function public.can_approve_reschedule() from public, anon;
grant execute on function public.can_approve_reschedule() to authenticated;

-- Shared validator used at submission AND approval. Only this appointment's
-- current allocation is excluded; pending requests never reserve capacity.
create function public.validate_reschedule_target(p_appointment_id uuid, p_date date, p_time time)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.appointments;
  v_open time; v_close time; v_closed boolean; v_start timestamptz;
begin
  select * into strict a from public.appointments where id = p_appointment_id;
  if a.status not in ('Pending','Confirmed') or a.arrived_at is not null or a.start_at <= clock_timestamp() then
    raise exception 'This appointment is no longer eligible for a reschedule request' using errcode = '55000';
  end if;
  if p_date is null or p_time is null
    or p_date < (clock_timestamp() at time zone 'Asia/Manila')::date
    or p_date > (clock_timestamp() at time zone 'Asia/Manila')::date + 60
    or extract(second from p_time) <> 0 or extract(minute from p_time)::integer % 30 <> 0 then
    raise exception 'Choose a date and 30-minute time within the next 60 days' using errcode = '22023';
  end if;
  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  if v_start <= clock_timestamp() or v_start = a.start_at then
    raise exception 'Choose a different future time' using errcode = '22023';
  end if;
  select h.open_time, h.close_time, h.is_closed into v_open, v_close, v_closed from public.salon_hours_for_date(p_date) h;
  if not found or v_closed or v_open is null or v_close is null or p_time < v_open
    or v_start + make_interval(mins => a.total_duration_minutes) > ((p_date + v_close) at time zone 'Asia/Manila') then
    raise exception 'The requested appointment does not fit salon hours' using errcode = '22023';
  end if;
  if a.staff_member_id is not null and not exists (
    select 1 from public.staff_members m where m.id = a.staff_member_id and m.record_kind = 'staff' and m.is_active and m.is_bookable
  ) then raise exception 'The assigned team member is no longer bookable' using errcode = '55000'; end if;
  if exists (select 1 from public.appointments other where other.id <> a.id and other.status in ('Pending','Confirmed')
    and (a.staff_member_id is null or other.staff_member_id = a.staff_member_id or other.staff_member_id is null)
    and other.booking_range && tstzrange(v_start, v_start + make_interval(mins => a.total_duration_minutes), '[)')) then
    raise exception 'That time is no longer available. The original appointment is unchanged.' using errcode = '23P01';
  end if;
end;
$$;
revoke all on function public.validate_reschedule_target(uuid,date,time) from public, anon, authenticated;

create function public.request_appointment_reschedule(p_appointment_id uuid, p_date date, p_time time, p_reason text)
returns public.appointment_reschedule_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.appointments; r public.appointment_reschedule_requests; v_reason text := btrim(coalesce(p_reason,''));
begin
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
revoke all on function public.request_appointment_reschedule(uuid,date,time,text) from public, anon, service_role;
grant execute on function public.request_appointment_reschedule(uuid,date,time,text) to authenticated;

create function public.review_appointment_reschedule(p_request_id uuid, p_approve boolean, p_reason text default null)
returns public.appointment_reschedule_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.appointments; r public.appointment_reschedule_requests; v_appointment_id uuid; v_failure text; v_state text;
begin
  if not public.can_approve_reschedule() then raise exception 'Appointment approval access required' using errcode = '42501'; end if;
  if p_approve is null then raise exception 'Choose an approval decision' using errcode = '22023'; end if;
  if not p_approve and (char_length(btrim(coalesce(p_reason,''))) not between 1 and 500
    or regexp_replace(coalesce(p_reason,''), '[[:space:]]', '', 'g') = '') then
    raise exception 'Enter a reason for declining the request' using errcode = '22023';
  end if;
  -- Same schedule/date/staff locks as booking. Lock order: schedule, appointment,
  -- request, date, staff. The original allocation remains held until commit.
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule',19071990));
  select appointment_id into v_appointment_id from public.appointment_reschedule_requests where id = p_request_id;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  select * into strict a from public.appointments where id = v_appointment_id for update;
  select * into strict r from public.appointment_reschedule_requests where id = p_request_id for update;
  if r.status <> 'pending' then return r; end if;
  if a.status not in ('Pending','Confirmed') or a.arrived_at is not null or a.start_at <= clock_timestamp()
    or a.start_at is distinct from r.original_start_at or a.status is distinct from r.original_status
    or a.staff_member_id is distinct from r.original_staff_member_id or a.staff_id is distinct from r.original_staff_id
    or a.total_duration_minutes is distinct from r.original_duration_minutes then
    update public.appointment_reschedule_requests set status = 'stale', resolved_at = clock_timestamp(), resolved_by = auth.uid(),
      resolution_reason = 'The original appointment changed or is no longer eligible.' where id = r.id returning * into r;
    return r;
  end if;
  if not p_approve then
    update public.appointment_reschedule_requests set status = 'rejected', resolved_at = clock_timestamp(), resolved_by = auth.uid(),
      resolution_reason = btrim(p_reason) where id = r.id returning * into r;
    insert into public.user_notifications(customer_id,appointment_id,type,title,message)
      values(a.customer_id,a.id,'system','Reschedule request declined','Your original appointment remains scheduled. Reason: ' || r.resolution_reason);
    return r;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('booking-date:' || r.requested_date::text,19071990));
  perform pg_advisory_xact_lock(hashtextextended(coalesce(a.staff_member_id,a.staff_id,a.id)::text || ':' || r.requested_date::text,19071990));
  begin
    perform public.validate_reschedule_target(a.id,r.requested_date,r.requested_time);
    update public.appointment_reschedule_requests set status = 'approved', resolved_at = clock_timestamp(), resolved_by = auth.uid()
      where id = r.id returning * into r;
    perform set_config('app.allow_appointment_reschedule','true',true);
    perform set_config('app.allow_reschedule_approval','true',true);
    perform set_config('app.allow_customer_appointment_action','true',true);
    perform set_config('app.allow_no_show_review','true',true);
    update public.appointments set local_date = r.requested_date, local_time = r.requested_time,
      start_at = (r.requested_date + r.requested_time) at time zone 'Asia/Manila',
      customer_reschedule_reason = r.reason, no_show_reviewed_at = null where id = a.id;
    -- Existing appointment trigger sends rescheduled email/in-app notice and
    -- invalidates old reminders. Appointment status and assigned staff survive.
  exception when exclusion_violation or sqlstate '22023' or sqlstate '55000' then
    get stacked diagnostics v_failure = message_text, v_state = returned_sqlstate;
    update public.appointment_reschedule_requests set status = case when v_state = '23P01' then 'conflicted' else 'stale' end,
      resolved_at = clock_timestamp(), resolved_by = auth.uid(), resolution_reason = v_failure where id = r.id returning * into r;
    insert into public.user_notifications(customer_id,appointment_id,type,title,message)
      values(a.customer_id,a.id,'system','Reschedule request needs a new time','The requested change could not be approved. Your original appointment is unchanged. ' || v_failure);
  end;
  return r;
end;
$$;
revoke all on function public.review_appointment_reschedule(uuid,boolean,text) from public, anon, service_role;
grant execute on function public.review_appointment_reschedule(uuid,boolean,text) to authenticated;

-- Cancellation, arrival, confirmation, expiry, and assignment changes invalidate
-- outstanding requests, preserving each request as history.
create function public.invalidate_appointment_reschedule_requests()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status is distinct from new.status or old.start_at is distinct from new.start_at
    or old.arrived_at is distinct from new.arrived_at or old.staff_member_id is distinct from new.staff_member_id
    or old.staff_id is distinct from new.staff_id or old.total_duration_minutes is distinct from new.total_duration_minutes then
    update public.appointment_reschedule_requests set status = 'stale', resolved_at = clock_timestamp(),
      resolution_reason = 'The original appointment changed or is no longer eligible.' where appointment_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
revoke all on function public.invalidate_appointment_reschedule_requests() from public, anon, authenticated;
create trigger appointments_invalidate_reschedule_requests after update on public.appointments
for each row execute function public.invalidate_appointment_reschedule_requests();

-- Fail closed for old clients; removing buttons alone is insufficient.
create or replace function public.reschedule_appointment(p_appointment_id uuid,p_date date,p_time time)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
begin raise exception 'A customer reschedule request must be approved instead' using errcode = '42501'; end;
$$;
revoke all on function public.reschedule_appointment(uuid,date,time) from public,anon,authenticated,service_role;
create or replace function public.customer_reschedule_appointment(p_appointment_id uuid,p_date date,p_time time,p_reason text)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
begin raise exception 'Submit a reschedule request; your original appointment remains scheduled until approval' using errcode = '42501'; end;
$$;
revoke all on function public.customer_reschedule_appointment(uuid,date,time,text) from public,anon,authenticated,service_role;

-- Availability is advisory. Exclude this booking itself so a customer may
-- request a partially overlapping replacement, while still holding the original.
create function public.get_reschedule_slots(p_appointment_id uuid,p_date date)
returns table(slot_time text,available boolean) language plpgsql stable security definer set search_path = public, pg_temp as $$
declare a public.appointments; v_open time; v_close time; v_closed boolean; v_slot timestamp;
begin
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
revoke all on function public.get_reschedule_slots(uuid,date) from public,anon,service_role;
grant execute on function public.get_reschedule_slots(uuid,date) to authenticated;

-- Preserve existing email events/reminder invalidation with accurate approval copy.
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
    when 'rescheduled' then case when current_setting('app.allow_reschedule_approval',true) = 'true' then
      'The salon approved your requested change for appointment ' || new.reference_no || ' to '
        || to_char(new.local_date, 'FMMonth FMDD, YYYY') || ' at '
        || to_char(new.local_date + new.local_time, 'HH12:MI AM') || ' Manila time. Appointment status: '
        || new.status || '. Reason: ' || new.customer_reschedule_reason
      when v_customer_reschedule then
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


commit;
