# Existing LuxeGlow project: bounded SMS test plan

This is a proposed test on Supabase project `fehljwfjvxubcdplnjuk`, which the Dashboard labels `main PRODUCTION`. The owner says its customer accounts are currently test-only. No project setting, user, secret, hook, database row, function, or SMS was changed while preparing this plan.

## Read-only baseline (27 October 2026)

- Organization: LuxeGlow, Free plan. Project healthy on NANO compute in Sydney. No GitHub repository or branch is connected.
- Supabase Dashboard says **no backups**; the Free plan does not include scheduled project backups.
- Authentication: email provider enabled; `Confirm email` enabled; phone provider disabled; no Auth hooks listed. Existing staff invitation and email recovery depend on current Auth and mail behavior.
- Five Edge Functions are listed: `invite-staff`, `login-rate-limit`, `process-notifications`, `reset-staff-password`, and `upload-service-image`. There is no deployed SMS or custom recovery function.
- The Dashboard's migration history ends at `20261026010000_booking_staff_management`. The separately verified, live welcome function/migration source must be reconciled before applying `20261027010000_sms_customer_activation.sql`; the Dashboard's migration list alone does not establish that every manually applied SQL change is absent.

## Before any write

1. Obtain scoped approval for use of this named project, including creation of synthetic Auth users and changes to its Auth phone provider, test OTP mappings, Send SMS and access-token hooks, Edge Functions, and database migrations. Keep real UniSMS delivery and frontend feature flags off.
2. Record exact current Auth provider, hook, rate, session, redirect and email-template settings without secret values. Preserve current deployed function source/version checksums and the welcome migration/function definition. Verify that an existing admin account can still sign in and has a separate recovery path.
3. Create a restorable manual database backup with authorized project access, store it encrypted outside the repository, and verify restoration into a disposable target or otherwise prove the backup works. A dashboard screenshot or migration rollback script is not a substitute for a database backup. The Free plan supplies no managed recovery point. Do not extract account rows or password hashes into chat or the repository.
4. Run read-only schema preflight for required tables/columns/functions and a count-only check of customer/staff/Auth records. Confirm the deployed welcome worker is the reviewed release. If the live schema differs, revise the migrations offline first.

## Test sequence after approval and backup

1. Apply the staged migrations in order, `20261027010000_sms_customer_activation.sql`, then `20261027020000_dual_channel_recovery.sql`, only after source security gaps are closed. Keep `SMS_SIGNUP_ENABLED`, `SMS_SENDING_ENABLED`, `RECOVERY_SENDING_ENABLED`, and `RECOVERY_RESET_ENABLED` off.
2. Deploy the matching Edge functions with sending disabled. Configure only test-scoped hook secrets and mock delivery. Supabase's **Test Phone Numbers and OTPs** can verify synthetic phone flows without SMS; use short-lived, private mappings and remove them afterward. Do not configure UniSMS credentials or consume credits for this stage.
3. Enable phone Auth and the test-scoped Send SMS hook, then run synthetic signup, alias collision/race, wrong/expired OTP, password login, existing staff invite/recovery, direct email OTP/recovery/phone Auth bypass, PostgREST/RPC, phone change, and session-revocation cases. Test a Custom Access Token Hook only after its source and staff-preserving conditions pass review.
4. Return phone Auth and hooks to recorded values; remove test OTP mappings and synthetic users; verify staff/admin login and the deployed welcome/notification behavior. Leave all frontend and SMS sending flags off until a separate activation decision.

## Approval and rollback limits

The owner must explicitly authorize the named project's security setting changes, migrations, Edge deployments, and synthetic users. Any new database password or API key must be entered directly by the owner into a secure provider field, never chat or Git. This test should not need a UniSMS key, live SMS, credits, a paid Supabase plan, or a new project.

Auth settings and deployed functions can be restored from the recorded values/source. SQL migrations change triggers, functions, policies and tables, so rollback requires a reviewed reversal or the verified encrypted backup. Revoking tokens, changing Auth hooks, or enabling phone sign-in can interrupt existing test/staff sessions while the experiment runs. If a restorable backup or admin recovery cannot be established, use a separate disposable Free project rather than the existing one.
