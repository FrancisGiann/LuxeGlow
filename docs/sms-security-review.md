# LuxeGlow SMS and recovery source review

Reviewed the combined isolated checkout through the signup migration `20261027010000`, recovery migration `20261027020000`, and their Edge/UI paths. This is a source review, not a database execution result.

## Direct Auth and data boundary

- Direct email or phone signup after the rollout marker creates an inactive customer profile. A verified phone plus `claim_customer_login_alias` is needed to activate it. `claim-sms-signup` validates the caller's bearer token through Supabase Auth; the RPC is service-role-only and checks the authoritative confirmed phone, customer profile, alias conflicts and rollout marker.
- Direct Supabase phone/password login remains possible. Customer business RLS on appointments, appointment services, notifications, reviews and profile updates composes with `is_active_account()`, which checks current confirmed phone and matching alias for new customers. Self profile read is intentionally available to inactive users.
- The later reschedule-request RLS policy and customer `SECURITY DEFINER` RPCs check `profiles.is_active`. The profile trigger now forces that value false whenever a new customer's current Auth phone is unconfirmed or mismatches the alias, including an attempted admin reactivation. Auth phone changes and alias delete/rebind suspend the profile. Staff-only and public availability/content RPCs retain their prior roles. These claims still need transaction-level and direct PostgREST verification in disposable Supabase.
- The signup Send SMS Hook verifies Standard Webhooks HMAC, accepts only an unconfirmed phone-provider identity with a UUID, checks that no customer alias exists for it, and reserves a per-phone/global spend slot before UniSMS. Existing alias accounts cannot receive a signup-labelled phone-change OTP. Custom recovery uses a separate eight-digit challenge table, hash namespace and SMS wording; signup OTPs cannot satisfy its verification routine.

## Alias ownership policy required for production

An SMS code proves control of a phone, not ownership of the email typed as its login alias. Current alias reservation has no expiry or reclaim path, so a phone holder could reserve someone else's address indefinitely. Treat the alias as an unverified label until inbox confirmation. Proposed policy:

1. Never send password resets or account-sensitive notifications to an unverified alias. Keep SMS recovery available for the verified phone.
2. Add a service-only, audited alias change operation for the phone-verified account. It must reserve the replacement address against Auth users and aliases in one transaction, update the profile and alias together, invalidate recovery grants, and never mark the new inbox verified.
3. For a disputed alias, require the claimant to prove inbox control through a single-use email challenge. That proof must **not** grant access to the phone owner's account. After support review, notify the phone holder at the verified number, then release the disputed label and require a new alias through phone-based account recovery. Keep appointments and the Auth user intact. Rate-limit and log the support decision without exposing either account to the other party.
4. Show a generic duplicate-address result at signup and recovery. Do not require inbox verification to finish signup; offer it separately for email recovery and notifications.

The reclaim and alias-change operations are **not implemented**. They are a production activation blocker.

### Proposed change and dispute states

Self-service replacement starts from a signed-in, active phone owner. The server sends a fresh, five-minute SMS challenge to the **existing confirmed phone** and binds that challenge to `user_id`, current phone and proposed new alias. After a correct code, one service-only transaction checks that the old alias is still owned by this user, the current Auth phone is still confirmed, and the new alias conflicts with neither a reserved alias nor any Auth email. It updates only that user's alias and profile contact, clears `email_verified_at`, invalidates recovery challenges/grants, and keeps the same Auth user ID and appointment ownership. If the old alias is already a verified Auth email, use staff review until Auth email detach/change behavior is proven in staging. The first signup remains SMS-only; this is an optional later correction.

An inbox claimant with no control of the phone gets a support case, never a session or access to the phone owner's data. Staff must verify inbox control, review the conflict, and offer the phone owner a replacement alias. A disputed alias may be suspended by an audited service action after a defined review window; the underlying Auth user and bookings stay with the phone owner. If the phone owner has lost the phone, staff handle identity recovery separately. No automatic expiry, reassignment, or account merge runs on an email challenge alone. This prevents disputes from remaining unresolved indefinitely without making email confirmation a signup gate.

Mock policy cases for the service operation: (a) fresh phone proof + unused replacement allows same-user alias change; (b) stale/wrong-phone proof denies; (c) new address already in Auth or aliases denies generically; (d) verified-email alias requires staff review; (e) inbox-only claimant opens a case with no account access; (f) support release suspends old alias login but preserves user ID and bookings. These are review cases, not passing database tests yet.

## Remaining security gates

- Both login and recovery rate limits read `x-forwarded-for`; the request path must prove that the Edge proxy overwrites any client-supplied value. Otherwise an attacker can rotate a spoofed IP and bypass quotas. Fail closed or use a trusted platform IP source in staging.
- Recovery deletes GoTrue session rows after password reset, but a previously issued stateless access JWT may still access data until expiry. Add a current-session or session-version check across sensitive RLS and customer `SECURITY DEFINER` operations, or document and approve a short bounded JWT lifetime before enabling reset.
- The existing native invitation/recovery callback handler remains present for staff and already-issued links. Confirm it cannot provide a full unrestricted browser session for a customer after the new reset-only flow is enabled. Keep invitations working.
- Supabase's direct email magic-link/OTP and native password-recovery endpoints can issue full Auth sessions when a verified email is attached, even though the custom recovery grant is reset-only. The frontend now blocks its own native reset request when custom recovery is enabled, but that does not close direct Auth APIs. Before activation, test a supported Auth configuration or sending hook that blocks these customer passwordless paths while retaining email/password login, optional email verification, and staff invite/recovery. Do not change shared templates without checking the deployed welcome and staff mail flows.
- Run both migrations and direct Auth/PostgREST abuse tests in disposable Supabase, including trigger order, alias races, admin profile edits, phone changes, session revocation, and service-role grants. No local database execution has occurred.
- Confirm UniSMS's no-registration default sender is permitted for the intended production use; its published student guide describes that sender as a testing option.

The feature flags and provider switches remain off. No live Auth setting, secret, SMS credit or account was changed in this review.
