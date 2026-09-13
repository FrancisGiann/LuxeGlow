-- Add map embed URL field to about_content
alter table public.about_content
  add column if not exists map_embed_url text;
