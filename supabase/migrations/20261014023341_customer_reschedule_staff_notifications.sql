begin;

alter table public.staff_notifications
  drop constraint if exists staff_notifications_type_check;
alter table public.staff_notifications
  add constraint staff_notifications_type_check
  check (type in ('new_booking', 'customer_cancelled', 'customer_rescheduled'));

-- Only the appointment reschedule trigger may refresh notification content.
-- Staff still have the existing is_read-only update permission.
create or replace function public.protect_staff_notification_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role' then
    if old.id is distinct from new.id
       or old.recipient_id is distinct from new.recipient_id
       or old.appointment_id is distinct from new.appointment_id
       or old.type is distinct from new.type then
      raise exception 'Staff notification identity is immutable';
    end if;

    if old.title is distinct from new.title
       or old.message is distinct from new.message
       or old.created_at is distinct from new.created_at then
      if old.type <> 'customer_rescheduled'
         or new.type <> 'customer_rescheduled'
         or new.is_read is distinct from false
         or new.created_at <= old.created_at
         or current_setting('app.allow_customer_reschedule_notification_refresh', true) is distinct from 'true'
         or pg_trigger_depth() <= 1 then
        raise exception 'Staff notification details are immutable';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_staff_notification_fields() from public;

create or replace function public.enqueue_customer_reschedule_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'UPDATE'
     or old.status not in ('Pending', 'Confirmed')
     or new.status not in ('Pending', 'Confirmed')
     or (old.local_date is not distinct from new.local_date
         and old.local_time is not distinct from new.local_time
         and old.start_at is not distinct from new.start_at)
     or new.start_at is distinct from ((new.local_date + new.local_time) at time zone 'Asia/Manila')
     or current_setting('app.allow_appointment_reschedule', true) is distinct from 'true'
     or auth.uid() is null
     or auth.uid() is distinct from new.customer_id
     or coalesce(auth.role(), '') <> 'authenticated'
     or not exists (
       select 1 from public.profiles p
        where p.id = new.customer_id and p.role = 'customer' and p.is_active
     ) then
    return new;
  end if;

  perform set_config('app.allow_customer_reschedule_notification_refresh', 'true', true);

  insert into public.staff_notifications(recipient_id, appointment_id, type, title, message)
  select p.id,
         new.id,
         'customer_rescheduled',
         'Customer rescheduled an appointment',
         'Appointment ' || coalesce(new.reference_no, '—') || ' was rescheduled from '
           || old.local_date::text || ' ' || left(old.local_time::text, 5) || ' to '
           || new.local_date::text || ' ' || left(new.local_time::text, 5) || '.'
    from public.profiles p
   where p.role in ('head', 'admin')
     and p.is_active = true
  on conflict (recipient_id, appointment_id, type) do update
     set title = excluded.title,
         message = excluded.message,
         is_read = false,
         created_at = clock_timestamp();

  return new;
end;
$$;

revoke all on function public.enqueue_customer_reschedule_notifications() from public, anon, authenticated;
drop trigger if exists appointments_enqueue_customer_reschedule_notifications on public.appointments;
create trigger appointments_enqueue_customer_reschedule_notifications
after update of local_date, local_time, start_at on public.appointments
for each row execute function public.enqueue_customer_reschedule_notifications();

comment on table public.staff_notifications is 'Per-recipient realtime notifications for new bookings, customer cancellations, and customer reschedules';

commit;
