# Edge Functions

Deploy the functions with the Supabase CLI:

```sh
supabase functions deploy process-notifications --no-verify-jwt
supabase functions deploy invite-staff --no-verify-jwt
supabase functions deploy reset-staff-password --no-verify-jwt
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... RESEND_API_KEY=... \
  MAIL_FROM_ADDRESS=... MAIL_FROM_NAME="Astrid Nails & Beauty Bar" \
  CRON_SECRET_TOKEN=... ALLOWED_ORIGIN=https://your-site.example
```

`process-notifications` deliberately authenticates its own random
`x-cron-token`, because a scheduler does not have a customer JWT. Schedule a
POST every minute through Supabase's scheduler/`pg_cron`, GitHub Actions,
Cloudflare Cron or an equivalent secret-aware scheduler:

```sh
curl -fsS -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notifications \
  -H "x-cron-token: $CRON_SECRET_TOKEN"
```

Do not place the service key or cron secret in the browser. `invite-staff`
requires a caller bearer token and checks the caller's `profiles.role = admin`
using the service client before calling `auth.admin.inviteUserByEmail`.
`reset-staff-password` uses the same admin check, sends a one-time Auth recovery
link through Resend, and never returns a password or reset token to the browser.
