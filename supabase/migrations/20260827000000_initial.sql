-- LuxeGlow canonical Supabase schema.
-- Apply with `supabase db push` (or paste into the SQL editor) before cutover.
-- All appointment times are entered as Asia/Manila wall-clock values and are
-- stored as timestamptz for unambiguous comparisons and reminders.

begin;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  create type public.app_role as enum ('customer', 'staff', 'admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  username text unique,
  role public.app_role not null default 'customer',
  is_active boolean not null default true,
  legacy_customer_id bigint unique,
  legacy_staff_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_format check (position('@' in email) > 1),
  constraint profiles_name_length check (char_length(first_name) <= 100 and char_length(last_name) <= 100),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 50)
);

create index if not exists profiles_role_active_idx on public.profiles(role, is_active);

-- Populated by the migration operator after provisioning Auth users through
-- the Supabase Auth Admin API. It is never readable by browser roles.
create table if not exists public.legacy_identity_map (
  legacy_kind text not null check (legacy_kind in ('customer', 'staff')),
  legacy_id bigint not null,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (legacy_kind, legacy_id)
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'admin') and is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.prevent_customer_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Staff may manage appointments/catalog content, but cannot promote
  -- themselves (or another staff member) to admin. The service role is used
  -- only by the audited import/invite boundaries.
  if old.role is distinct from new.role
     and not public.is_admin()
     and coalesce(auth.role(), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    new.role := old.role;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_customer_role_escalation() from public;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
for each row execute function public.prevent_customer_role_escalation();

create or replace function public.prevent_customer_identity_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    new.email := old.email;
    new.legacy_customer_id := old.legacy_customer_id;
    new.legacy_staff_id := old.legacy_staff_id;
    new.username := old.username;
    if not public.is_admin() then
      new.is_active := old.is_active;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_customer_identity_changes() from public;

drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity before update on public.profiles
for each row execute function public.prevent_customer_identity_changes();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone)
  values (
    new.id,
    lower(trim(new.email)),
    left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 100),
    left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 100),
    left(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), 50)
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.services (
  id text primary key,
  name text not null,
  category text not null,
  description text,
  price numeric(10,2) not null,
  duration_minutes integer not null,
  rating numeric(2,1) not null default 0,
  image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_id_format check (id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,49}$'),
  constraint services_price_nonnegative check (price >= 0),
  constraint services_duration_positive check (duration_minutes between 5 and 1440),
  constraint services_rating_range check (rating between 0 and 5)
);

create index if not exists services_active_name_idx on public.services(is_active, name);
drop trigger if exists services_touch_updated_at on public.services;
create trigger services_touch_updated_at before update on public.services
for each row execute function public.touch_updated_at();

revoke all on function public.touch_updated_at() from public;

create table if not exists public.about_content (
  id integer generated by default as identity primary key,
  business_name text not null default 'Astrid Nails & Beauty Bar',
  description text,
  mission_statement text,
  phone text,
  email text,
  address text,
  business_hours text,
  salon_policies text,
  updated_at timestamptz not null default now()
);

create table if not exists public.faqs (
  id bigint generated by default as identity primary key,
  question text not null,
  answer text not null,
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint faqs_order_nonnegative check (display_order >= 0)
);

create index if not exists faqs_published_order_idx on public.faqs(is_published, display_order, id);
drop trigger if exists faqs_touch_updated_at on public.faqs;
create trigger faqs_touch_updated_at before update on public.faqs
for each row execute function public.touch_updated_at();

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  local_date date not null,
  local_time time not null,
  start_at timestamptz not null,
  total_duration_minutes integer not null,
  total_price numeric(10,2) not null,
  status text not null default 'Pending',
  legacy_appointment_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_status_check check (status in ('Pending', 'Confirmed', 'Completed', 'Cancelled')),
  constraint appointments_duration_check check (total_duration_minutes between 5 and 1440),
  constraint appointments_price_check check (total_price >= 0),
  constraint appointments_timezone_consistency check (start_at = ((local_date + local_time) at time zone 'Asia/Manila'))
);

create index if not exists appointments_customer_date_idx on public.appointments(customer_id, local_date desc, local_time desc);
create index if not exists appointments_status_start_idx on public.appointments(status, start_at);
drop trigger if exists appointments_touch_updated_at on public.appointments;
create trigger appointments_touch_updated_at before update on public.appointments
for each row execute function public.touch_updated_at();

-- Browser staff can transition a booking through its allowed lifecycle, but
-- cannot rewrite ownership, time, duration, price, or historical references.
-- The reschedule RPC below sets a transaction-local marker for its two time
-- fields after performing its own overlap checks.
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
     and old.status in ('Completed', 'Cancelled') and old.status is distinct from new.status then
    raise exception 'A completed or cancelled appointment cannot be reopened';
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
drop trigger if exists appointments_protect_fields on public.appointments;
create trigger appointments_protect_fields before update on public.appointments
for each row execute function public.protect_appointment_fields();

create or replace function public.make_booking_range(start_at timestamptz, duration_mins integer)
returns tstzrange language sql immutable as $$
  select tstzrange(start_at, start_at + (duration_mins * interval '1 minute'), '[)');
$$;

alter table public.appointments
  add column if not exists booking_range tstzrange
  generated always as (public.make_booking_range(start_at, total_duration_minutes)) stored;

do $$
begin
  alter table public.appointments add constraint appointments_no_overlap
    exclude using gist (booking_range with &&)
    where (status in ('Pending', 'Confirmed'));
exception when duplicate_object then null;
end $$;

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_date date,
  p_time time
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments;
  v_start timestamptz;
begin
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  if p_date is null or p_time is null or p_date < (now() at time zone 'Asia/Manila')::date
     or p_date > ((now() at time zone 'Asia/Manila')::date + 60)
     or extract(second from p_time) <> 0
     or extract(minute from p_time)::integer % 30 <> 0 then
    raise exception 'Choose a valid future 30-minute slot';
  end if;
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found or v_appointment.status in ('Completed', 'Cancelled') then
    raise exception 'That appointment cannot be rescheduled';
  end if;
  if (extract(isodow from p_date) = 7 and (p_time < time '11:00' or p_time >= time '18:00'))
     or (extract(isodow from p_date) <> 7 and (p_time < time '10:00' or p_time >= time '20:00')) then
    raise exception 'Outside salon hours';
  end if;
  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  if v_start < now() then raise exception 'That time has already passed'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_date::text, 19071990));
  if exists (
    select 1 from public.appointments a
     where a.id <> v_appointment.id and a.status in ('Pending', 'Confirmed')
       and a.booking_range && tstzrange(v_start, v_start + make_interval(mins => v_appointment.total_duration_minutes), '[)')
  ) then
    raise exception 'That time is no longer available' using errcode = '23P01';
  end if;
  perform set_config('app.allow_appointment_reschedule', 'true', true);
  update public.appointments
     set local_date = p_date, local_time = p_time, start_at = v_start
   where id = v_appointment.id
   returning * into v_appointment;
  return v_appointment;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;

revoke all on function public.reschedule_appointment(uuid, date, time) from public;
grant execute on function public.reschedule_appointment(uuid, date, time) to authenticated;

create table if not exists public.appointment_services (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id text not null references public.services(id) on delete restrict,
  service_name text not null,
  unit_price numeric(10,2) not null,
  duration_minutes integer not null,
  primary key (appointment_id, service_id),
  constraint appointment_services_price_check check (unit_price >= 0),
  constraint appointment_services_duration_check check (duration_minutes > 0)
);
create index if not exists appointment_services_service_idx on public.appointment_services(service_id);

create table if not exists public.user_notifications (
  id bigint generated by default as identity primary key,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (appointment_id, type),
  constraint user_notifications_type_check check (type in ('pending', 'confirmed', 'reminder', 'cancelled', 'completed', 'system'))
);
create index if not exists user_notifications_customer_idx on public.user_notifications(customer_id, created_at desc);

-- Customers may acknowledge a notification, but cannot rewrite its recipient,
-- appointment, type, message, or timestamp from the browser.
create or replace function public.protect_notification_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.customer_id is distinct from new.customer_id
     or old.appointment_id is distinct from new.appointment_id
     or old.type is distinct from new.type
     or old.title is distinct from new.title
     or old.message is distinct from new.message
     or old.created_at is distinct from new.created_at then
    raise exception 'Notification details are immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_notification_fields() from public;
drop trigger if exists user_notifications_protect_fields on public.user_notifications;
create trigger user_notifications_protect_fields before update on public.user_notifications
for each row execute function public.protect_notification_fields();

create table if not exists public.notification_outbox (
  id bigint generated by default as identity primary key,
  appointment_id uuid references public.appointments(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  constraint notification_outbox_kind_check check (kind in ('pending', 'confirmed', 'reminder', 'cancelled', 'completed'))
);
create unique index if not exists notification_outbox_once_idx
  on public.notification_outbox(appointment_id, kind);
create index if not exists notification_outbox_claim_idx
  on public.notification_outbox(available_at, id) where sent_at is null;

create table if not exists public.appointment_notification_log (
  id bigint generated by default as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null check (kind in ('pending', 'confirmed', 'reminder', 'cancelled', 'completed')),
  sent_at timestamptz not null,
  legacy_id bigint,
  unique (appointment_id, kind)
);

create table if not exists public.reviews (
  id bigint generated by default as identity primary key,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  rating integer not null,
  review_text text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_text_length check (review_text is null or char_length(review_text) <= 2000)
);
create index if not exists reviews_published_created_idx on public.reviews(is_published, created_at desc);

create or replace function public.protect_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.customer_id is distinct from new.customer_id
     or old.appointment_id is distinct from new.appointment_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Review ownership is immutable';
  end if;
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    new.is_published := old.is_published;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_review_fields() from public;
drop trigger if exists reviews_protect_fields on public.reviews;
create trigger reviews_protect_fields before update on public.reviews
for each row execute function public.protect_review_fields();

-- This view exposes only the privacy-safe fields needed by the public review
-- carousel. It avoids granting anonymous users access to profile email/phone.
create or replace view public.published_reviews as
select r.id as review_id, r.rating, r.review_text, r.created_at,
       coalesce(nullif(trim(p.first_name || ' ' || left(p.last_name, 1) || '.'), '.'), 'Valued Customer') as customer_name,
       coalesce(string_agg(distinct aps.service_name, ', ' order by aps.service_name), 'Beauty Service') as service_names
  from public.reviews r
  join public.profiles p on p.id = r.customer_id
  left join public.appointment_services aps on aps.appointment_id = r.appointment_id
 where r.is_published
 group by r.id, r.rating, r.review_text, r.created_at, p.first_name, p.last_name;
grant select on public.published_reviews to anon, authenticated;

create or replace function public.notification_for_status(p_status text)
returns text language sql immutable as $$
  select case p_status
    when 'Pending' then 'pending'
    when 'Confirmed' then 'confirmed'
    when 'Completed' then 'completed'
    when 'Cancelled' then 'cancelled'
  end;
$$;

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
begin
  -- Historical imports run in a postgres/supabase_admin session and insert
  -- their own notification history. Do not create live mail jobs for those
  -- rows; normal browser RPCs and service-role workers use authenticator
  -- sessions and continue through this trigger.
  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    v_type := public.notification_for_status(new.status);
    if v_type is null then return new; end if;
    v_title := case v_type
      when 'pending' then 'Booking request received'
      when 'confirmed' then 'Appointment confirmed'
      when 'completed' then 'Thanks for visiting'
      else 'Appointment cancelled'
    end;
    v_message := case v_type
      when 'pending' then 'Your appointment request ' || new.reference_no || ' is waiting for salon confirmation.'
      when 'confirmed' then 'Your appointment ' || new.reference_no || ' has been confirmed.'
      when 'completed' then 'Your visit ' || new.reference_no || ' is complete. We would love your feedback.'
      else 'Your appointment ' || new.reference_no || ' has been cancelled.'
    end;
    insert into public.user_notifications(customer_id, appointment_id, type, title, message)
    values (new.customer_id, new.id, v_type, v_title, v_message)
    on conflict do nothing;
    insert into public.notification_outbox(appointment_id, recipient_id, kind, payload)
    values (new.id, new.customer_id, v_type, jsonb_build_object('reference_no', new.reference_no, 'title', v_title, 'message', v_message))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_enqueue_notification on public.appointments;
create trigger appointments_enqueue_notification after insert or update of status on public.appointments
for each row execute function public.enqueue_appointment_notification();

revoke all on function public.enqueue_appointment_notification() from public;

create or replace function public.book_appointment(
  p_service_ids text[],
  p_date date,
  p_time time
)
returns table (appointment_id uuid, reference_no text, total_price numeric, total_duration_minutes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_appointment_id uuid;
  v_reference text;
  v_total numeric(10,2);
  v_duration integer;
  v_service_count integer;
  v_start timestamptz;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_user and role = 'customer' and is_active) then
    raise exception 'Only active customer accounts can book' using errcode = '42501';
  end if;
  if p_date is null or p_time is null or p_date < (now() at time zone 'Asia/Manila')::date
     or p_date > ((now() at time zone 'Asia/Manila')::date + 60) then
    raise exception 'Date must be within the next 60 days';
  end if;
  if p_time < time '09:00' or p_time >= time '20:00' then raise exception 'Outside salon hours'; end if;
  if p_service_ids is null or cardinality(p_service_ids) not between 1 and 8 then
    raise exception 'Select between one and eight services';
  end if;

  -- Serialize attempts on the same Manila date before checking the exclusion constraint.
  perform pg_advisory_xact_lock(hashtextextended(p_date::text, 19071990));
  select count(*), coalesce(sum(price), 0), coalesce(sum(duration_minutes), 0)
    into v_service_count, v_total, v_duration
    from public.services
   where id = any(p_service_ids) and is_active;
  if v_service_count <> cardinality(p_service_ids) then raise exception 'One or more services are unavailable'; end if;
  if v_duration > 600 then raise exception 'The selected services exceed the daily booking limit'; end if;

  v_start := (p_date + p_time) at time zone 'Asia/Manila';
  if extract(isodow from p_date) = 7 and p_time + make_interval(mins => v_duration) > time '18:00' then
    raise exception 'The selected services do not fit within Sunday hours';
  elsif extract(isodow from p_date) <> 7 and p_time + make_interval(mins => v_duration) > time '20:00' then
    raise exception 'The selected services do not fit within salon hours';
  end if;
  if v_start < now() then raise exception 'That time has already passed'; end if;
  if exists (select 1 from public.appointments where status in ('Pending', 'Confirmed') and booking_range && tstzrange(v_start, v_start + make_interval(mins => v_duration), '[)')) then
    raise exception 'That time is no longer available' using errcode = '23P01';
  end if;

  loop
    v_reference := 'LX-' || to_char(p_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.appointments(reference_no, customer_id, local_date, local_time, start_at, total_duration_minutes, total_price)
    values (v_reference, v_user, p_date, p_time, v_start, v_duration, v_total)
    on conflict (reference_no) do nothing
    returning id into v_appointment_id;
    exit when v_appointment_id is not null;
  end loop;
  insert into public.appointment_services(appointment_id, service_id, service_name, unit_price, duration_minutes)
    select v_appointment_id, id, name, price, duration_minutes from public.services where id = any(p_service_ids) and is_active;
  return query select v_appointment_id, v_reference, v_total, v_duration;
exception when exclusion_violation then
  raise exception 'That time is no longer available' using errcode = '23P01';
end;
$$;

revoke all on function public.book_appointment(text[], date, time) from public;
grant execute on function public.book_appointment(text[], date, time) to authenticated;

create or replace function public.get_available_slots(p_date date, p_duration_minutes integer)
returns table (slot_time text, available boolean)
language sql
security definer
set search_path = public
as $$
  with bounds as (
    select case when extract(isodow from p_date) = 7 then time '11:00' else time '10:00' end as open_at,
           case when extract(isodow from p_date) = 7 then time '18:00' else time '20:00' end as close_at
  ), slots as (
    select g::time as slot_time from bounds, generate_series(
      p_date + open_at,
      p_date + close_at - make_interval(mins => greatest(coalesce(p_duration_minutes, 0), 1)),
      interval '30 minutes'
    ) g
  )
  select to_char(slot_time, 'HH12:MI AM'), not exists (
    select 1 from public.appointments a
    where a.status in ('Pending', 'Confirmed')
      and a.booking_range && tstzrange((p_date + slot_time) at time zone 'Asia/Manila', ((p_date + slot_time) at time zone 'Asia/Manila') + make_interval(mins => greatest(coalesce(p_duration_minutes, 1), 1)), '[)')
  )
  from slots
  where (p_date + slot_time) at time zone 'Asia/Manila' >= now()
  order by slot_time;
$$;

revoke all on function public.get_available_slots(date, integer) from public;
grant execute on function public.get_available_slots(date, integer) to anon, authenticated;

create or replace function public.claim_notification_outbox(p_limit integer default 25)
returns setof public.notification_outbox
language sql
security definer
set search_path = public
as $$
  update public.notification_outbox n
     set claimed_at = now(), attempts = attempts + 1
   where n.id in (
     select id from public.notification_outbox
      where sent_at is null and available_at <= now()
        and (claimed_at is null or claimed_at < now() - interval '10 minutes')
      order by id for update skip locked limit least(greatest(coalesce(p_limit, 25), 1), 100)
   )
  returning n.*;
$$;

revoke all on function public.claim_notification_outbox(integer) from public;
grant execute on function public.claim_notification_outbox(integer) to service_role;

create or replace function public.run_appointment_maintenance(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled integer := 0;
begin
  -- Pending requests are automatically cancelled 15 minutes after their
  -- Manila-local start. The update trigger creates the customer notice and
  -- email outbox record atomically with the status transition.
  update public.appointments
     set status = 'Cancelled'
   where status = 'Pending' and start_at < p_now - interval '15 minutes';
  get diagnostics v_cancelled = row_count;

  -- One reminder per confirmed appointment, generated in the database so a
  -- scheduler retry cannot create duplicate mail jobs.
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
  return v_cancelled;
end;
$$;

revoke all on function public.run_appointment_maintenance(timestamptz) from public;
grant execute on function public.run_appointment_maintenance(timestamptz) to service_role;

alter table public.profiles enable row level security;
alter table public.legacy_identity_map enable row level security;
alter table public.services enable row level security;
alter table public.about_content enable row level security;
alter table public.faqs enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;
alter table public.user_notifications enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.appointment_notification_log enable row level security;
alter table public.reviews enable row level security;
revoke all on public.legacy_identity_map from anon, authenticated;
revoke all on public.notification_outbox from anon, authenticated;
revoke all on public.appointment_notification_log from anon, authenticated;

-- Keep table privileges explicit; RLS remains the row-level authorization
-- boundary. The service role is restricted to server/import workers.
revoke all on public.profiles, public.legacy_identity_map, public.services,
  public.about_content, public.faqs, public.appointments, public.appointment_services,
  public.user_notifications, public.notification_outbox,
  public.appointment_notification_log, public.reviews from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.services, public.about_content, public.faqs to anon, authenticated;
grant select on public.published_reviews to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.appointments to authenticated;
grant select on public.appointment_services to authenticated;
grant select, update (is_read) on public.user_notifications to authenticated;
grant select, insert, update on public.reviews to authenticated;
grant insert, update, delete on public.services, public.about_content, public.faqs to authenticated;
grant all on public.profiles, public.services, public.about_content, public.faqs,
  public.appointments, public.appointment_services, public.user_notifications,
  public.notification_outbox, public.appointment_notification_log, public.reviews,
  public.legacy_identity_map to service_role;
grant all on all sequences in schema public to service_role;
revoke update on public.user_notifications from authenticated;
grant update (is_read) on public.user_notifications to authenticated;

drop policy if exists profiles_select_self_or_staff on public.profiles;
create policy profiles_select_self_or_staff on public.profiles for select to authenticated
using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_staff_update_contacts on public.profiles;
create policy profiles_staff_update_contacts on public.profiles for update to authenticated
using (public.is_staff()) with check (public.is_staff());
drop policy if exists profiles_staff_manage on public.profiles;
create policy profiles_staff_manage on public.profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services for select to anon, authenticated using (is_active or public.is_staff());
drop policy if exists services_staff_write on public.services;
create policy services_staff_write on public.services for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists about_public_read on public.about_content;
create policy about_public_read on public.about_content for select to anon, authenticated using (true);
drop policy if exists about_staff_write on public.about_content;
create policy about_staff_write on public.about_content for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists faqs_public_read on public.faqs;
create policy faqs_public_read on public.faqs for select to anon, authenticated using (is_published or public.is_staff());
drop policy if exists faqs_staff_write on public.faqs;
create policy faqs_staff_write on public.faqs for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists appointments_customer_read on public.appointments;
create policy appointments_customer_read on public.appointments for select to authenticated using (customer_id = auth.uid() or public.is_staff());
drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists appointment_services_read on public.appointment_services;
create policy appointment_services_read on public.appointment_services for select to authenticated using (
  exists (select 1 from public.appointments a where a.id = appointment_id and (a.customer_id = auth.uid() or public.is_staff()))
);

drop policy if exists notifications_customer_read on public.user_notifications;
create policy notifications_customer_read on public.user_notifications for select to authenticated using (customer_id = auth.uid() or public.is_staff());
drop policy if exists notifications_customer_update on public.user_notifications;
create policy notifications_customer_update on public.user_notifications for update to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- The public site reads the privacy-safe published_reviews view. Do not expose
-- base review rows (customer/appointment UUIDs) to anonymous clients.
drop policy if exists reviews_public_read on public.reviews;
drop policy if exists reviews_owner_or_staff_read on public.reviews;
create policy reviews_owner_or_staff_read on public.reviews for select to authenticated
using (customer_id = auth.uid() or public.is_staff());
drop policy if exists reviews_customer_insert on public.reviews;
create policy reviews_customer_insert on public.reviews for insert to authenticated with check (
  customer_id = auth.uid() and exists (
    select 1 from public.appointments a where a.id = appointment_id and a.customer_id = auth.uid() and a.status = 'Completed'
  )
);
drop policy if exists reviews_customer_update on public.reviews;
create policy reviews_customer_update on public.reviews for update to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());
drop policy if exists reviews_staff_manage on public.reviews;
create policy reviews_staff_manage on public.reviews for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Public service-image reads are intentional; writes remain staff-only. Upload
-- clients must still validate type and size before calling storage.from().upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-images', 'service-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists service_images_public_read on storage.objects;
create policy service_images_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'service-images');
drop policy if exists service_images_staff_insert on storage.objects;
create policy service_images_staff_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'service-images' and public.is_staff()
  and exists (select 1 from public.services s where s.id = split_part(name, '/', 1))
);
drop policy if exists service_images_staff_update on storage.objects;
create policy service_images_staff_update on storage.objects for update to authenticated
using (bucket_id = 'service-images' and public.is_staff())
with check (bucket_id = 'service-images' and public.is_staff()
  and exists (select 1 from public.services s where s.id = split_part(name, '/', 1)));
drop policy if exists service_images_staff_delete on storage.objects;
create policy service_images_staff_delete on storage.objects for delete to authenticated using (bucket_id = 'service-images' and public.is_staff());

commit;
