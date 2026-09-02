# Supabase cutover runbook

`migrations/20260827000000_initial.sql` is the canonical schema. It is complete
and does not depend on `database/astrid_nails.sql` or the old MySQL migrations.
The same file is mirrored at `supabase/migrations/20260827000000_initial.sql`
because that is the Supabase CLI's required migration directory; keep the two
copies identical when revising the schema. Run it with `supabase db push` or in
a reviewed SQL editor.
Do not run it against production until the preflight and rollback checks below
have been completed.

For a new empty project, run `seed.sql` after the migration to install the
canonical service/content menu. The MariaDB import supersedes those rows when
you are migrating an existing salon database.

## Runtime architecture

- The React app uses only `@supabase/supabase-js` with the publishable/anon key.
  RLS, not hidden UI state, enforces ownership and staff authorization.
- `book_appointment` is a `SECURITY DEFINER` RPC. It validates the current
  Auth user, reads current service prices, locks the Manila-local date, and
  relies on a PostgreSQL exclusion constraint for race-safe interval booking.
  The browser cannot supply status, duration, or price.
- New staff service-image uploads go through the authenticated
  `upload-service-image` Edge Function to Cloudinary. The function validates
  JPEG/PNG/WebP bytes and a 5 MB limit, stores Cloudinary's `secure_url` in
  `services.image_path` plus its managed `public_id` in
  `services.image_public_id`, and performs replacement cleanup with
  invalidation. The legacy `service-images` bucket and policies remain in
  place so existing relative paths continue rendering. No service-role or
  Cloudinary secret is present in Vite variables.
- Staff can persist up to six homepage preview services with
  `services.is_homepage_featured`. The curation migration seeds the previous
  category-balanced preview, clears the flag when a service is deactivated,
  and serializes additions so a concurrent seventh selection is rejected.
- Login throttling uses the service-role-only RPCs in the mirrored
  `20260830010000_login_rate_limits.sql` migration. The app-side function
  stores only hashed email+IP identity and separate IP keys; deploy and secret
  setup are documented in `supabase/functions/README.md`. Login rows older than
  24 hours are cleaned opportunistically in bounded batches of 100.
- Invite and staff-recovery links use the server-side `APP_ROUTER_BASE` setting:
  `/` for local Vite development and `/luxeglow` for the production SPA path.
  Register both exact `/reset-password` URLs in Supabase Authentication → URL
  Configuration; do not use a wildcard redirect.
- Appointment status triggers create in-app notifications and an email outbox.
  `supabase/functions/process-notifications` is a service-role-only worker.
  Configure a Supabase Scheduled Edge Function or an external scheduler to
  POST it every minute with `x-cron-token: $CRON_SECRET_TOKEN`. It runs
  `run_appointment_maintenance`, which cancels pending appointments 15 minutes
  after their start and creates one 24-hour reminder per confirmed appointment.
- `supabase/functions/invite-staff` is the only staff provisioning boundary;
  `reset-staff-password` is the corresponding recovery boundary. Both verify
  an active admin, call the Auth Admin API with the service-role key, and keep
  privileged credentials server-side. Never call those APIs from the browser.

All wall-clock booking input is Asia/Manila time. `local_date`/`local_time`
retain the salon value for display; `start_at` and the generated range are
`timestamptz`, so DST/UTC conversion and background jobs are deterministic.

## MariaDB data migration

1. Freeze writes or take a consistent MariaDB backup. Verify the source
   database contains the post-migration customer, review, notification and
   business-info columns; the old dump alone is incomplete.
2. On a locked operator machine, run the read-only exporter:

   ```sh
   export LEGACY_DB_HOST=127.0.0.1 LEGACY_DB_NAME=astrid_nails \
     LEGACY_DB_USER=readonly_migration_user LEGACY_DB_PASS='YOUR_LEGACY_DB_PASSWORD'
   php scripts/export_mariadb.php --out=/secure/luxeglow-export
   chmod -R go-rwx /secure/luxeglow-export
   ```

   It exports customers, staff, services, business content, FAQs,
   appointments, appointment services, reviews and notification history.
   Password hashes are intentionally not exported.
3. Provision one Supabase Auth user per exported email using the Auth Admin
   API (`inviteUserByEmail`) or a staged recovery invitation. The exporter
   writes every legacy customer/staff ID and email to
   `identity-map-template.csv`; record each new UUID in its `auth_user_id`
   column. Do not insert rows
   into `auth.users` directly. Imported customer accounts should be disabled
   until the owner completes the invitation/recovery flow if the cutover
   cannot be completed atomically.
4. Use the service-role database connection to run:

   ```sh
   psql "$SUPABASE_DB_URL" -v export_dir=/secure/luxeglow-export \
     -f database/supabase/import_legacy.sql
   ```

   The import preserves source customer/staff IDs, service IDs and appointment
   references in `legacy_*` columns, recomputes appointment totals from the
   canonical service catalog, validates identity and service references, and
   is transactional. Existing appointment records remain queryable by their
   original `BK-*` reference.
5. Copy old service images into the `service-images` bucket through the Storage
   API (not the filesystem), using the service ID as the first path segment.
   Update `services.image_path` only after each upload succeeds. Validate MIME,
   byte size and image decoding; never trust the original filename or extension.
   Existing relative Storage paths must remain unchanged during the Cloudinary
   cutover.
6. Compare exporter manifest counts with Supabase counts, sample every status,
   verify orphan/reference counts, test a new booking and test a status change
   before opening writes. Keep the MariaDB backup read-only until reconciliation
   and rollback sign-off.

### Password transition decision

Supabase's current Auth Admin API documents `password_hash` migration for
bcrypt and Argon2 hashes, but it must be sent through the supported Admin API
and verified against representative accounts in a staging project. Do not
insert `auth.users` rows directly, do not assume every PHP `$2y$` variant is
accepted, and do not put the Admin API key in the browser. This repository
defaults to the safer forced-reset/invitation path: the exporter does not copy
legacy hashes, and each user completes a Supabase recovery flow before access
is enabled. If a staging proof establishes exact hash compatibility, an
operator may use `auth.admin.createUser({ password_hash, email_confirm })` in a
separate audited script while retaining the same identity map and rollback
steps. The active UI follows Supabase's documented invitation/recovery-link
flow and accepts a recovery OTP only when the project's email template is
configured for one; invitation setup is link-only. Keep legacy hashes offline for the retention period, then
destroy them under the project's data-retention policy. See the official [Auth migration guide](https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0)
and [password reset flow](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).

## Environment and rollback

Browser variables are `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the
hosting base path. Server/Edge variables are `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `RESEND_API_KEY`, mail sender
settings, a random `CRON_SECRET_TOKEN`, `ALLOWED_ORIGIN`, `APP_ROUTER_BASE`,
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
Set the Cloudinary values only with the Supabase secrets manager:

```sh
supabase secrets set CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... \
  CLOUDINARY_API_SECRET=... ALLOWED_ORIGIN=https://your-site.example
supabase functions deploy upload-service-image --no-verify-jwt
```

Apply the mirrored canonical migrations before deploying the functions:
`supabase db push` (including `20260829005000_homepage_service_curation.sql`
and `20260830010000_login_rate_limits.sql`).
Only the service-role database connection may run import
SQL or claim outbox jobs; the browser must never receive the service role or
Cloudinary API secret. Verify the function's numeric request-size guard with an
oversized `Content-Length` request (expect JSON `413`) and verify replacement
compare-and-swap behavior by issuing two simultaneous uploads for one service
(expect one `200` and one `409`, with the row matching only the winner).

The classic PHP pages and `/includes` endpoints are retained in this repository
as a pre-cutover archive for audit/rollback only; they are no longer called by
the active React customer or staff app. The active `/admin` workspace covers
appointment status/rescheduling/history, service images, customer contact
records, FAQs, business information, and admin staff invite/role/status/reset
workflows. PHP session endpoints are disabled by `config/database.php`; do not
route production traffic to them after cutover.
If rollback is required, disable the SPA, restore the MariaDB snapshot and
legacy build, and revoke/invalidate Supabase Auth sessions; do not dual-write
silently. A later PHP compatibility port must target Supabase Postgres and
bearer Auth tokens rather than reintroducing PHP sessions.
