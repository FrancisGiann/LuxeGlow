begin;

-- Expose only whether a selected date is closed; opening hours and closure
-- details stay behind the existing staff-only schedule RPCs.
create or replace function public.get_salon_date_status(p_date date)
returns table(is_closed boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_is_closed boolean;
begin
  if p_date is null or p_date < v_today or p_date > v_today + 60 then
    raise exception 'Choose a date within the next 60 days' using errcode = '22023';
  end if;

  select h.is_closed
    into v_is_closed
    from public.salon_hours_for_date(p_date) h;

  return query select coalesce(v_is_closed, true);
end;
$$;

revoke all on function public.get_salon_date_status(date) from public;
grant execute on function public.get_salon_date_status(date) to anon, authenticated;

-- Keep the public carousel limited to its newest twenty cards while its
-- aggregate covers every published review visible through published_reviews.
create or replace function public.get_published_review_stats()
returns table(total_reviews bigint, average_rating numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(r.id)::bigint,
         coalesce(avg(r.rating)::numeric, 0)
    from public.reviews r
   where r.is_published
     and exists (select 1 from public.profiles p where p.id = r.customer_id);
$$;

revoke all on function public.get_published_review_stats() from public;
grant execute on function public.get_published_review_stats() to anon, authenticated;

alter table public.staff_notifications
  drop constraint if exists staff_notifications_type_check;
alter table public.staff_notifications
  add constraint staff_notifications_type_check
  check (type in ('new_booking', 'customer_cancelled'));

create or replace function public.enqueue_customer_cancellation_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only the authenticated customer's explicit cancellation RPC sets this
  -- transaction-local flag. Automatic expiration and staff status changes do
  -- not create customer-cancellation alerts.
  if tg_op <> 'UPDATE'
     or old.status not in ('Pending', 'Confirmed')
     or new.status <> 'Cancelled'
     or current_setting('app.allow_customer_appointment_action', true) is distinct from 'true'
     or auth.uid() is null
     or auth.uid() is distinct from new.customer_id
     or coalesce(auth.role(), '') <> 'authenticated'
     or not exists (
       select 1 from public.profiles p
        where p.id = new.customer_id and p.role = 'customer' and p.is_active
     ) then
    return new;
  end if;

  insert into public.staff_notifications(recipient_id, appointment_id, type, title, message)
  select p.id,
         new.id,
         'customer_cancelled',
         'Customer cancelled an appointment',
         'Appointment ' || coalesce(new.reference_no, '—') || ' was cancelled by the customer.'
           || case when nullif(btrim(new.customer_cancellation_reason), '') is null
                   then ''
                   else ' Reason: ' || btrim(new.customer_cancellation_reason)
              end
    from public.profiles p
   where p.role in ('head', 'admin')
     and p.is_active = true
  on conflict (recipient_id, appointment_id, type) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_customer_cancellation_notifications() from public, anon, authenticated;
drop trigger if exists appointments_enqueue_customer_cancellation_notifications on public.appointments;
create trigger appointments_enqueue_customer_cancellation_notifications
after update of status on public.appointments
for each row execute function public.enqueue_customer_cancellation_notifications();

comment on table public.staff_notifications is 'Per-recipient realtime notifications for customer bookings and explicit customer cancellations';

commit;
