-- Optional canonical content seed for a new project. Run after migrations and
-- before importing MariaDB data; every statement is idempotent.
begin;
insert into public.services(id, name, category, description, price, duration_minutes, rating)
values
  ('gel-polish', 'Gel Polish', 'Nails', 'Long lasting gel polish application', 1500, 60, 4.5),
  ('gentleman-package', 'Gentleman Package', 'Packages', 'Grooming essentials for gentlemen', 1400, 60, 4.5),
  ('kiddie-package', 'Kiddie Package', 'Packages', 'Fun and safe pampering for kids', 700, 30, 4.5),
  ('lash-extension', 'Lash Extension', 'Lashes', 'Volume lashes applied by certified artists', 1800, 60, 5.0),
  ('massage', 'Massage', 'Spa', 'Relaxing therapeutic massage', 350, 30, 4.5),
  ('nail-care', 'Nail Care', 'Nails', 'Basic nail care and grooming', 1500, 45, 4.5),
  ('nail-extension', 'Nail Extensions', 'Nails', 'Beautiful acrylic or gel extensions', 1500, 90, 4.0),
  ('spa-treatment', 'Spa Treatment', 'Spa', 'Relaxing foot and hand spa ritual', 1200, 60, 5.0),
  ('wax-hair-removal', 'Wax Hair Removal', 'Waxing', 'Gentle waxing with premium soft wax', 900, 30, 4.5)
on conflict (id) do update set name = excluded.name, category = excluded.category, description = excluded.description, price = excluded.price, duration_minutes = excluded.duration_minutes, rating = excluded.rating;

insert into public.about_content(id, business_name, description, mission_statement, phone, email, address, business_hours, salon_policies)
values (1, 'Astrid Nails & Beauty Bar', 'A luxury sanctuary dedicated to providing top-notch nail, lash, and spa services in a relaxing, hygienic environment.', 'Our mission is to elevate beauty and self-care by offering personalized, high-quality services that make every client feel refreshed, confident, and pampered.', '0917 000 1122', 'hello@astridnails.ph', '12 Mabini St, Quezon City, Metro Manila', 'Monday – Saturday: 10:00 AM – 8:00 PM\nSunday: 11:00 AM – 6:00 PM', 'Online bookings are held for 15 minutes past the scheduled time — late arrivals may be automatically cancelled.\nKindly cancel or reschedule at least 24 hours in advance by contacting us.\nWalk-ins are welcome subject to availability; online bookings receive priority scheduling.')
on conflict (id) do update set business_name = excluded.business_name, description = excluded.description, mission_statement = excluded.mission_statement, phone = excluded.phone, email = excluded.email, address = excluded.address, business_hours = excluded.business_hours, salon_policies = excluded.salon_policies;

insert into public.faqs(id, question, answer, display_order)
values
  (1, 'What are your operating hours?', 'We are open Monday to Saturday from 10:00 AM to 8:00 PM, and Sundays from 11:00 AM to 6:00 PM.', 1),
  (2, 'What services do you offer?', 'Nail care, gel polish, nail extensions, lash extensions, waxing, spa treatments, massages, and curated kiddie and gentleman packages.', 2),
  (3, 'Are your products safe and hygienic?', 'Yes. All tools are sterilized after every client, single-use items are never reused, and we only use certified, cruelty-free products.', 3),
  (4, 'Do I need to book an appointment?', 'Walk-ins are welcome when slots allow, but booking online guarantees your preferred stylist and time slot.', 4)
on conflict (id) do update set question = excluded.question, answer = excluded.answer, display_order = excluded.display_order;

select setval(pg_get_serial_sequence('public.about_content', 'id'), greatest(coalesce((select max(id) from public.about_content), 1), 1), true);
select setval(pg_get_serial_sequence('public.faqs', 'id'), greatest(coalesce((select max(id) from public.faqs), 1), 1), true);
commit;
