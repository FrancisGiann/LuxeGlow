# LuxeGlow frontend

This React/Vite app talks directly to Supabase with the publishable anon key.
There is no PHP session or same-origin API proxy in the active frontend.

Booking selections are saved in the current browser session while signing in.
The customer reviews their name, services, date, and time on a separate screen;
the appointment is created only after the final availability check and explicit
confirmation. Customers can change the date/time or cancel an upcoming booking
from My appointments, subject to the owner-scoped Supabase RPC rules.

```sh
npm install
cp .env.example .env.development
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
npm run build
npm run lint
```

The client-side `src/api` modules only issue RLS-protected PostgREST queries
and the `book_appointment` RPC. Staff service-image uploads, invitations, and
notification email delivery run in authenticated Supabase Edge Functions;
Cloudinary credentials stay server-side. See
[`../database/supabase/README.md`](../database/supabase/README.md) for
deployment and migration instructions.
