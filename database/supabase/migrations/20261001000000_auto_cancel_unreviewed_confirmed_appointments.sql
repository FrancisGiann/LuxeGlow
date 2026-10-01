begin;

-- The existing scheduled process-notifications worker runs this service-role
-- maintenance function and lets status triggers enqueue customer notices.
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
  -- Preserve the existing expiry rule for unanswered booking requests.
  update public.appointments
     set status = 'Cancelled'
   where status = 'Pending'
     and start_at < p_now - interval '15 minutes';
  get diagnostics v_cancelled = row_count;

  -- Confirmed appointments with no arrival or explicit Keep review become
  -- eligible 24 hours after their scheduled start, then are cancelled on the
  -- next worker tick. Predicates are rechecked after any concurrent row lock.
  update public.appointments
     set status = 'Cancelled'
   where status = 'Confirmed'
     and arrived_at is null
     and no_show_reviewed_at is null
     and start_at <= p_now - interval '24 hours';
  get diagnostics v_no_show_cancelled = row_count;

  -- Keep one reminder per confirmed appointment. The unique constraints make
  -- a scheduler retry idempotent.
  insert into public.user_notifications(customer_id, appointment_id, type, title, message)
  select a.customer_id, a.id, 'reminder', 'Appointment reminder',
         'Your appointment ' || a.reference_no || ' starts soon.'
    from public.appointments a
   where a.status = 'Confirmed'
     and a.start_at between p_now and p_now + interval '25 hours'
     and a.start_at - interval '24 hours' <= p_now
     and not exists (select 1 from public.user_notifications n where n.appointment_id = a.id and n.type = 'reminder')
  on conflict do nothing;
  insert into public.notification_outbox(appointment_id, recipient_id, kind, payload, available_at)
  select a.id, a.customer_id, 'reminder',
         jsonb_build_object('reference_no', a.reference_no, 'title', 'Appointment reminder', 'message', 'Your appointment ' || a.reference_no || ' starts soon.'),
         a.start_at - interval '24 hours'
    from public.appointments a
   where a.status = 'Confirmed'
     and a.start_at between p_now and p_now + interval '25 hours'
     and not exists (select 1 from public.notification_outbox n where n.appointment_id = a.id and n.kind = 'reminder');

  return v_cancelled + v_no_show_cancelled;
end;
$$;

revoke all on function public.run_appointment_maintenance(timestamptz) from public;
grant execute on function public.run_appointment_maintenance(timestamptz) to service_role;

commit;
