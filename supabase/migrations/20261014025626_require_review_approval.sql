begin;

alter table public.reviews
  alter column is_published set default false;

create or replace function public.protect_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bypass boolean := coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin');
  v_admin boolean := false;
  v_completed boolean := false;
  v_staff_assigned boolean := false;
begin
  if tg_op = 'UPDATE' then
    if old.customer_id is distinct from new.customer_id then
      raise exception 'Review ownership is immutable';
    end if;
    if old.appointment_id is distinct from new.appointment_id then
      raise exception 'Review appointment is immutable';
    end if;
    if old.created_at is distinct from new.created_at then
      raise exception 'Review timestamp is immutable';
    end if;
  end if;

  if not v_bypass then
    v_admin := public.is_admin();
    select exists (
      select 1 from public.appointments a
       where a.id = new.appointment_id and a.customer_id = new.customer_id and a.status = 'Completed'
    ), exists (
      select 1 from public.appointments a where a.id = new.appointment_id and a.staff_id is not null
    ) into v_completed, v_staff_assigned;
    if (tg_op = 'INSERT' or not v_admin) and new.customer_id is distinct from auth.uid() then
      raise exception 'Review ownership is invalid' using errcode = '42501';
    end if;
    if not v_completed then
      raise exception 'Only completed visits can be reviewed' using errcode = '42501';
    end if;

    if tg_op = 'INSERT' or not v_admin then
      if not v_staff_assigned and new.staff_rating is not null then
        raise exception 'Staff rating requires an assigned team member';
      end if;
    elsif new.staff_rating is distinct from old.staff_rating
       and not v_staff_assigned and new.staff_rating is not null then
      raise exception 'Staff rating requires an assigned team member';
    end if;

    -- Customers may submit feedback, but publication is reserved for an admin.
    if tg_op = 'INSERT' and not v_admin then
      new.is_published := false;
    end if;
  end if;

  if not v_admin and not v_bypass and tg_op = 'UPDATE' then
    if new.rating is distinct from old.rating
       or new.staff_rating is distinct from old.staff_rating
       or new.review_text is distinct from old.review_text then
      new.is_published := false;
    else
      new.is_published := old.is_published;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_review_fields() from public;
drop trigger if exists reviews_protect_fields on public.reviews;
create trigger reviews_protect_fields before insert or update on public.reviews
for each row execute function public.protect_review_fields();

comment on column public.reviews.is_published is
  'New customer reviews require administrator approval before public display';

commit;
