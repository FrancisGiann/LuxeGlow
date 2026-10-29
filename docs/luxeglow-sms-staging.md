# LuxeGlow SMS signup staging handoff

## Staging runtime checkpoint (2026-10-29)

Staging project `bpnzjzugpnbpwzthzbfp` has the ordered baseline SQL batches and the later phone normalization (`20261027080000`) and preclaim profile gate (`20261027070000`) applied. The user reported these results from the disposable synthetic account on the no-send test page: signup accepted; phone OTP produced no readable profile before alias claim; alias claim succeeded; and email/password login returned one customer profile. This verifies the intended staging path, not a production release. The earlier synthetic account with an unknown password was deleted with the user's specific approval; the fresh account passed the password test.

The staging dashboard lists three deployed Edge Functions: `claim-sms-signup`, `login-rate-limit`, and `signup-email-availability`. It does **not** list `password-recovery` or `send-unisms-sms`, so neither recovery nor provider delivery has a staging runtime pass. Staging alias claim and login flags were enabled for the no-send test; the rejecting SMS hook remains in use. The production project, public SMS signup flag, and UniSMS delivery are unchanged.

The user then attempted a fresh phone OTP verification after alias claim. Staging Auth logs at 2026-10-29 01:20:16 showed `/auth/v1/verify` returning 500 with PostgreSQL `42501 Authentication unavailable`, matching the custom access-token hook's denial. Separate read-only checks returned `anon_claim=false`, `user_claim=false`, `service_claim=true` for `claim_customer_login_alias(uuid,text)`, and `rls_on=true`, `restrictive_gate=true` for the profile table. These are narrow direct Auth and database permission checks; no SMS was sent.

Still untested in staging: direct Auth phone/password access with the existing synthetic account, native verified-email recovery and staff invitation compatibility, reset-only grant/session revocation, SMS send cap and provider failure, alias dispute/change, and real delivery. Treat these as activation gates. Do not infer them from the successful page result.

Read-only dashboard checks also found that staging Auth IP Address Forwarding is off. The gateway sends `Sb-Forwarded-For` using a secret API key, so Auth currently applies its own IP limits to the gateway address rather than the individual client; the custom limiter reads `x-forwarded-for`, whose trust boundary has not been proven. Production Auth still has Confirm email on, Phone off and no Auth hooks; its Free project overview reports no backups. Production lists the existing six functions, including signup email availability, and no SMS functions. These are release preflight findings, not changed settings.

This change is staged in an isolated checkout reconciled with public frontend `main` at `6becae28b799ea06e7e0195db2e85d66e4bd704c`, including the duplicate-email disabled-button and submit guard, and with `20261027000000_future_customer_welcome.sql`. The browser, Edge Functions, Auth hook and database migrations are not enabled in production. Do not apply only one layer: the Auth and RLS gates depend on the alias migration and the recovery flow.

## Identity and interfaces

- Canonical new customer: Supabase Auth phone/password user. `auth.users.phone` and `phone_confirmed_at` are the phone proof; `profiles.phone` and editable metadata are not.
- Unverified email login alias: service-only `public.customer_login_aliases(user_id, email_normalized, phone_e164, email_verified_at)`. The first three fields are established after `verifyOtp({phone, token, type:'sms'})` via `claim-sms-signup` and `claim_customer_login_alias(uuid,text)`. The alias never proves inbox ownership.
- Normal sign-in still shows email/password. `login-rate-limit` resolves an unverified customer alias to the confirmed phone and asks Supabase Auth to verify the password. Existing customers and staff continue through the existing email Auth grant. Direct Supabase phone/password grant remains available, so the database checks confirmed phone, matching alias and active profile for new customer business data.
- The staged recovery migration, Edge Function, and optional independently verified recovery-email action are integrated behind disabled flags. Only a separately confirmed Auth email matching the alias should become a recovery destination. New customer notification mail is held until that condition holds; existing mail claims remain future-only and one-time at SMTP handoff.
- `reserve_sms_send(text hook_id,text phone_hash)` uses HMAC-SHA256 of E.164 phone with `SMS_RATE_SECRET`. Its current limits are 60 seconds between sends per phone, 3 per rolling hour per phone, and 10 per rolling day for this Supabase project. The recovery flow can share this cap with a distinct hook ID namespace and purpose.

## UniSMS adapter and copy

The Supabase Send SMS Hook is authenticated using Standard Webhooks HMAC and sends with server-only UniSMS Basic authentication to `POST https://unismsapi.com/api/sms`. It uses the account-assigned sender ID from `UNISMS_SENDER_ID`; the sender itself is not a custom LuxeGlow name. Signup content is `LuxeGlow signup code: {code}. Expires in 5 minutes. Do not share this code.` Recovery must use its own code store, expiry, purpose and `LuxeGlow password reset code` wording. It must never accept a signup code. The five-minute claim is valid only after staging sets the Supabase Auth SMS OTP expiry to 300 seconds and confirms the setting.

## Controlled activation sequence

1. Review the integrated recovery migration/UI, the deployed invite-staff source, and welcome worker. Keep old users and staff on their current auth path.
2. In a disposable Supabase project, apply the reviewed migrations in order: `20261027010000` signup activation, `20261027020000` recovery, `20261027040000` alias-aware email availability, `20261027050000` session boundary, and `20261027060000` customer RPC gate, after the published `20261027030000` availability migration. Configure Auth phone confirmation, test Send SMS Hook, and Custom Access Token Hook, set Auth SMS OTP expiry to 300 seconds, and run direct Auth/PostgREST bypass tests. Confirm email alias conflict and phone-change behavior under real Auth triggers. The access-token hook must prevent native OTP/recovery from issuing full customer sessions after alias activation; the profile and owned-data RLS and six customer RPCs must also reject stale non-password sessions.
3. Set `UNISMS_SECRET_KEY`, the account-assigned sender, `SMS_HOOK_SECRET`, and `SMS_RATE_SECRET` only in secure Supabase Edge secret fields. Start with `SMS_SENDING_ENABLED=false`, `SMS_SIGNUP_ENABLED=false`, `SMS_ALIAS_LOGIN_ENABLED=false`, and `VITE_SMS_SIGNUP_ENABLED=false`.
4. Run synthetic hook/provider tests, then seek a controlled real recipient and credit budget before any real SMS. Test signup, resend, wrong/expired/reused code, provider failures, carrier delivery, email recovery, old account/staff login, and direct API attempts.
5. Enable server gates, hook and browser flag as a reviewed coordinated release. Monitor spend and delivery; disable `SMS_SENDING_ENABLED` immediately if needed.

## Open review items

- A phone holder can reserve someone else's unverified email alias indefinitely. Define a non-enumerating support reclaim and abuse policy before production.
- The Auth Send SMS Hook payload/provider shape and OTP expiry must be verified against a disposable Supabase project. No live project setting has been changed.
- UniSMS describes the default `Unisoft` sender as an integration/testing sender for Globe and DITO and says to apply for a sender ID after testing. The user's no-registration plan therefore needs provider confirmation before production activation; the staged adapter must not be treated as proof of commercial availability.
- A database-only security review must validate every customer `SECURITY DEFINER` RPC and Auth trigger under the project’s actual roles. No local Postgres or Supabase CLI is installed in this checkout, so the migration has not yet been executed.
- `password-recovery` currently derives IP limits from `x-forwarded-for`; a disposable runtime test must prove that value is assigned by trusted infrastructure and cannot be forged by a direct caller. Replace the source if that proof fails. The per-account, per-destination, and per-challenge limits remain in place independently.
- Existing verified-email and staff native recovery/invitation callback behavior needs a runtime review before reset-only recovery is enabled. Do not send account-sensitive messages to an alias before separate inbox confirmation.
- The 83 local frontend tests, touched-file lint, and enabled-flag frontend build pass. These are source and mock checks, not a database/Auth/UniSMS delivery test. The new SMS flags, production Auth settings, Edge secrets, and real SMS sending remain off.
