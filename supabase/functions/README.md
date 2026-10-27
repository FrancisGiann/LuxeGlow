# Edge Functions

Deploy the functions with the Supabase CLI:

```sh
supabase functions deploy process-notifications --no-verify-jwt
supabase functions deploy invite-staff --no-verify-jwt
supabase functions deploy reset-staff-password --no-verify-jwt
supabase functions deploy upload-service-image --no-verify-jwt
supabase functions deploy login-rate-limit --no-verify-jwt
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... RESEND_API_KEY=... \
  MAIL_HOST=smtp.gmail.com MAIL_PORT=465 MAIL_USERNAME=... MAIL_PASSWORD=... \
  MAIL_FROM_ADDRESS=... MAIL_FROM_NAME="Astrid Nails & Beauty Bar" \
  CRON_SECRET_TOKEN=... ALLOWED_ORIGIN=https://your-site.example \
  APP_ROUTER_BASE=/ \
  CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... \
  LOGIN_RATE_LIMIT_SECRET=... AUTH_PROXY_SECRET_KEY=sb_secret_...
```

Before deploying the image function, apply the canonical migrations (including
`20260829003000_cloudinary_service_images.sql` and
`20260829005000_homepage_service_curation.sql`) with `supabase db push`. The
`CLOUDINARY_*` values are server-only Upload API credentials: set them with
`supabase secrets set`, never add them to a `VITE_` variable, and never expose
the API secret to the browser. `ALLOWED_ORIGIN` must be the exact origin of the
SPA making the request (for example `https://your-site.example` or
`http://localhost:5173`, without a trailing path). It is a single-origin
allowlist value; the functions do not dynamically accept browser origins, and
`*` is not supported. For local Vite development, temporarily set the
Supabase secret to the local origin before testing the browser flow, then
restore the deployed SPA origin before production use:

```sh
supabase secrets set ALLOWED_ORIGIN=http://localhost:5173
```

After changing this secret or the CORS code, redeploy the affected function(s)
with `--no-verify-jwt` as shown above. The function handles its own bearer-token
verification, so keep `--no-verify-jwt` enabled.

`APP_ROUTER_BASE` is the SPA path used by invite and staff-recovery links: use
`/` for local Vite development and `/luxeglow` when the production build is
served at `https://your-site.example/luxeglow`. In Supabase Dashboard →
Authentication → URL Configuration, set the Site URL to the deployed app URL
and add these exact Redirect URLs (plus any other explicitly supported host):

```text
http://localhost:5173/reset-password
https://your-site.example/luxeglow/reset-password
```

The URLs must match the configured `ALLOWED_ORIGIN` and `APP_ROUTER_BASE`.
Supabase falls back to the Site URL when a requested redirect is not on the
allowlist, so do not rely on an unregistered path or a broad wildcard.
In Supabase Authentication → Email Templates, keep both Invite User and Reset
Password templates pointed at `{{ .ConfirmationURL }}` (or construct the
equivalent link with the supplied `.RedirectTo` value). Do not replace the
template redirect with a hardcoded Site URL: the token must reach the exact
registered `/reset-password` URL above. The staff recovery function sends its
own generated `action_link`, which follows the same redirect configuration.

`process-notifications` sends booking and account notification emails over
SMTP with implicit TLS on port 465. Set `MAIL_HOST`, `MAIL_PORT=465`,
`MAIL_USERNAME`, and `MAIL_PASSWORD` in Edge Function secrets. For Gmail, use
`smtp.gmail.com` and an App Password. The worker rejects other ports because
Supabase Edge Functions cannot use the standard SMTP ports 25 and 587. Set
`MAIL_FROM_ADDRESS` to the authenticated Gmail address or a sender alias
configured in that account; if omitted, it defaults to `MAIL_USERNAME`.
`RESEND_API_KEY` remains required only by `reset-staff-password`.

The worker deliberately authenticates its own random `x-cron-token`, because a
scheduler does not have a customer JWT. For the hosted Supabase scheduler,
create two secrets in Supabase Vault named `notification_worker_project_url`
(the project URL) and `notification_worker_cron_token` (the same value as the
Edge Function's `CRON_SECRET_TOKEN`). Run
[`../database/supabase/schedule_notification_worker.sql`](../../database/supabase/schedule_notification_worker.sql)
in the Supabase SQL Editor; it enables `pg_cron`, `pg_net`, and Vault, then
installs or replaces a once-per-minute job. The script contains no credentials.
The token must match the Edge Function secret exactly.
This scheduled Edge Function must remain configured with its SMTP secrets: it
checks delivery configuration before calling `run_appointment_maintenance`,
which cancels every Confirmed appointment without recorded arrival 24 hours
after its scheduled start, including appointments staff have acknowledged. The
database migration defines that maintenance behavior but does not install the
cron schedule.
You can also use GitHub Actions, Cloudflare Cron, or another secret-aware
scheduler. To smoke-test the deployed worker manually:

```sh
curl -fsS -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notifications \
  -H "x-cron-token: $CRON_SECRET_TOKEN"
```

Do not place the service key or cron secret in the browser. `invite-staff`
requires a caller bearer token and checks the caller's `profiles.role = admin`
using the service client before calling `auth.admin.inviteUserByEmail`.
Invite links intentionally create passwordless users; the recipient is sent to
the configured `/reset-password` route to choose a password. New head accounts
remain unavailable for appointments until an administrator enables them after
the recipient accepts the invitation.
`reset-staff-password` uses the same admin check, sends a one-time Auth recovery
link through Resend for confirmed accounts (or an invitation link for an
unconfirmed account), and never returns a password or reset token to the browser.
`upload-service-image` requires an active head/admin profile, accepts only
JPEG/PNG/WebP multipart uploads up to 5 MB, uploads to Cloudinary under the
`luxeglow/services/{service_id}/` prefix, then stores Cloudinary's `secure_url`
in `services.image_path` and its `public_id` in `services.image_public_id`.
Cloudinary replacement cleanup uses `public_id` with invalidation; legacy
relative Supabase Storage paths are never sent to Cloudinary for deletion.
Homepage preview membership is persisted on `services.is_homepage_featured`;
the migration seeds up to six existing active services, clears the flag when a
service is deactivated, and rejects concurrent attempts to exceed six.

`login-rate-limit` is the app's guest-safe password gateway. Apply the mirrored
`20260830010000_login_rate_limits.sql` migration before deploying it, then set
`LOGIN_RATE_LIMIT_SECRET` to a long random server-only value. The function
accepts only bounded `{ mode, email, password }` payloads, atomically checks
service-role-only rate-limit RPCs, calls GoTrue's password token endpoint with
the server-only `AUTH_PROXY_SECRET_KEY` (`sb_secret_...`) and trusted
`Sb-Forwarded-For` header. Its service-role `reserve_login_attempt` RPC locks
both keys in a stable order, records a reservation atomically, and releases it
after successful or provider/server-failed requests. Failed credentials keep
their reservation counted. It stores only keyed SHA-256 hashes of the
normalized email+IP identity and a separate IP key; identity attempts block
at five failures and an IP at 20 failures in 15 minutes. It returns generic
401/503 errors and sends
`Retry-After` on HTTP 429; credentials and raw IP/email values are never
logged or stored by the function. Supabase Authentication must have provider
IP forwarding enabled under Authentication → Rate Limits; the function uses
only the platform `x-forwarded-for` first value and fails closed if it is
missing. This supplements (and never
replaces) Supabase GoTrue/provider rate limits: a caller that bypasses the SPA
can still call GoTrue directly and remains subject to those provider limits.
The provider request requires a new secret API key; legacy anon/service_role
keys and publishable keys are not valid substitutes for this Auth proxy key.
Login rows older than 24 hours are removed opportunistically in bounded
batches of 100 during reservations.

For a deployment smoke test, send a request whose numeric `Content-Length`
exceeds 5 MiB plus the allowed multipart overhead and confirm the function
returns JSON `413`; normal requests still pass the authoritative byte and
signature checks after multipart parsing. Start two valid uploads for the same
service at the same time and confirm one succeeds while the other returns JSON
`409`; the service row must contain only the winning upload's URL/public ID,
and the losing Cloudinary asset is cleaned up best-effort.


## Signup email availability (approval required before rollout)

`signup-email-availability` is used only by Create account, on email-field blur
and immediately before signup. It returns exactly `{ available: boolean }` on
success. `false` means the address is unavailable for a new account; it reveals
membership by design but never reveals account state, verification, role, UUID,
profile data, or mailbox ownership. Login/recovery do not use this endpoint.
No external mailbox verifier, SMTP probe, email delivery, or account creation is
performed by the check.

Apply the new canonical migration
`database/supabase/migrations/20261027030000_signup_email_availability.sql`
(mirrored under `supabase/migrations/`) before deploying this function. It creates
only a private rate-limit table and a service-role-only RPC. The RPC atomically
locks the per-email and global budgets before looking up `auth.users`: 3 checks per normalized email
and 60 across the project per 15 minutes, including available results. It stores
HMAC-SHA256 email hashes, not raw email addresses. It does not read or store IPs. Old limiter rows are pruned
in bounded batches. Nothing grants browser roles access to profiles, Auth users,
the limiter table, or the RPC. Do not expose this RPC directly to anon.

After approval, deploy with:

```sh
supabase functions deploy signup-email-availability --no-verify-jwt
```

It reuses existing server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`LOGIN_RATE_LIMIT_SECRET` (at least 32 characters), and exact `ALLOWED_ORIGIN`.
No new production credentials, Auth hooks/settings, or SMS setup are required. Missing
configuration, database errors and malformed results fail
closed. An exact Origin check supplements the shared database limiter; CORS is
not authentication and cannot prevent scripted callers. The implementation deliberately ignores `x-forwarded-for`, `cf-connecting-ip`,
body-supplied IPs and all similar client headers. Official Supabase architecture
and rate-limiter examples do not establish an ingress overwrite guarantee for
this project; the first forwarded-IP value must not be trusted for enforcement.
The database per-email and project-wide budgets apply regardless of supplied
headers or IP rotation. A per-email budget may temporarily block a legitimate
signup after an attacker checks that address, and the 60/project budget may deny
all checks until its 15-minute window resets. This is a deliberate conservative
anonymous enumeration cap, not a per-person/IP guarantee. The endpoint still
reveals account membership by request, up to the budget; CAPTCHA/attested ingress
could be separately approved later. Do not increase limits just to mask abuse.

Header/limiter references reviewed:
- https://supabase.com/docs/guides/functions/architecture
- https://supabase.com/docs/guides/functions/examples/rate-limiting
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For


Deploy migration, then endpoint, then frontend. The frontend intentionally
blocks signup on check errors, so rolling it out first would prevent signup.
It preserves all entered details and allows retry. HTTP 429 shows a bounded wait
message using Retry-After (at most 15 minutes); it is not a duplicate-email
warning. Window expiry permits checks again, with no permanent account block. If rolling back, roll back
the frontend first; keep this backend until no deployed frontend depends on it.

The check reserves no address. `registerCustomer` always rechecks on submission,
then uses ordinary `auth.signUp`; Supabase Auth remains the final server-side
uniqueness and transaction boundary even if a caller skips the SPA or two
requests race. Supabase's native Auth migration defines the unique
`users_email_partial_key` for non-SSO users, and its signup implementation
normalizes email and checks for duplicates. Do not replace the Auth signup path
with direct profile inserts or admin user creation. Existing pending accounts
may be reused by Auth rather than recreated. Auth may deliberately return an
obfuscated user for an existing confirmed address; this code does not reinterpret
that response, turn off confirmation, or weaken Auth's privacy settings. Explicit
`user_already_exists` / `email_exists` errors become the same inline unavailable
message. The lookup normalizes case/outer spaces and does not collapse plus tags
or provider-specific dots. This is one account per email, not one account per
person across different emails. SMS/phone uniqueness remains outside this task.

The current RPC checks only existing `auth.users.email`. Future aliases must
extend that private predicate behind the same boolean interface only after their
own migration and authorization; there is no reference to a missing alias table
or SMS branch here.

Local validation:

```sh
cd frontend
node --test test/signupAvailability.test.js test/signupAvailabilityHandler.test.js test/signupEmail.integration.test.js test/signupEmail.test.js
# Optional isolated PostgreSQL/WASM execution, package installed outside repo:
PGLITE_MODULE=file:///tmp/luxeglow-email-pgtest/node_modules/@electric-sql/pglite/dist/index.js node test/signupAvailabilityDatabase.test.js
HAPPY_DOM_MODULE=file:///tmp/luxeglow-email-pgtest/node_modules/happy-dom/lib/index.js node test/signupAvailabilityUi.test.js
```

The PostgreSQL harness uses an in-memory synthetic `auth.users` fixture, executes
the actual migration, and checks role grants, normalization, all-state membership,
limits, reset and failure behavior. It does not attest to hosted Auth configuration
or run concurrent hosted signups. The optional DOM harness renders the real
signup component with synthetic API/context fixtures to verify red styling,
retained details, stale responses, and final-submit rejection. Before rollout, verify the native email unique
index exists (schema metadata only), and use a local Supabase environment with
email delivery disabled/captured to exercise concurrent duplicate signup and
privacy-masked responses. Never enumerate real addresses as a smoke test.

Primary Auth implementation references:
- https://github.com/supabase/auth/blob/master/internal/api/signup.go
- https://github.com/supabase/auth/blob/master/internal/api/mail.go
- https://github.com/supabase/auth/blob/master/migrations/20221215195500_modify_users_email_unique_index.up.sql


Integration/preflight evidence for this change:
- Baseline is deployed welcome commit `d64f13a98dca0649b01db15eac860aa79a67295d`,
  exactly one commit above public main `338860320fc8fb6b77d55dbfb789a233e2df0d85`.
  Welcome worker/migration and invitation code are unchanged by this patch.
- Version `20261027010000` is reserved by the paused SMS draft and
  `20261027020000` by its recovery draft. Availability uses **20261027030000**
  in both migration directories. No paused SMS files are integrated.
- `docs/signup-email-availability-preflight.sql` contains schema-only read-only
  checks for hosted Auth uniqueness and migration history. This task has no
  connected Supabase management session/credential; those live checks remain
  unexecuted. No credentials were created/requested or exported.
- Official Auth source audit is pinned to
  `c3348e8f1cb31454e9783e4eb9eab1e71ad9652f`. The optional
  `nativeAuthDuplicateSource.test.js` audits normalization/duplicate handling
  and executes its native index migration against synthetic PostgreSQL. Both
  requests may observe availability first; the native unique index admits one
  normalized insert and rejects the other. This is source/database evidence,
  not execution of this project's hosted GoTrue service or proof of its version.
- GoTrue lowercases valid email; app preflight trims outer whitespace. A direct
  malformed whitespace signup must fail Auth format validation, not create a
  separate whitespace identity. Never infer mailbox ownership from membership.
- `scripts/qa/signup_availability_postgrest.py` tests actual PostgREST RPC/table/email-inventory role gates
  and budget exhaustion/reset using already-installed images in disposable `network=none`
  containers without host ports, app credentials or live account access. It
  cleans up only its own named test containers. Its JWT is synthetic/local.

Additional local-only commands:

```sh
# Three pinned public Auth files can be fetched into this temporary source root.
AUTH_SOURCE_ROOT=/tmp/luxeglow-auth-source-c3348e8 PGLITE_MODULE=file:///tmp/luxeglow-email-pgtest/node_modules/@electric-sql/pglite/dist/index.js node --test test/nativeAuthDuplicateSource.test.js
# From the repository root, explicitly isolated synthetic PostgREST only:
python3 scripts/qa/signup_availability_postgrest.py
```


Preflight outcome: local PostgREST 16.4 against PostgreSQL 16 passed anonymous and
authenticated denial for the service-only RPC, private limiter table and Auth
email inventory; service-only minimal membership results; both budget limits;
and recovery after the 15-minute window. Account inventory remained unchanged.
An earlier readiness failure was a harness log-capitalization mismatch, corrected
before the gate passed. No hosted queries or production writes substituted for
these local tests. All local test subprocesses and HTTP requests have deadlines.
