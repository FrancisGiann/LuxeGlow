-- Astrid Nails & Beauty Bar service catalog reconciliation.
-- Operational note: duration_minutes are user-approved estimates based on
-- comparable salon listings. Salon staff should confirm and edit them before
-- relying on packages, extensions, lashes, or signature treatments for live
-- scheduling.
--
-- Deployment order: apply the additive schema migration first, then this
-- catalog data migration, then deploy the frontend. The old frontend remains
-- compatible after the additive schema migration because it reads existing
-- service columns and ignores the new metadata.
--
-- Rollback/recovery is forward-only: reactivate reviewed rows from a backup
-- with a new migration if needed. Never delete historical service rows.

begin;

-- Deactivation is intentional: appointment_services retains service_id with
-- ON DELETE RESTRICT, and its name/price/duration columns preserve history.
update public.services
   set is_active = false, updated_at = now();

insert into public.services
  (id, name, category, subcategory, description, price, duration_minutes, rating, image_path, is_active, display_order, item_type)
values
  ('package-1', 'Package 1', 'Packages', 'Fixed packages', 'Maniclean + Pediclean + Astrid’s Signature Footspa', 580, 135, 0, null, true, 1, 'package'),
  ('package-2', 'Package 2', 'Packages', 'Fixed packages', 'Package 1 + 30-minute Foot Massage', 820, 165, 0, null, true, 2, 'package'),
  ('package-3', 'Package 3', 'Packages', 'Fixed packages', 'Package 1 + Paraffin Foot', 980, 165, 0, null, true, 3, 'package'),
  ('package-4', 'Package 4', 'Packages', 'Fixed packages', 'Gel Manicure + Pediclean + Astrid’s Signature Footspa', 940, 165, 0, null, true, 4, 'package'),
  ('package-5', 'Package 5', 'Packages', 'Fixed packages', 'Gel Manicure + Gel Pedicure + Astrid’s Signature Footspa', 1600, 180, 0, null, true, 5, 'package'),
  ('package-6', 'Package 6', 'Packages', 'Fixed packages', 'Gel Manicure + Pediclean + Signature Footspa + Classic Eyelash Extension', 1420, 285, 0, null, true, 6, 'package'),
  ('nail-care-manicure-regular', 'Manicure (with regular polish)', 'Nails', 'Nail care', null, 140, 45, 0, null, true, 7, 'service'),
  ('nail-care-pedicure-regular', 'Pedicure (with regular polish)', 'Nails', 'Nail care', null, 160, 60, 0, null, true, 8, 'service'),
  ('nail-gel-manicure', 'Manicure Gel', 'Nails', 'Gel polish', null, 500, 60, 0, null, true, 9, 'service'),
  ('nail-gel-pedicure', 'Pedicure Gel', 'Nails', 'Gel polish', null, 550, 60, 0, null, true, 10, 'service'),
  ('nail-extension-softgel', 'Softgel Extensions', 'Nails', 'Nail extensions', null, 999, 120, 0, null, true, 11, 'service'),
  ('nail-extension-polygel', 'Polygel Extensions', 'Nails', 'Nail extensions', null, 1200, 150, 0, null, true, 12, 'service'),
  ('nail-extension-builder-gel', 'Builder Gel Extensions', 'Nails', 'Nail extensions', null, 1500, 120, 0, null, true, 13, 'service'),
  ('nail-extension-acrylic', 'Acrylic Extensions', 'Nails', 'Nail extensions', null, 1700, 120, 0, null, true, 14, 'service'),
  ('nail-removal-gel-polish', 'Gel Polish Removal (with cleaning)', 'Nails', 'Removal', null, 150, 30, 0, null, true, 15, 'service'),
  ('nail-removal-extensions', 'Nail Extensions Removal (with cleaning)', 'Nails', 'Removal', null, 350, 60, 0, null, true, 16, 'service'),
  ('nail-addon-rhinestones', 'Rhinestones', 'Nails', 'Nail add-ons', 'Add-on', 70, 20, 0, null, true, 17, 'add_on'),
  ('nail-addon-charms', 'Charms', 'Nails', 'Nail add-ons', 'Add-on', 50, 15, 0, null, true, 18, 'add_on'),
  ('nail-addon-magnetic', 'Magnetic', 'Nails', 'Nail add-ons', 'Add-on', 100, 30, 0, null, true, 19, 'add_on'),
  ('nail-addon-chrome', 'Chrome', 'Nails', 'Nail add-ons', 'Add-on', 150, 20, 0, null, true, 20, 'add_on'),
  ('nail-addon-ombre', 'Ombre', 'Nails', 'Nail add-ons', 'Add-on', 200, 30, 0, null, true, 21, 'add_on'),
  ('nail-addon-french-tips', 'French Tips', 'Nails', 'Nail add-ons', 'Add-on', 100, 30, 0, null, true, 22, 'add_on'),
  ('nail-addon-art', 'Nail Art', 'Nails', 'Nail add-ons', 'Add-on', 200, 45, 0, null, true, 23, 'add_on'),
  ('spa-massage-hand', 'Hand Massage', 'Spa & Massage', 'Massage', null, 150, 30, 0, null, true, 24, 'service'),
  ('spa-massage-foot', 'Foot Massage', 'Spa & Massage', 'Massage', null, 250, 30, 0, null, true, 25, 'service'),
  ('spa-massage-full-body', 'Full Body Massage', 'Spa & Massage', 'Massage', null, 550, 60, 0, null, true, 26, 'service'),
  ('spa-treatment-hand', 'Hand Spa', 'Spa & Massage', 'Spa treatments', null, 250, 30, 0, null, true, 27, 'service'),
  ('spa-treatment-regular-footspa', 'Regular Footspa', 'Spa & Massage', 'Spa treatments', null, 350, 45, 0, null, true, 28, 'service'),
  ('spa-treatment-signature-hand', 'Astrid Signature Hand Spa', 'Spa & Massage', 'Spa treatments', null, 350, 45, 0, null, true, 29, 'service'),
  ('spa-treatment-signature-foot', 'Astrid Signature Footspa', 'Spa & Massage', 'Spa treatments', null, 450, 60, 0, null, true, 30, 'service'),
  ('spa-treatment-paraffin-hand', 'Paraffin Hand', 'Spa & Massage', 'Spa treatments', null, 350, 30, 0, null, true, 31, 'service'),
  ('spa-treatment-paraffin-foot', 'Paraffin Foot', 'Spa & Massage', 'Spa treatments', null, 400, 30, 0, null, true, 32, 'service'),
  ('lash-brow-lamination', 'Brow Lamination', 'Brows & Lashes', 'Brows & lashes', null, 450, 60, 0, null, true, 33, 'service'),
  ('lash-perm-tint', 'Lash Perm with Tint', 'Brows & Lashes', 'Brows & lashes', null, 450, 75, 0, null, true, 34, 'service'),
  ('lash-classic-eyelash', 'Classic Eyelash', 'Brows & Lashes', 'Brows & lashes', null, 500, 120, 0, null, true, 35, 'service'),
  ('lash-5d-natural', '5D Natural', 'Brows & Lashes', 'Brows & lashes', null, 550, 150, 0, null, true, 36, 'service'),
  ('lash-5d-cat-eye', '5D Cat Eye', 'Brows & Lashes', 'Brows & lashes', null, 600, 150, 0, null, true, 37, 'service'),
  ('lash-wispy', 'Wispy', 'Brows & Lashes', 'Brows & lashes', null, 700, 150, 0, null, true, 38, 'service'),
  ('lash-removal', 'Lash Removal', 'Brows & Lashes', 'Brows & lashes', null, 150, 30, 0, null, true, 39, 'service'),
  ('wax-eyebrow', 'Eyebrow Waxing', 'Waxing', 'Wax hair removal', null, 150, 15, 0, null, true, 40, 'service'),
  ('wax-eyebrow-threading', 'Eyebrow Threading', 'Waxing', 'Wax hair removal', null, 120, 15, 0, null, true, 41, 'service'),
  ('wax-upper-lip', 'Upper Lip', 'Waxing', 'Wax hair removal', null, 150, 15, 0, null, true, 42, 'service'),
  ('wax-underarm', 'Underarm', 'Waxing', 'Wax hair removal', null, 200, 20, 0, null, true, 43, 'service'),
  ('wax-underarm-whitening', 'Underarm with Whitening', 'Waxing', 'Wax hair removal', null, 450, 30, 0, null, true, 44, 'service'),
  ('wax-full-arm', 'Full Arm', 'Waxing', 'Wax hair removal', null, 300, 45, 0, null, true, 45, 'service'),
  ('wax-half-leg', 'Half Leg', 'Waxing', 'Wax hair removal', null, 350, 45, 0, null, true, 46, 'service'),
  ('wax-full-leg', 'Full Leg', 'Waxing', 'Wax hair removal', null, 450, 60, 0, null, true, 47, 'service'),
  ('wax-bikini', 'Bikini', 'Waxing', 'Wax hair removal', null, 450, 30, 0, null, true, 48, 'service'),
  ('wax-brazilian', 'Brazilian', 'Waxing', 'Wax hair removal', null, 550, 45, 0, null, true, 49, 'service'),
  ('kids-manicure', 'Kiddie Manicure', 'Kids', 'Kiddie treats', null, 120, 30, 0, null, true, 50, 'service'),
  ('kids-pedicure', 'Kiddie Pedicure', 'Kids', 'Kiddie treats', null, 140, 45, 0, null, true, 51, 'service'),
  ('kids-nail-art', 'Kiddie Nail Art', 'Kids', 'Kiddie treats', null, 100, 30, 0, null, true, 52, 'service'),
  ('kids-hand-spa', 'Kiddie Hand Spa', 'Kids', 'Kiddie treats', null, 150, 30, 0, null, true, 53, 'service'),
  ('kids-footspa', 'Kiddie Footspa', 'Kids', 'Kiddie treats', null, 200, 45, 0, null, true, 54, 'service')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  subcategory = excluded.subcategory,
  description = excluded.description,
  price = excluded.price,
  duration_minutes = excluded.duration_minutes,
  rating = excluded.rating,
  image_path = excluded.image_path,
  is_active = excluded.is_active,
  display_order = excluded.display_order,
  item_type = excluded.item_type;

do $$
declare
  active_count integer;
begin
  select count(*) into active_count from public.services where is_active;
  if active_count <> 54 then
    raise exception 'Service catalog reconciliation expected 54 active rows, found %', active_count;
  end if;
end $$;

commit;
