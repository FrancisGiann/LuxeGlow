begin;

-- Keep this field nullable for historical cancellations whose reason was never
-- captured. New cancellations are required to record a canonical reason.
alter table public.appointments
  add column if not exists cancellation_reason text;
alter table public.appointments
  drop constraint if exists appointments_cancellation_reason_check;
alter table public.appointments
  add constraint appointments_cancellation_reason_check
  check (
    cancellation_reason is null
    or (
      char_length(regexp_replace(cancellation_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 500
      and regexp_replace(cancellation_reason, '[[:space:]]', '', 'g') <> ''
    )
  );
comment on column public.appointments.cancellation_reason is
  'Canonical cancellation reason for staff and automatic workflows; null for legacy cancellations with no recorded reason.';

-- Staff update status and the canonical reason together. Customer writes remain
-- inside the existing locked SECURITY DEFINER cancellation workflow.
grant update (status, cancellation_reason) on public.appointments to authenticated;

create or replace function public.protect_appointment_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_privileged boolean := session_user in ('postgres', 'supabase_admin')
    or coalesce(auth.role(), '') = 'service_role';
  v_customer_action boolean := coalesce(current_setting('app.allow_customer_appointment_action', true) = 'true', false);
  -- reconcile_expired_pending_appointments is SECURITY DEFINER and callable by
  -- a customer for their own expired booking. RLS still denies that customer
  -- direct UPDATE access; this narrowly accepts only the exact owner/expiry
  -- lifecycle row the trusted RPC is permitted to reconcile.
  v_expired_pending_reconciliation boolean := coalesce(auth.uid() = old.customer_id
    and old.status = 'Pending'
    and new.status = 'Cancelled'
    and old.start_at < clock_timestamp() - interval '15 minutes'
    and new.cancellation_reason = 'Automatically cancelled because the appointment remained unconfirmed 15 minutes after its scheduled start.', false);
  v_reason text;
begin
  if not v_privileged
     and (old.customer_id is distinct from new.customer_id
       or old.reference_no is distinct from new.reference_no
       or old.total_duration_minutes is distinct from new.total_duration_minutes
       or old.total_price is distinct from new.total_price
       or old.legacy_appointment_id is distinct from new.legacy_appointment_id
       or old.created_at is distinct from new.created_at) then
    raise exception 'Appointment details are immutable';
  end if;

  if not v_privileged
     and (old.customer_cancellation_reason is distinct from new.customer_cancellation_reason
       or old.customer_reschedule_reason is distinct from new.customer_reschedule_reason)
     and not v_customer_action then
    raise exception 'Customer appointment reasons can only be saved through the customer appointment workflow';
  end if;

  if old.status in ('Completed', 'Cancelled') and old.status is distinct from new.status
     and not v_privileged then
    raise exception 'A completed or cancelled appointment cannot be reopened';
  end if;

  if old.cancellation_reason is distinct from new.cancellation_reason and not v_privileged then
    if old.status in ('Completed', 'Cancelled') then
      raise exception 'A terminal appointment cancellation reason cannot be changed';
    end if;
    if old.status not in ('Pending', 'Confirmed') or new.status <> 'Cancelled' then
      raise exception 'A cancellation reason can only be recorded with cancellation';
    end if;
    if not public.is_staff() and not v_customer_action and not v_expired_pending_reconciliation then
      raise exception 'Only staff or the customer cancellation workflow can record a cancellation reason' using errcode = '42501';
    end if;
  end if;

  if new.status = 'Cancelled' and old.status is distinct from new.status then
    v_reason := regexp_replace(coalesce(new.cancellation_reason, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if char_length(v_reason) not between 1 and 500
       or regexp_replace(v_reason, '[[:space:]]', '', 'g') = '' then
      raise exception 'A cancellation reason between 1 and 500 non-whitespace characters is required' using errcode = '22023';
    end if;
    new.cancellation_reason := v_reason;
    if not v_privileged and not public.is_staff() and not v_customer_action and not v_expired_pending_reconciliation then
      raise exception 'Only staff or an authorized customer cancellation workflow can cancel an appointment' using errcode = '42501';
    end if;
  end if;

  if old.status is distinct from new.status
     and current_setting('app.allow_customer_appointment_action', true) is distinct from 'true'
     and not v_privileged
     and not (
       (old.status = 'Pending' and new.status in ('Confirmed', 'Cancelled'))
       or (old.status = 'Confirmed' and new.status in ('Completed', 'Cancelled'))
     ) then
    raise exception 'Appointment status must follow the booking workflow' using errcode = '55000';
  end if;

  if not v_privileged
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
revoke all on function public.customer_cancel_appointment(uuid, text) from public, anon, service_role;
grant execute on function public.customer_cancel_appointment(uuid, text) to authenticated;

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
  if v_status <> 'Confirmed' then return 'not_eligible'; end if;
  if v_arrived_at is not null then return 'arrived'; end if;
  if v_reviewed_at is not null then return 'already_reviewed'; end if;
  if v_start_at > v_now - interval '15 minutes' then return 'not_due'; end if;

  if p_cancel then
    -- The row lock and conditional update serialize this choice with arrival.
    update public.appointments
       set status = 'Cancelled', cancellation_reason = 'Cancelled after no arrival was recorded.'
     where id = p_appointment_id and status = 'Confirmed' and arrived_at is null;
    if not found then return 'not_eligible'; end if;
    return 'cancelled';
  end if;

  perform set_config('app.allow_no_show_review', 'true', true);
  update public.appointments
     set no_show_reviewed_at = v_now
   where id = p_appointment_id and status = 'Confirmed' and arrived_at is null;
  if not found then return 'not_eligible'; end if;
  return 'kept';
end;
$$;
revoke all on function public.respond_to_no_show(uuid, boolean) from public, anon, service_role;
grant execute on function public.respond_to_no_show(uuid, boolean) to authenticated;

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

  select p.role into v_role
    from public.profiles p
   where p.id = v_user_id and p.is_active = true;
  if not found then raise exception 'Active profile required' using errcode = '42501'; end if;

  update public.appointments
     set status = 'Cancelled',
         cancellation_reason = 'Automatically cancelled because the appointment remained unconfirmed 15 minutes after its scheduled start.'
   where status = 'Pending'
     and start_at < now() - interval '15 minutes'
     and (v_role in ('head', 'admin') or customer_id = v_user_id);
  get diagnostics v_cancelled = row_count;
  return v_cancelled;
end;
$$;
revoke all on function public.reconcile_expired_pending_appointments() from public, anon, service_role;
grant execute on function public.reconcile_expired_pending_appointments() to authenticated;

create or replace function public.run_appointment_maintenance(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled integer := 0;
  v_no_show_cancelled integer := 0;
begin
  update public.appointments
     set status = 'Cancelled',
         cancellation_reason = 'Automatically cancelled because the appointment remained unconfirmed 15 minutes after its scheduled start.'
   where status = 'Pending' and start_at < p_now - interval '15 minutes';
  get diagnostics v_cancelled = row_count;

  update public.appointments
     set status = 'Cancelled',
         cancellation_reason = 'Automatically cancelled because no arrival or staff review was recorded within 24 hours of the scheduled start.'
   where status = 'Confirmed'
     and arrived_at is null
     and no_show_reviewed_at is null
     and start_at <= p_now - interval '24 hours';
  get diagnostics v_no_show_cancelled = row_count;

  -- Serialize reminder creation with reschedules and key each reminder to the
  -- appointment start time so later reschedules can receive their own reminder.
  perform pg_advisory_xact_lock(hashtextextended('appointment-maintenance-reminders', 19071990));
  insert into public.user_notifications(customer_id, appointment_id, type, title, message)
  select a.customer_id, a.id, 'reminder', 'Appointment reminder',
         'Your appointment ' || a.reference_no || ' starts soon.'
    from public.appointments a
   where a.status = 'Confirmed'
     and a.start_at between p_now and p_now + interval '25 hours'
     and a.start_at - interval '24 hours' <= p_now
     and not exists (
       select 1 from public.notification_outbox n
        where n.appointment_id = a.id and n.kind = 'reminder'
          and n.payload->>'scheduled_start_epoch' = extract(epoch from a.start_at)::bigint::text
     );
  insert into public.notification_outbox(appointment_id, recipient_id, kind, payload, available_at)
  select a.id, a.customer_id, 'reminder',
         jsonb_build_object(
           'reference_no', a.reference_no,
           'title', 'Appointment reminder',
           'message', 'Your appointment ' || a.reference_no || ' starts soon.',
           'scheduled_start_epoch', extract(epoch from a.start_at)::bigint
         ),
         a.start_at - interval '24 hours'
    from public.appointments a
   where a.status = 'Confirmed'
     and a.start_at between p_now and p_now + interval '25 hours'
     and not exists (
       select 1 from public.notification_outbox n
        where n.appointment_id = a.id and n.kind = 'reminder'
          and n.payload->>'scheduled_start_epoch' = extract(epoch from a.start_at)::bigint::text
     );
  return v_cancelled + v_no_show_cancelled;
end;
$$;
revoke all on function public.run_appointment_maintenance(timestamptz) from public;
grant execute on function public.run_appointment_maintenance(timestamptz) to service_role;

commit;
