begin;

-- These SECURITY DEFINER worker RPCs can mutate appointment state and claim customer email work.
-- Supabase role-specific grants survive REVOKE FROM PUBLIC, so explicitly clear API-role access.
revoke all on function public.run_appointment_maintenance(timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.run_appointment_maintenance(timestamptz) to service_role;

revoke all on function public.claim_notification_outbox(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_outbox(integer) to service_role;

commit;
