do $$ begin
  if (select count(*) from public.welcome_email_rollout) <> 1
    or (select started_at from public.welcome_email_rollout) <> (select started_at from public.welcome_test_cutoff)
    or (select count(*) from public.welcome_email_claims) <> 2
    or (select count(*) from public.notification_outbox where kind = 'welcome') <> 3
    or (select welcome_delivery_started_at from public.notification_outbox where recipient_id = '00000000-0000-0000-0000-000000000003') is not null then
    raise exception 'migration replay changed welcome state';
  end if;
end $$;
