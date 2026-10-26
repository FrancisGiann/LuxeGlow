-- Synthetic minimal dependencies for the repository's unmodified booking RPCs.
create extension btree_gist;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.customer_id', true), '')::uuid;
$$;
create table profiles (id uuid primary key, role text, is_active boolean);
create table services (id text primary key, name text, price numeric, duration_minutes integer, item_type text, is_active boolean);
create table staff_members (id uuid primary key, full_name text, record_kind text default 'staff', is_active boolean default true, is_bookable boolean default true);
create function make_booking_range(start_at timestamptz, duration_mins integer)
returns tstzrange language sql immutable as $$
  select tstzrange(start_at, start_at + (duration_mins * interval '1 minute'), '[)');
$$;
create table appointments (
 id uuid primary key default gen_random_uuid(), reference_no text constraint appointments_reference_no_key unique,
 customer_id uuid, staff_member_id uuid references staff_members(id), staff_id uuid,
 local_date date, local_time time, start_at timestamptz, total_duration_minutes integer,
 total_price numeric, status text default 'Pending',
 booking_range tstzrange generated always as (make_booking_range(start_at,total_duration_minutes)) stored,
 constraint appointments_staff_member_no_overlap exclude using gist (staff_member_id with =, booking_range with &&)
 where (staff_member_id is not null and status in ('Pending', 'Confirmed'))
);
create table appointment_services (appointment_id uuid, service_id text, service_name text, unit_price numeric, duration_minutes integer);
create function salon_hours_for_date(date) returns table(open_time time,close_time time,is_closed boolean)
language sql stable as $$ select time '10:00', time '20:00', false $$;
insert into profiles values ('00000000-0000-0000-0000-000000000001','customer',true);
insert into services values ('short','Synthetic short',100,30,'service',true), ('long','Synthetic long',200,90,'service',true);
insert into staff_members(id,full_name) values ('00000000-0000-0000-0000-00000000000a','Synthetic A'), ('00000000-0000-0000-0000-00000000000b','Synthetic B');
