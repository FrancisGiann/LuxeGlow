# LuxeGlow dual-channel recovery handoff

This scoped patch is staged only. Do not deploy the migration or enable sending/reset until the signup/login branch and the checks below are integrated. The two code purposes are separate: Supabase Auth's signup SMS code is never accepted by `password-recovery`; recovery uses a separate challenge table and a keyed `luxeglow:recovery` hash namespace.

## Identity contract with signup owner

- Canonical identity is the same `auth.users.id` as normal login. No second Auth user is created.
- SMS proof is `auth.users.phone_confirmed_at`, with `auth.users.phone` exactly matching `customer_login_aliases.phone_e164`. The request only takes the known email alias and a channel; it never accepts a replacement phone.
- Signup email in `customer_login_aliases.email_normalized` is a login label. It is **not** proof of inbox ownership. Optional settings action `requestRecoveryEmailVerification()` asks Supabase Auth to verify that same profile address after signup. Only `auth.users.email_confirmed_at` for that exact `auth.users.email` enables email recovery.
- Existing verified-email customers and head/admin staff remain eligible for email recovery. Their current native Auth reset path must be routed through the custom reset-only flow at integration, so callback verification cannot create an unrestricted browser session.
- Migration `20261027020000` requires signup migration `20261027010000` and its `customer_login_aliases`/`reserve_sms_send` objects. Review both together. The recovery SMS HMAC uses the same `SMS_RATE_SECRET` and phone representation as signup so its send consumes the same ten-per-day global reservation. Provider timeouts are never automatically retried.

## Protocol

`POST password-recovery` with `action=request`, `email`, `channel=sms|email` always returns the same generic request text and random `challenge_id` for known, unknown, and unavailable channels. SMS sends an eight-digit code to the already verified phone; the code expires after **5 minutes** and is limited to five guesses. Email sends a 32-byte token in a URL fragment (kept out of HTTP referrers and server logs) to the independently confirmed email; the link expires after **15 minutes**. Both are single-use. Account and destination issuance are capped at three/hour, IP at ten/hour, and a one-minute account/channel cooldown applies. Verification attempts have a separate twenty/hour IP cap. No destination is echoed. Successful and unknown valid requests use the same generic shape and a five-second response floor to reduce timing clues.

`action=verify` accepts challenge ID plus the SMS code or email token. It returns a random, single-use **reset-only** grant valid for ten minutes. It never returns Supabase access/refresh tokens. `action=reset` consumes the grant before an admin password update and removes GoTrue session rows. Password and identity changes clear outstanding recovery grants/challenges.

SMS text is `LuxeGlow password reset code: 12345678. Expires in 5 min. Do not share this code.` Its content is distinct from the signup verification SMS, uses the account-assigned sender ID, and fits one GSM segment. No link or secret is logged.

## Required rollout gates

1. Integrate the signup owner's final alias schema, UniSMS hook, auth settings, and UI. Review the feature-gated recovery form in the existing LuxeGlow auth dialog, the fragment-link route, and the optional recovery-email card in signed-in profile settings. Ensure the native Auth recovery callback path is retired or tightly limited when enabling the new flow, so it cannot create a full browser session. No signup verification-email stage.
2. Review Supabase Auth phone/email change behavior and test the database migration against a disposable Supabase instance, including permissions for `auth.sessions`, trigger order, rate caps, concurrency, and direct anon/authenticated RPC denial. Verify `x-forwarded-for` is set by the trusted Edge proxy and cannot be spoofed by direct callers; replace it with a trusted source if necessary.
3. Review JWT/session behavior. Removing `auth.sessions` revokes refresh tokens, while existing stateless access JWTs may remain valid until expiry. Set an acceptable JWT lifetime and check `session_id` against `auth.sessions` on sensitive data/operations, or add an equivalent guard before enabling `RECOVERY_RESET_ENABLED`. Verify the admin password update and session deletion behavior on disposable users.
4. Confirm exact production redirect allowlist and Auth email confirmation behavior for attaching an alias. Validate email provider (Resend) and UniSMS sender configuration. Set `PASSWORD_RECOVERY_HASH_KEY` (32+ random characters), `SMS_RATE_SECRET` shared with signup, `UNISMS_SECRET_KEY`, account-assigned `UNISMS_SENDER_ID`, `RESEND_API_KEY`, `MAIL_FROM_ADDRESS`, `ALLOWED_ORIGIN`, and `RECOVERY_REDIRECT_URL` only during an authorized rollout. Keep `RECOVERY_SENDING_ENABLED` and `RECOVERY_RESET_ENABLED` unset until then. Do not use a Vite environment variable for service secrets.
5. Run synthetic flow, expired/replayed/incorrect code, unknown account, disabled channel, staff legacy, phone change, alias collision, provider failure, concurrency, and post-reset session tests. Audit that no function response or log contains the destination, token, service role, or real credentials. Only then consider a controlled production release.

No real account was recovered, SMS/email sent, credit consumed, secret read or set, Auth setting changed, or site published by this patch.

The branded `RecoveryPanel` and `RecoveryEmailCard` are mounted behind `VITE_RECOVERY_ENABLED=false` in the existing auth dialog and profile settings. The flag must stay off until all gates pass. The native staff invitation and previously issued recovery callback path remain for compatibility and require security review before rollout.
