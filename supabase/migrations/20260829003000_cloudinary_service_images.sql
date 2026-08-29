-- Cloudinary metadata for newly uploaded service images.
-- image_path remains the canonical display URL so legacy relative Supabase
-- Storage paths continue to work during and after the migration.

begin;

alter table public.services
  add column if not exists image_public_id text;

do $$
begin
  alter table public.services add constraint services_image_public_id_length
    check (image_public_id is null or char_length(image_public_id) between 1 and 255);
exception when duplicate_object then null;
end $$;

create index if not exists services_image_public_id_idx
  on public.services(image_public_id)
  where image_public_id is not null;

-- Keep service catalog editing available to staff while preventing browser
-- clients from writing image metadata. The upload Edge Function uses the
-- service role for its compare-and-swap update.
revoke insert, update on public.services from authenticated;
grant insert (id, name, category, description, price, duration_minutes, rating,
  is_active, subcategory, display_order, item_type) on public.services to authenticated;
grant update (name, category, description, price, duration_minutes, rating,
  is_active, subcategory, display_order, item_type) on public.services to authenticated;

commit;
