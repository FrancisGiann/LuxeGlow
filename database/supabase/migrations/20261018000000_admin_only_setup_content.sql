-- Align setup/content writes with the Admin-only workspace sections.
-- Head retains appointment, history and customer daily-work access.
begin;
alter policy services_staff_write on public.services using (public.is_admin()) with check (public.is_admin());
alter policy about_staff_write on public.about_content using (public.is_admin()) with check (public.is_admin());
alter policy faqs_staff_write on public.faqs using (public.is_admin()) with check (public.is_admin());
alter policy reviews_staff_manage on public.reviews using (public.is_admin()) with check (public.is_admin());
alter policy salon_weekly_hours_staff_write on public.salon_weekly_hours using (public.is_admin()) with check (public.is_admin());
alter policy salon_closures_staff_write on public.salon_closures using (public.is_admin()) with check (public.is_admin());
alter policy service_images_staff_insert on storage.objects with check (
 bucket_id = 'service-images' and public.is_admin()
 and exists (select 1 from public.services s where s.id = split_part(name, '/', 1)));
alter policy service_images_staff_update on storage.objects using (bucket_id = 'service-images' and public.is_admin()) with check (
 bucket_id = 'service-images' and public.is_admin()
 and exists (select 1 from public.services s where s.id = split_part(name, '/', 1)));
alter policy service_images_staff_delete on storage.objects using (bucket_id = 'service-images' and public.is_admin());

-- The schedule RPCs are SECURITY DEFINER and must enforce Admin themselves.
create or replace function public.save_salon_hours(
  p_day_of_week smallint,
  p_open_time time,
  p_close_time time,
  p_is_closed boolean
)
returns public.salon_weekly_hours
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.salon_weekly_hours;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  if p_day_of_week is null or p_day_of_week not between 1 and 7 then
    raise exception 'Choose a valid day';
  end if;
  if p_is_closed is null then
    raise exception 'Choose whether this day is closed';
  end if;
  if p_is_closed and (p_open_time is not null or p_close_time is not null) then
    raise exception 'A closed day cannot have opening hours';
  end if;
  if not p_is_closed and (p_open_time is null or p_close_time is null or p_close_time <= p_open_time) then
    raise exception 'Closing time must be after opening time';
  end if;
  if not p_is_closed and (extract(second from p_open_time) <> 0 or extract(second from p_close_time) <> 0 or extract(minute from p_open_time)::integer % 30 <> 0 or extract(minute from p_close_time)::integer % 30 <> 0) then
    raise exception 'Opening hours must use 30-minute increments';
  end if;
  insert into public.salon_weekly_hours(day_of_week, open_time, close_time, is_closed, updated_at)
  values (p_day_of_week, case when p_is_closed then null else p_open_time end,
          case when p_is_closed then null else p_close_time end, p_is_closed, now())
  on conflict (day_of_week) do update
    set open_time = excluded.open_time, close_time = excluded.close_time,
        is_closed = excluded.is_closed, updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.save_salon_closure(p_closure_date date, p_reason text default null)
returns public.salon_closures
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.salon_closures;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  if p_closure_date is null or p_closure_date < (now() at time zone 'Asia/Manila')::date then
    raise exception 'Closures must be today or in the future';
  end if;
  if p_reason is not null and char_length(trim(p_reason)) > 500 then
    raise exception 'Closure reason is too long';
  end if;
  insert into public.salon_closures(closure_date, reason, updated_at)
  values (p_closure_date, nullif(trim(p_reason), ''), now())
  on conflict (closure_date) do update set reason = excluded.reason, updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_salon_closure(p_closure_date date)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('salon-schedule', 19071990));
  if p_closure_date is null then raise exception 'Choose a closure date'; end if;
  delete from public.salon_closures where closure_date = p_closure_date;
  return found;
end;
$$;
commit;
