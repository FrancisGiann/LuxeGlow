begin;

-- The browser UI exposes only the intended booking lifecycle, but authenticated
-- staff can also call PostgREST directly. Enforce that same transition matrix
-- at the database boundary so a pending booking cannot be completed early.
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
     and old.status is distinct from new.status
     and current_setting('app.allow_customer_appointment_action', true) is distinct from 'true'
     and not (
       (old.status = 'Pending' and new.status in ('Confirmed', 'Cancelled'))
       or (old.status = 'Confirmed' and new.status in ('Completed', 'Cancelled'))
     ) then
    raise exception 'Appointment status must follow the booking workflow' using errcode = '55000';
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

commit;
