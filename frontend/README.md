# LuxeGlow frontend

This React/Vite app talks directly to Supabase with the publishable anon key.
There is no PHP session or same-origin API proxy in the active frontend.

```sh
npm install
cp .env.example .env.development
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
npm run build
npm run lint
```

The client-side `src/api` modules only issue RLS-protected PostgREST queries,
Storage operations, and the `book_appointment` RPC. Service-role operations
such as staff invitations and notification email delivery run in Supabase
Edge Functions. See [`../database/supabase/README.md`](../database/supabase/README.md)
for deployment and migration instructions.
