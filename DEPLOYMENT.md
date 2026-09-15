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

## Vercel setup

Import the repository with the Root Directory left at the repository root.
[`vercel.json`](vercel.json) already runs `npm ci` and `npm run build` from
`frontend/`, publishes `frontend/dist`, and rewrites client-side routes to
`index.html`. If a Vercel project is configured with `frontend` as its Root
Directory instead, remove that override or use a separate frontend-only
configuration; the root config is intended to own the project settings.

The frontend build requires Node 22.12+ (declared in `frontend/package.json`).
Vercel Node 22.x and 24.x both satisfy that requirement; do not select Node
20.x or older because Vite 8 requires Node 22.12+.

Set these Vercel build-environment variables for Preview and Production:

| Variable | Scope | Where to obtain it |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser-safe | Supabase Dashboard → Connect dialog → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser-safe | Supabase Dashboard → Settings → API Keys → Publishable key (or the legacy anon key) |
| `VITE_SITE_URL` | Browser-safe | Verified production origin: `https://luxe-glow-astrid.vercel.app` (replace only if the public domain changes) |
| `VITE_ASSET_BASE` | Browser-safe | `/` for a normal Vercel domain; use the deployed sub-path only when one is configured |
| `VITE_ROUTER_BASE` | Browser-safe | `/` for a normal Vercel domain; it must match `VITE_ASSET_BASE` |
| `VITE_SESSION_IDLE_TIMEOUT_MINUTES` | Browser-safe, optional | A bounded timeout in minutes; defaults to 30 when omitted |

Only the `VITE_` values are bundled into the browser. The URL and publishable
key are designed to be public and must still be protected by Supabase RLS;
never put a service-role or other secret key in a `VITE_` variable.

`VITE_SITE_URL` must be the real origin (scheme plus host, with no path) for
the deployment that will be indexed. The build uses it for the canonical,
Open Graph, structured-data, and sitemap URLs. If it is omitted, Vercel builds
fall back to `VERCEL_PROJECT_PRODUCTION_URL` (or `VERCEL_URL`) when Vercel
system environment variables are exposed; no placeholder origin is emitted.

The SEO baseline is static and dependency-free: the build emits `robots.txt`,
`sitemap.xml`, root metadata, and evidence-based BeautySalon JSON-LD, while the
client updates titles, canonicals, social metadata, and `noindex` for each
route. Because this is a client-rendered SPA, crawlers that do not execute
JavaScript will only see the root document metadata; live services, reviews,
and business details loaded from Supabase are not available for route-specific
static indexing without SSR or prerendering.

The Supabase Edge Functions remain an external deployment. Set their secrets
with `supabase secrets set` (never in Vercel or tracked files):

- `SUPABASE_URL`: Supabase Dashboard → Connect dialog → Project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard → Settings → API Keys →
  secret service-role key. It is server-only.
- `RESEND_API_KEY`: Resend Dashboard → API Keys. Used by
  `reset-staff-password`.
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`: credentials and
  SMTP endpoint supplied by the transactional mail provider for
  `process-notifications`.
- `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`: the verified sender configured with
  that mail provider.
- `CRON_SECRET_TOKEN`, `LOGIN_RATE_LIMIT_SECRET`: long random values generated
  by the operator; the scheduler sends the former as `x-cron-token`.
- `AUTH_PROXY_SECRET_KEY`: Supabase Dashboard → Settings → API Keys → create a
  secret API key. It is the `sb_secret_...` key used only by
  `login-rate-limit`.
- `ALLOWED_ORIGIN`: the exact Vercel deployment origin, such as
  `https://your-site.vercel.app`, with no path or trailing slash.
- `APP_ROUTER_BASE`: `/` for this root-hosted deployment (or the matching
  sub-path if the app is intentionally mounted below the domain root).
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`:
  Cloudinary Console → Product Environment Settings → API Keys; all three are
  server-only and the API secret must never reach the browser.

`SUPABASE_DB_URL`, `SUPABASE_PDO_DSN`, `SUPABASE_DB_USER`, and
`SUPABASE_DB_PASSWORD` are migration/import inputs only; obtain them from the
Supabase Dashboard → Connect dialog database connection details and keep them
on the migration operator's machine. `LEGACY_DB_*` values are one-time MariaDB
exporter inputs and are not Vercel or Edge Function variables.

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
