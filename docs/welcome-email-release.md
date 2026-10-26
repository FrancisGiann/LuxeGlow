# Future customer welcome email

This patch enables the existing branded `welcome` HTML in
`process-notifications`. Release both the narrowly changed worker and the
mirrored `20261027000000_future_customer_welcome.sql` migration. Do not alter
SMTP secrets or send a live test email as part of this patch.

## Release check

1. Confirm the target project is `fehljwfjvxubcdplnjuk` and compare the live
   schema with the migration assumptions: `auth.users` has `created_at`,
   `email_confirmed_at`, and `invited_at`; `public.profiles` has role,
   `is_active`, and the two legacy IDs; `notification_outbox` has the columns
   used by the queue claim function and allows `kind = 'welcome'`.
2. Inspect the live definitions of `public.claim_notification_outbox(integer)`,
   `public.handle_user_email_confirmed()`, and the
   `on_auth_user_email_confirmed` trigger. If they differ from the checked-in
   versions, reconcile before applying this migration. Check for any other
   active welcome trigger or sender so two paths cannot send mail. The exact
   read-only queries are in `welcome-email-live-preflight.sql`.
3. After release approval, deploy the worker first, then apply only this
   migration. Its transaction creates a persistent rollout timestamp, a
   per-user claim, the confirmation trigger, and a welcome delivery handoff
   column. Pre-existing unsent welcome jobs are held for review. Replaying the
   migration keeps the original rollout timestamp and claims.
4. Verify the trigger exists, the rollout timestamp was recorded once, and
   the worker remains configured. Observe future welcome queue rows and
   `last_error` without creating a real customer or invoking live mail.

The eligible event is a customer Auth row created **after** rollout whose
`email_confirmed_at` changes from NULL to a timestamp. Invitees, inactive or
non-customer profiles, and imported profiles are excluded. The claim and queue
row share the same transaction. Existing users are never scanned or backfilled.

SMTP cannot atomically acknowledge database work or provide an idempotency key.
The worker validates the message and records a durable handoff before calling
SMTP. Definite pre-send failures, including profile lookup or handoff write
errors, retain the ordinary five-minute outbox retry. Once the handoff is
recorded, a crash or SMTP error may have delivered the message; that row is
held with `welcome_delivery_started_at` and an error if one was caught. It
cannot be reclaimed automatically. An operator should compare provider logs
with the outbox row before any manual resend. A crash after handoff but before
SMTP can leave a welcome unsent; this is the unavoidable at-most-once tradeoff
without a provider idempotency key. The patch does not claim exactly-once
delivery. Booking and other account notification retries retain their current
behavior.

## Rollback

In a transaction, drop only `on_auth_user_email_confirmed` from `auth.users`
and set `available_at = 'infinity'` on unsent `welcome` rows so the worker
cannot send queued welcomes. Keep `welcome_email_claims`, the delivery marker,
and
`welcome_email_rollout` to preserve deduplication and the original cutoff.
Restore the prior `claim_notification_outbox(integer)` body from
`20260827000000_initial.sql` only after queued welcomes are quarantined.
The previous worker may then be redeployed if desired.
Do not replay the older welcome migration: it would restore an unguarded
trigger. Confirm the trigger is absent and pending welcomes are quarantined.
