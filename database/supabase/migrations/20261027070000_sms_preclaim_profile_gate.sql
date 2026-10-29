-- A phone OTP session exists before its email alias is claimed. The previous
-- profile restriction allowed that session through when no alias existed.
-- Require the actor's active-account gate for every profile read. This keeps
-- existing active staff and pre-rollout accounts on their existing path while
-- denying new customers until alias claim and a password-authenticated session.
begin;

drop policy if exists sms_customer_profile_read on public.profiles;
create policy sms_customer_profile_read on public.profiles
  as restrictive for select to authenticated
  using (public.is_active_account());

commit;
