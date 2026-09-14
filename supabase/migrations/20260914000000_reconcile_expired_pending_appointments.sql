begin;

-- Let an authenticated dashboard load repair overdue pending requests even
-- when the scheduled maintenance worker is unavailable. The status trigger
-- remains responsible for creating the customer notification and mail job.
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

  select p.role
    into v_role
    from public.profiles p
   where p.id = v_user_id
     and p.is_active = true;

  if not found then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  update public.appointments
     set status = 'Cancelled'
   where status = 'Pending'
     and start_at < now() - interval '15 minutes'
     and (v_role in ('staff', 'admin') or customer_id = v_user_id);
  get diagnostics v_cancelled = row_count;

  return v_cancelled;
end;
$$;

revoke all on function public.reconcile_expired_pending_appointments() from public, anon, service_role;
grant execute on function public.reconcile_expired_pending_appointments() to authenticated;

commit;
