-- Enable welcome mail only for customer accounts created after this migration.
-- The marker survives a migration replay; no existing account is backfilled.
begin;

create table if not exists public.welcome_email_rollout (
  singleton boolean primary key default true check (singleton),
  started_at timestamptz not null default now()
);
insert into public.welcome_email_rollout (singleton) values (true)
on conflict (singleton) do nothing;

-- A separate claim avoids depending on historical outbox rows being unique.
-- The claim and outbox insert commit in the same Auth confirmation transaction.
create table if not exists public.welcome_email_claims (
  recipient_id uuid primary key references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.welcome_email_rollout enable row level security;
alter table public.welcome_email_claims enable row level security;
revoke all on public.welcome_email_rollout, public.welcome_email_claims from public, anon, authenticated;

-- Durable handoff to SMTP. Pre-send failures leave this NULL and can retry;
-- after handoff starts an uncertain provider outcome requires human review.
alter table public.notification_outbox
  add column if not exists welcome_delivery_started_at timestamptz;

-- Do not allow any welcome rows queued before rollout to send to old users.
update public.notification_outbox n
set welcome_delivery_started_at = now(),
    last_error = coalesce(last_error, 'Pre-rollout welcome job held for review')
from public.welcome_email_rollout r
where r.singleton and n.kind = 'welcome' and n.sent_at is null
  and n.welcome_delivery_started_at is null and n.created_at < r.started_at;

create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is not null
     or new.email_confirmed_at is null
     or new.invited_at is not null
     or not exists (
       select 1 from public.welcome_email_rollout r
       where r.singleton and new.created_at > r.started_at
     )
     or not exists (
       select 1 from public.profiles p
       where p.id = new.id and p.role = 'customer' and p.is_active
         and p.legacy_customer_id is null and p.legacy_staff_id is null
     ) then
    return new;
  end if;

  insert into public.welcome_email_claims (recipient_id) values (new.id)
  on conflict (recipient_id) do nothing;
  if not found then
    return new;
  end if;

  insert into public.notification_outbox (recipient_id, kind, payload)
  values (
    new.id,
    'welcome',
    jsonb_build_object(
      'title', 'Welcome to Astrid Nails & Beauty Bar!',
      'message', 'Your email has been successfully verified! Welcome to Astrid Nails & Beauty Bar. You can now book your favorite services directly from our website.'
    )
  );
  return new;
end;
$$;

revoke all on function public.handle_user_email_confirmed() from public, anon, authenticated;
drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row execute function public.handle_user_email_confirmed();

-- SMTP has no idempotency key. Retry only before the worker records its
-- delivery handoff. Once started, an uncertain SMTP outcome is held for review.
create or replace function public.claim_notification_outbox(p_limit integer default 25)
returns setof public.notification_outbox
language sql
security definer
set search_path = public
as $$
  update public.notification_outbox n
     set claimed_at = now(), attempts = attempts + 1
   where n.id in (
     select id from public.notification_outbox
      where sent_at is null and available_at <= now()
        and (kind <> 'welcome' or welcome_delivery_started_at is null)
        and (claimed_at is null or claimed_at < now() - interval '10 minutes')
      order by id for update skip locked limit least(greatest(coalesce(p_limit, 25), 1), 100)
   )
  returning n.*;
$$;
revoke all on function public.claim_notification_outbox(integer) from public;
grant execute on function public.claim_notification_outbox(integer) to service_role;

commit;
