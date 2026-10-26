-- Run after fixture and migration in a disposable database.
do $$
declare
  cutoff timestamptz;
begin
  select started_at into cutoff from public.welcome_email_rollout where singleton;
  create table public.welcome_test_cutoff (started_at timestamptz not null);
  insert into public.welcome_test_cutoff values (cutoff);
  insert into auth.users (id, created_at, invited_at) values
    ('00000000-0000-0000-0000-000000000002', cutoff + interval '1 second', null),
    ('00000000-0000-0000-0000-000000000003', cutoff + interval '1 second', null),
    ('00000000-0000-0000-0000-000000000004', cutoff + interval '1 second', cutoff),
    ('00000000-0000-0000-0000-000000000005', cutoff + interval '1 second', null),
    ('00000000-0000-0000-0000-000000000006', cutoff + interval '1 second', null);
  insert into public.profiles (id, role, legacy_customer_id) values
    ('00000000-0000-0000-0000-000000000002', 'customer', null),
    ('00000000-0000-0000-0000-000000000003', 'customer', null),
    ('00000000-0000-0000-0000-000000000004', 'customer', null),
    ('00000000-0000-0000-0000-000000000005', 'head', null),
    ('00000000-0000-0000-0000-000000000006', 'customer', 42);
end;
$$;

-- A failed or pending verification does not queue a new welcome.
update auth.users set invited_at = null where id = '00000000-0000-0000-0000-000000000003';
do $$ begin
  if (select count(*) from public.notification_outbox) <> 1
    or (select welcome_delivery_started_at from public.notification_outbox where recipient_id = '00000000-0000-0000-0000-000000000001') is null then
    raise exception 'unverified user queued welcome';
  end if;
end $$;

update auth.users set email_confirmed_at = now() where id in (
  '00000000-0000-0000-0000-000000000001', -- pre-rollout
  '00000000-0000-0000-0000-000000000002', -- eligible
  '00000000-0000-0000-0000-000000000004', -- invitation
  '00000000-0000-0000-0000-000000000005', -- head
  '00000000-0000-0000-0000-000000000006'  -- imported customer
);
-- Duplicate confirmation event, including a forced NULL -> confirmed cycle.
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000002';
update auth.users set email_confirmed_at = null where id = '00000000-0000-0000-0000-000000000002';
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000002';
do $$ begin
  if (select count(*) from public.notification_outbox where kind = 'welcome' and recipient_id = '00000000-0000-0000-0000-000000000002') <> 1
    or (select count(*) from public.welcome_email_claims) <> 1 then
    raise exception 'confirmation duplicate or incorrect eligibility';
  end if;
end $$;

-- A pre-SMTP transient failure can retry; an ambiguous send cannot.
do $$ begin
  if (select count(*) from public.claim_notification_outbox(25)) <> 1 then
    raise exception 'welcome delivery was not claimed once';
  end if;
end $$;
update public.notification_outbox
set claimed_at = now() - interval '11 minutes', available_at = now() - interval '1 minute'
where recipient_id = '00000000-0000-0000-0000-000000000002';
do $$ begin
  if (select count(*) from public.claim_notification_outbox(25)) <> 1 then
    raise exception 'pre-send welcome failure could not retry';
  end if;
end $$;
update public.notification_outbox
set welcome_delivery_started_at = now(), claimed_at = now() - interval '11 minutes'
where recipient_id = '00000000-0000-0000-0000-000000000002';
do $$ begin
  if (select count(*) from public.claim_notification_outbox(25)) <> 0 then
    raise exception 'welcome delivery was reclaimed';
  end if;
end $$;

-- Existing retry convention for non-welcome jobs is unchanged.
insert into public.notification_outbox (recipient_id, kind, attempts)
values ('00000000-0000-0000-0000-000000000002', 'pending', 1);
do $$ begin
  if (select count(*) from public.claim_notification_outbox(25)) <> 1 then
    raise exception 'ordinary notification retry was blocked';
  end if;
end $$;

-- Leave a future welcome pending to verify replay does not quarantine it.
update auth.users set email_confirmed_at = now()
where id = '00000000-0000-0000-0000-000000000003';
