-- Correct the canonical public location and service FAQ.
-- This is a forward-only, idempotent content correction for the seeded
-- singleton rows. Reapply the reviewed values with another forward migration
-- if the salon later confirms different public content.

begin;

update public.about_content
   set address = '12 Mabini St, Lucena City, Quezon'
 where id = 1;

update public.faqs
   set answer = 'Nail care, gel polish, nail extensions, nail add-ons, spa and massage treatments, brow and lash services, waxing, kiddie treatments, and packages.'
 where id = 2;

commit;
