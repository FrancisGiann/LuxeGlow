-- Read only. Run against project fehljwfjvxubcdplnjuk before welcome release.
-- Return definitions and counts only; do not export customer rows or emails.
select 'auth.users' as relation, column_name, data_type
from information_schema.columns
where table_schema = 'auth' and table_name = 'users'
  and column_name in ('id', 'created_at', 'email_confirmed_at', 'invited_at')
union all
select 'public.profiles', column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('id', 'role', 'is_active', 'legacy_customer_id', 'legacy_staff_id')
union all
select 'public.notification_outbox', column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'notification_outbox'
  and column_name in ('id', 'recipient_id', 'kind', 'payload', 'available_at',
    'claimed_at', 'sent_at', 'attempts', 'last_error', 'created_at',
    'welcome_delivery_started_at')
order by 1, 2;

select tgname, pg_get_triggerdef(oid) as trigger_definition
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal
order by tgname;

select p.oid::regprocedure::text as function_name, pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.oid in (
  to_regprocedure('public.claim_notification_outbox(integer)'),
  to_regprocedure('public.handle_user_email_confirmed()'),
  to_regprocedure('public.handle_new_user()')
)
order by 1;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.notification_outbox'::regclass
  and conname = 'notification_outbox_kind_check';

select count(*) as preexisting_unsent_welcome_jobs
from public.notification_outbox
where kind = 'welcome' and sent_at is null;
