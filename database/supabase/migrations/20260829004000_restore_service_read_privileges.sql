-- Forward-only privilege repair for deployments whose migration history was
-- repaired manually. The Cloudinary metadata migration (03000) is retained;
-- this explicitly restores the intended public read access to services,
-- including rows carrying the new image_public_id column.

begin;

grant select on public.services to anon, authenticated;

commit;
