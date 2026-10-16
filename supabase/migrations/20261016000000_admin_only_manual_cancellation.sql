begin;

-- Heads keep the appointment workflow, but only active administrators may
-- perform a manual cancellation. Customer cancellation and expiry maintenance
-- remain authorized through their validated server-side workflows.
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
  v_expired_pending_reconciliation boolean := coalesce(
    current_setting('app.allow_expired_pending_reconciliation', true) = 'true'
    and old.status = 'Pending'
    and new.status = 'Cancelled'
    and old.start_at < clock_timestamp() - interval '15 minutes'
    and new.cancellation_reason = 'Automatically cancelled because the appointment remained unconfirmed 15 minutes after its scheduled start.'
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.is_active
         and (p.role in ('head', 'admin') or (p.role = 'customer' and p.id = old.customer_id))
    ),
    false
  );
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
    if not (public.is_admin() or v_customer_action or v_expired_pending_reconciliation) then
      raise exception 'Only administrators or authorized cancellation workflows can record a cancellation reason' using errcode = '42501';
    end if;
  end if;

  if new.status = 'Cancelled' and old.status is distinct from new.status then
    v_reason := regexp_replace(coalesce(new.cancellation_reason, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if char_length(v_reason) not between 1 and 500
       or regexp_replace(v_reason, '[[:space:]]', '', 'g') = '' then
      raise exception 'A cancellation reason between 1 and 500 non-whitespace characters is required' using errcode = '22023';
    end if;
    new.cancellation_reason := v_reason;
    if not v_privileged and not (public.is_admin() or v_customer_action or v_expired_pending_reconciliation) then
      raise exception 'Only administrators or authorized cancellation workflows can cancel an appointment' using errcode = '42501';
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

-- Keep Head access to the no-show review action, but reject its cancellation
-- choice before any appointment row can be changed.
create or replace function public.respond_to_no_show(p_appointment_id uuid, p_cancel boolean)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_status text;
  v_start_at timestamptz;
  v_arrived_at timestamptz;
  v_reviewed_at timestamptz;
  v_now timestamptz;
  v_previous_review_marker text := current_setting('app.allow_no_show_review', true);
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_appointment_id is null or p_cancel is null then
    raise exception 'Appointment and staff decision are required' using errcode = '22023';
  end if;

  select p.role into v_role
    from public.profiles p
   where p.id = v_user_id and p.is_active = true and p.role in ('head', 'admin');
  if not found then
    raise exception 'Active staff access required' using errcode = '42501';
  end if;
  if p_cancel and v_role <> 'admin' then
    raise exception 'Only administrators may cancel a no-show appointment' using errcode = '42501';
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
  if not found then
    perform set_config('app.allow_no_show_review', coalesce(v_previous_review_marker, 'false'), true);
    return 'not_eligible';
  end if;
  perform set_config('app.allow_no_show_review', coalesce(v_previous_review_marker, 'false'), true);
  return 'kept';
end;
$$;
revoke all on function public.respond_to_no_show(uuid, boolean) from public, anon, service_role;
grant execute on function public.respond_to_no_show(uuid, boolean) to authenticated;

-- Expiry reconciliation remains available to active staff and to a customer
-- for their own booking. The trigger accepts its fixed cancellation only while
-- this validated, row-scoped workflow marker is set in the current transaction.
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
revoke all on function public.reconcile_expired_pending_appointments() from public, anon, service_role;
grant execute on function public.reconcile_expired_pending_appointments() to authenticated;

commit;
