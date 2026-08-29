-- Astrid Nails & Beauty Bar service catalog schema expansion.
-- This migration is additive: the new columns and constraints are retained
-- for historical rows and appointment references. If recovery is needed,
-- use a reviewed forward migration; do not drop these columns in place.

begin;

alter table public.services
  add column if not exists subcategory text not null default 'General',
  add column if not exists display_order integer not null default 0,
  add column if not exists item_type text not null default 'service';

do $$
begin
  alter table public.services add constraint services_subcategory_length
    check (char_length(subcategory) between 1 and 100);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.services add constraint services_display_order_nonnegative
    check (display_order >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.services add constraint services_item_type_check
    check (item_type in ('service', 'package', 'add_on'));
exception when duplicate_object then null;
end $$;

commit;
