-- Prerequisites:
--   * pg_cron and pg_net are enabled in this Supabase project.
--   * Supabase Vault contains:
--       notification_worker_project_url = https://<project-ref>.supabase.co
--       notification_worker_cron_token = the CRON_SECRET_TOKEN Edge Function secret
-- Run this script in the Supabase SQL Editor. Re-running it replaces the named
-- schedule and is safe once both Vault secrets exist.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'Enable pg_cron before scheduling the notification worker';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'Enable pg_net before scheduling the notification worker';
  end if;
  if not exists (
    select 1 from vault.decrypted_secrets
     where name = 'notification_worker_project_url'
       and nullif(trim(decrypted_secret), '') is not null
  ) then
    raise exception 'Create Vault secret notification_worker_project_url first';
  end if;
  if not exists (
    select 1 from vault.decrypted_secrets
     where name = 'notification_worker_cron_token'
       and nullif(trim(decrypted_secret), '') is not null
  ) then
    raise exception 'Create Vault secret notification_worker_cron_token first';
  end if;
end;
$$;

select cron.schedule(
  'process-notifications',
  '* * * * *',
  $job$
    select net.http_post(
      url := (
        select rtrim(decrypted_secret, '/') || '/functions/v1/process-notifications'
          from vault.decrypted_secrets
         where name = 'notification_worker_project_url'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'notification_worker_cron_token'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
