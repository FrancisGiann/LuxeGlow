-- Run with psql as a controlled migration operator using the service-role DB
-- connection, after identity-map-template.csv has been filled with Auth UUIDs.
-- Example: psql "$SUPABASE_DB_URL" -v export_dir=/secure/luxeglow-export -f import_legacy.sql
-- This file is intentionally not run by the browser or an Edge Function.

\if :{?export_dir}
\else
  \echo 'Pass -v export_dir=/path/to/export'
  \q
\endif

begin;

-- \copy does not interpolate variables in its filename argument. Change the
-- psql client directory first, then use fixed local filenames.
\cd :export_dir

create temporary table import_profiles(kind text, legacy_id bigint, email text, first_name text, last_name text, phone text, username text, legacy_status text, legacy_role text) on commit drop;
create temporary table import_services(id text, name text, category text, description text, price numeric, duration_minutes integer, rating numeric, image_path text) on commit drop;
create temporary table import_about(legacy_id integer, business_name text, description text, mission_statement text, phone text, email text, address text, business_hours text, salon_policies text) on commit drop;
create temporary table import_faqs(legacy_id bigint, question text, answer text, display_order integer) on commit drop;
create temporary table import_appointments(legacy_id text, legacy_customer_id bigint, local_date date, local_time time, total_price numeric, status text, created_at timestamptz) on commit drop;
create temporary table import_appointment_services(legacy_appointment_id text, service_id text) on commit drop;
create temporary table import_user_notifications(legacy_id bigint, legacy_customer_id bigint, legacy_appointment_id text, type text, title text, message text, is_read boolean, created_at timestamptz) on commit drop;
create temporary table import_appointment_notifications(legacy_id bigint, legacy_appointment_id text, type text, sent_at timestamptz) on commit drop;
create temporary table import_reviews(legacy_id bigint, legacy_customer_id bigint, legacy_appointment_id text, rating integer, review_text text, created_at timestamptz) on commit drop;
create temporary table import_identity(legacy_kind text, legacy_id bigint, email text, auth_user_id uuid) on commit drop;

\copy import_profiles from 'profiles.csv' with (format csv, header true)
\copy import_profiles from 'staff.csv' with (format csv, header true)
\copy import_services from 'services.csv' with (format csv, header true)
\copy import_about from 'about_content.csv' with (format csv, header true)
\copy import_faqs from 'faqs.csv' with (format csv, header true)
\copy import_appointments from 'appointments.csv' with (format csv, header true)
\copy import_appointment_services from 'appointment_services.csv' with (format csv, header true)
\copy import_user_notifications from 'user_notifications.csv' with (format csv, header true)
\copy import_appointment_notifications from 'appointment_notifications.csv' with (format csv, header true)
\copy import_reviews from 'reviews.csv' with (format csv, header true)
\copy import_identity from 'identity-map-template.csv' with (format csv, header true)

do $$
begin
  if exists (select 1 from import_identity where auth_user_id is null) then
    raise exception 'identity-map-template.csv contains unmapped users; provision Auth users and fill every auth_user_id first';
  end if;
  if exists (select 1 from import_profiles p left join import_identity m on m.legacy_kind = p.kind and m.legacy_id = p.legacy_id where m.auth_user_id is null) then
    raise exception 'identity-map-template.csv is missing a customer or staff mapping';
  end if;
  if exists (select 1 from import_appointment_services s left join import_services v on v.id = s.service_id where v.id is null) then
    raise exception 'appointment_services.csv references a missing service';
  end if;
  if exists (select 1 from import_appointments a left join import_appointment_services s on s.legacy_appointment_id = a.legacy_id where s.legacy_appointment_id is null) then
    raise exception 'appointments.csv contains a booking without appointment_services rows';
  end if;
  if exists (select 1 from import_reviews r left join import_appointments a on a.legacy_id = r.legacy_appointment_id where a.legacy_id is null) then
    raise exception 'reviews.csv references a missing appointment';
  end if;
  if exists (select 1 from import_appointments a left join import_identity m on m.legacy_kind = 'customer' and m.legacy_id = a.legacy_customer_id where m.auth_user_id is null) then
    raise exception 'appointments.csv references a customer without an identity mapping';
  end if;
  if exists (select 1 from import_appointment_services s left join import_appointments a on a.legacy_id = s.legacy_appointment_id where a.legacy_id is null) then
    raise exception 'appointment_services.csv references a missing appointment';
  end if;
end $$;

insert into public.legacy_identity_map(legacy_kind, legacy_id, auth_user_id, email)
select lower(legacy_kind), legacy_id, auth_user_id, lower(email) from import_identity
on conflict (legacy_kind, legacy_id) do update set auth_user_id = excluded.auth_user_id, email = excluded.email;

insert into public.profiles(id, email, first_name, last_name, phone, username, role, is_active, legacy_customer_id, legacy_staff_id)
select m.auth_user_id, lower(p.email), left(coalesce(p.first_name, ''), 100), left(coalesce(p.last_name, ''), 100), nullif(left(p.phone, 50), ''), nullif(left(p.username, 100), ''),
       case when p.kind = 'staff' and lower(coalesce(p.legacy_role, '')) in ('super admin', 'admin') then 'admin'::public.app_role
            when p.kind = 'staff' then 'staff'::public.app_role else 'customer'::public.app_role end,
       case when p.kind = 'staff' then lower(coalesce(p.legacy_status, '')) = 'active' else true end,
       case when p.kind = 'customer' then p.legacy_id end,
       case when p.kind = 'staff' then p.legacy_id end
  from import_profiles p join import_identity m on m.legacy_kind = p.kind and m.legacy_id = p.legacy_id
on conflict (id) do update set email = excluded.email, first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone, username = excluded.username, role = excluded.role, is_active = excluded.is_active, legacy_customer_id = excluded.legacy_customer_id, legacy_staff_id = excluded.legacy_staff_id;

insert into public.services(id, name, category, description, price, duration_minutes, rating, image_path)
select id, name, category, description, price, duration_minutes, coalesce(rating, 0), nullif(image_path, '') from import_services
on conflict (id) do update set name = excluded.name, category = excluded.category, description = excluded.description, price = excluded.price, duration_minutes = excluded.duration_minutes, rating = excluded.rating, image_path = excluded.image_path;

insert into public.about_content(id, business_name, description, mission_statement, phone, email, address, business_hours, salon_policies)
select legacy_id, business_name, description, mission_statement, phone, email, address, business_hours, salon_policies from import_about
on conflict (id) do update set business_name = excluded.business_name, description = excluded.description, mission_statement = excluded.mission_statement, phone = excluded.phone, email = excluded.email, address = excluded.address, business_hours = excluded.business_hours, salon_policies = excluded.salon_policies;

insert into public.faqs(id, question, answer, display_order)
select legacy_id, question, answer, coalesce(display_order, 0) from import_faqs
on conflict (id) do update set question = excluded.question, answer = excluded.answer, display_order = excluded.display_order;

-- Existing appointments get their original reference and ID in the explicit
-- legacy column. Duration and total are recomputed from the canonical service
-- catalog rather than trusting a client or stale amount.
insert into public.appointments(reference_no, customer_id, local_date, local_time, start_at, total_duration_minutes, total_price, status, legacy_appointment_id, created_at)
select a.legacy_id, m.auth_user_id, a.local_date, a.local_time,
       (a.local_date + a.local_time) at time zone 'Asia/Manila',
       sum(v.duration_minutes), sum(v.price),
       case lower(coalesce(a.status, '')) when 'pending' then 'Pending' when 'confirmed' then 'Confirmed' when 'completed' then 'Completed' when 'cancelled' then 'Cancelled' else 'Cancelled' end,
       a.legacy_id, coalesce(a.created_at, now())
  from import_appointments a
  join import_identity m on m.legacy_kind = 'customer' and m.legacy_id = a.legacy_customer_id
  join import_appointment_services x on x.legacy_appointment_id = a.legacy_id
  join import_services v on v.id = x.service_id
 group by a.legacy_id, m.auth_user_id, a.local_date, a.local_time, a.status, a.created_at
on conflict (legacy_appointment_id) do update set customer_id = excluded.customer_id, local_date = excluded.local_date, local_time = excluded.local_time, start_at = excluded.start_at, total_duration_minutes = excluded.total_duration_minutes, total_price = excluded.total_price, status = excluded.status;

insert into public.appointment_services(appointment_id, service_id, service_name, unit_price, duration_minutes)
select a.id, v.id, v.name, v.price, v.duration_minutes
  from import_appointments old
  join public.appointments a on a.legacy_appointment_id = old.legacy_id
  join import_appointment_services x on x.legacy_appointment_id = old.legacy_id
  join public.services v on v.id = x.service_id
on conflict (appointment_id, service_id) do update set service_name = excluded.service_name, unit_price = excluded.unit_price, duration_minutes = excluded.duration_minutes;

insert into public.user_notifications(id, customer_id, appointment_id, type, title, message, is_read, created_at)
select n.legacy_id, cm.auth_user_id, a.id,
       case when n.type in ('pending', 'confirmed', 'reminder', 'cancelled', 'completed', 'system') then n.type else 'system' end,
       n.title, n.message, coalesce(n.is_read, false), coalesce(n.created_at, now())
  from import_user_notifications n
  join import_identity cm on cm.legacy_kind = 'customer' and cm.legacy_id = n.legacy_customer_id
  left join public.appointments a on a.legacy_appointment_id = n.legacy_appointment_id
on conflict (id) do nothing;

insert into public.appointment_notification_log(id, appointment_id, kind, sent_at, legacy_id)
select n.legacy_id, a.id,
       case when n.type in ('pending', 'confirmed', 'reminder', 'cancelled', 'completed') then n.type else 'cancelled' end,
       coalesce(n.sent_at, now()), n.legacy_id
  from import_appointment_notifications n
  join public.appointments a on a.legacy_appointment_id = n.legacy_appointment_id
on conflict (appointment_id, kind) do nothing;

insert into public.reviews(id, customer_id, appointment_id, rating, review_text, created_at)
select r.legacy_id, cm.auth_user_id, a.id, r.rating, r.review_text, coalesce(r.created_at, now())
  from import_reviews r
  join import_identity cm on cm.legacy_kind = 'customer' and cm.legacy_id = r.legacy_customer_id
  join public.appointments a on a.legacy_appointment_id = r.legacy_appointment_id
on conflict (id) do update set rating = excluded.rating, review_text = excluded.review_text;

-- Sequences must continue after imported explicit IDs.
select setval(pg_get_serial_sequence('public.about_content', 'id'), coalesce((select max(id) from public.about_content), 1), true);
select setval(pg_get_serial_sequence('public.faqs', 'id'), coalesce((select max(id) from public.faqs), 1), true);
select setval(pg_get_serial_sequence('public.reviews', 'id'), coalesce((select max(id) from public.reviews), 1), true);
select setval(pg_get_serial_sequence('public.user_notifications', 'id'), coalesce((select max(id) from public.user_notifications), 1), true);
select setval(pg_get_serial_sequence('public.appointment_notification_log', 'id'), coalesce((select max(id) from public.appointment_notification_log), 1), true);

commit;
