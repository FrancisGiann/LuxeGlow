# Edge Functions

Deploy the functions with the Supabase CLI:

```sh
supabase functions deploy process-notifications --no-verify-jwt
supabase functions deploy invite-staff --no-verify-jwt
supabase functions deploy reset-staff-password --no-verify-jwt
supabase functions deploy upload-service-image --no-verify-jwt
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... RESEND_API_KEY=... \
  MAIL_FROM_ADDRESS=... MAIL_FROM_NAME="Astrid Nails & Beauty Bar" \
  CRON_SECRET_TOKEN=... ALLOWED_ORIGIN=https://your-site.example \
  CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=...
```

Before deploying the image function, apply the canonical migrations (including
`20260829003000_cloudinary_service_images.sql`) with `supabase db push`. The
`CLOUDINARY_*` values are server-only Upload API credentials: set them with
`supabase secrets set`, never add them to a `VITE_` variable, and never expose
the API secret to the browser. `ALLOWED_ORIGIN` must be the exact origin of the
deployed SPA (for example `https://your-site.example` without a trailing path);
the function handles its own bearer-token verification, so keep
`--no-verify-jwt` enabled.

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
`upload-service-image` requires an active staff/admin profile, accepts only
JPEG/PNG/WebP multipart uploads up to 5 MB, uploads to Cloudinary under the
`luxeglow/services/{service_id}/` prefix, then stores Cloudinary's `secure_url`
in `services.image_path` and its `public_id` in `services.image_public_id`.
Cloudinary replacement cleanup uses `public_id` with invalidation; legacy
relative Supabase Storage paths are never sent to Cloudinary for deletion.

For a deployment smoke test, send a request whose numeric `Content-Length`
exceeds 5 MiB plus the allowed multipart overhead and confirm the function
returns JSON `413`; normal requests still pass the authoritative byte and
signature checks after multipart parsing. Start two valid uploads for the same
service at the same time and confirm one succeeds while the other returns JSON
`409`; the service row must contain only the winning upload's URL/public ID,
and the losing Cloudinary asset is cleaned up best-effort.
