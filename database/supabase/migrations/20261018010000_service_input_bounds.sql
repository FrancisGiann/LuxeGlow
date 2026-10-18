-- Match the existing Admin form bounds at the direct REST write boundary.
-- NOT VALID leaves historical rows untouched; PostgreSQL still checks every new/updated row.
alter table public.services
  add constraint services_name_bounds
  check (char_length(name) between 1 and 255 and name ~ '[^[:space:]]') not valid;
alter table public.services
  add constraint services_price_upper_bound
  check (price <= 1000000) not valid;
