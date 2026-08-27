# Astrid Nails & Beauty Bar (LuxeGlow)

The active customer and staff application is a React/Vite SPA backed by
Supabase Auth, Postgres/RLS, Storage and Edge Functions. The old PHP/MySQL
surface remains only as a rollback archive; it is not an active data path.

```
browser ──► React SPA ──► Supabase Auth + PostgREST/RPC + Storage
                              │
                              └── scheduled Edge Function ──► email provider
```

## Local development

```sh
cd frontend
npm install
cp .env.example .env.development
# set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Build with `npm run build`. Deploy the resulting `frontend/dist` directory to
your chosen static host and configure its SPA fallback. `VITE_ASSET_BASE` and
`VITE_ROUTER_BASE` must match the host sub-path when one is used.

## Supabase setup

1. Create a Supabase project and configure email Auth (SMTP/provider and OTP or
   recovery templates) plus the production redirect URL.
2. Install the Supabase CLI, link the project, and run
   `supabase db push`. The canonical schema and RLS policies are in
   [`database/supabase/`](database/supabase/README.md).
3. Set Edge Function secrets for `process-notifications` and `invite-staff`.
   Schedule `process-notifications` once per minute with the documented
   `x-cron-token` header.
4. Seed services/content and migrate existing MariaDB data using the
   read-only exporter and transactional import runbook. Do not import legacy
   password hashes directly into GoTrue; use forced reset/invitation.

Required variables are documented in [`.env.example`](.env.example) and
`frontend/.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must
never use a `VITE_` prefix.

## Active workflows

- Customers register, verify email, sign in, reset passwords, update profiles,
  view notifications/reviews, upload no privileged data, and book appointments
  through the `book_appointment` RPC.
- Staff/admin users sign in with Supabase Auth and use the `/admin` workspace
  for appointment status, services and Storage image management. Admins can
  invite additional staff through the protected Edge Function.
- Postgres triggers create notification rows/outbox jobs. The scheduled worker
  sends transactional mail and performs late pending cancellation/reminders.

For migration, password handling, timezone guarantees, scheduler setup,
rollback, and the explicit legacy boundary, read
[`database/supabase/README.md`](database/supabase/README.md).
