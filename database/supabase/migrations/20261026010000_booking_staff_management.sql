-- Roster creation is independent from Auth and never changes appointment identities.
begin;

-- New entries use a narrow admin RPC, not arbitrary table inserts.
revoke insert on public.staff_members from authenticated;

create or replace function public.create_booking_staff(p_full_name text, p_position_title text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_title text;
  v_id uuid := gen_random_uuid();
  v_member public.staff_members;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  v_name := btrim(regexp_replace(coalesce(p_full_name, ''), '[[:space:]]+', ' ', 'g'));
  v_title := nullif(btrim(regexp_replace(coalesce(p_position_title, ''), '[[:space:]]+', ' ', 'g')), '');
  if char_length(v_name) not between 1 and 201 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Full name must be 1–201 characters without control characters.' using errcode = '22023';
  end if;
  if v_title is not null and (char_length(v_title) > 100 or v_title ~ '[[:cntrl:]]') then
    raise exception 'Position title must be 100 characters or fewer without control characters.' using errcode = '22023';
  end if;
  insert into public.staff_members (id, roster_key, record_kind, full_name, position_title, is_active, is_bookable)
  values (v_id, 'staff-' || v_id::text, 'staff', v_name, v_title, true, true)
  returning * into v_member;
  return to_jsonb(v_member);
end;
$$;
revoke all on function public.create_booking_staff(text, text) from public, anon;
grant execute on function public.create_booking_staff(text, text) to authenticated;

-- Existing admin-only update RLS governs is_bookable/is_active. No DELETE grant:
-- removal from booking only hides future choices and preserves referenced rows.
commit;
