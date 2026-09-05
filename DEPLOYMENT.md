# LuxeGlow deployment

The active product is the React/Vite SPA in `frontend/` with Supabase as its
database and authentication boundary. The PHP/MySQL tree is rollback-only and
is not part of deployment.

## Release checklist

1. Review the forward migration in both `supabase/migrations/` and
   `database/supabase/migrations/`. They must remain byte-identical. Link the
   intended Supabase project and apply migrations with `supabase db push`.
2. Configure the production Supabase URL, anonymous key, router base, and
   asset base in the frontend host environment. Never expose a service-role key
   through a `VITE_` variable.
3. From `frontend/`, run `npm ci`, `npm test`, `npm run lint`, and
   `npm run build`. Publish `frontend/dist` to the static host.
4. Configure the host's SPA fallback so `/book`, `/dashboard/*`, and `/admin`
   resolve to `index.html`. Configure the Supabase Auth email and recovery
   redirect URLs for the same public origin.
5. Deploy the existing Edge Functions and their server-only secrets according
   to [`supabase/functions/README.md`](supabase/functions/README.md). Keep the
   notification worker schedule and cron header configured in the Supabase
   project.

## Schedule and booking smoke checks

After applying the migration, verify the staff Schedule tab can save a weekly
interval and a full-day closure, reports conflicts without changing existing
appointments, and that public availability reflects both. Verify that an
appointment ending exactly at the configured close is offered and accepted,
while a slot whose end would pass close is absent and rejected by the RPC.
Also verify guest service deep links, draft restoration after sign-in, and that
the explicit final submit is required before an appointment is created.

Rollback follows the project migration runbook in
[`database/supabase/README.md`](database/supabase/README.md); do not edit the
legacy PHP surface as part of a React/Supabase release.
