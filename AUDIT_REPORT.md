# AUDIT_REPORT.md — Astrid Nails & Beauty Bar (Luxeglow)
Audit date: 2026-08-25 · Auditor scope: full repository (React SPA, PHP API, legacy
admin panel, MySQL schema, cron jobs, config/deploy) · Commit base: 8e6d158

---

## 1. Executive Summary

The system is a salon appointment platform: React SPA frontend over an untouched
legacy PHP/MySQL API, plus a vanilla-PHP staff/admin area. Core booking logic is
soundly engineered (server-side price/duration recalculation, prepared statements,
status enums), but the audit identified **20 findings: 1 Critical, 4 High,
7 Medium, 7 Low, 1 Informational**.

The Critical finding exposes every customer's personal data (names, emails,
phones, spend, full booking histories) to unauthenticated users due to two
endpoints whose auth guards were never implemented — the source contains TODO
comments admitting it. Three High findings follow: an authenticated
file-upload path to remote code execution, a race condition that permits
double bookings (violating the system's core objective), and a foreign-key
CASCADE that silently rewrites historical appointment records when a service
is deleted. A stored-XSS sink in the legacy admin panel enables Staff→Super
Admin privilege escalation.

No code was modified during this audit. Findings are evidence-backed with
file/line references; live-data reproduction was deliberately limited to
non-destructive checks.

## 2. Architecture & Trust Boundaries

```
Browser ─┬─► React SPA (frontend/dist deployed to project root)
         │     routes: / marketing · /dashboard/* customer app
         │     auth: PHP session cookie (includes/auth/*)
         ├─► Legacy admin: admin_dashboard.php + assets/js/admin-page/admin.js
         │     roles: Super Admin | Staff (staff_accounts.role)
         └─► JSON API /includes/** (~30 endpoints) ──► MySQL astrid_nails
                                                    ──► PHPMailer SMTP
Cron: HTTP GET includes/cron/run_notifier.php?token=… → reminders +
15-minute auto-cancel sweep.
```

Trust boundaries: anonymous → customer (bcrypt password + email OTP verify)
→ Staff → Super Admin. Uploads served raw from `/uploads`. Sessions are PHP
native cookies; no CSRF tokens anywhere (relies on browser SameSite defaults).

## 3. Scope & Limitations

In scope: all application code, endpoints, schema (live introspection),
migrations, cron jobs, both frontends, configs. Out of scope / unverifiable:
external cron scheduling (cron-job.org side), production TLS/domain posture,
mod_php php.ini differences vs CLI, live concurrency exploitation (deferred —
would mutate production data), third-party browser-extension noise observed
during testing.

## 4. Commands & Tests Executed

| Check | Result |
|---|---|
| `php -l` across all project PHP files | PASS (all parse) |
| `node --check assets/js/admin-page/admin.js` | PASS |
| `npm run build` (frontend) | PASS (56 modules) |
| `npm audit` | 0 vulnerabilities |
| `git ls-files` secret scan | `.env` NOT tracked (only `*.example`, mode files) |
| Live schema introspection (`SHOW CREATE TABLE`, information_schema) | completed |
| Endpoint auth matrix (45 files swept for guards) | completed |
| Runtime ini checks (`cookie_httponly`, `samesite`, `use_strict_mode`) | off/unset/off |
| Curl smoke tests (home, API, redirects, login round-trip) | behaved as coded |

## 5. Findings

### [C-01] Customer master-list and detail endpoints require no authentication

- Severity: **Critical** · Confidence: **Confirmed**
- Category: Broken access control / mass PII disclosure
- Location: `includes/customers/list.php:6-8`; `includes/customers/detail.php:6-7`
- Affected roles/workflows: anonymous internet user → all customer records;
  feeds the admin Account Management page (Objective #4 feature)
- Evidence: both files begin with `// TODO: require admin session once Step 9
  (Account Management/admin login) is built` and proceed directly to queries.
  Auth-matrix sweep confirms no `require_admin`/session guard in either file.
  `detail.php` returns first/last name, email, phone plus full appointment
  history for any `customer_id`; `list.php` returns the entire table with
  visit counts and lifetime spend.
- Root cause: Step-9 integration debt — the admin UI shipped, the guards never did.
- Reproduction: `curl http://localhost/luxeglow/includes/customers/detail.php?customer_id=1`
  returns full PII JSON with no cookie.
- Impact: bulk scrape of all customers' personal data (PH Data Privacy Act
  exposure); enables phishing/spam targeting verified clients; contradicts the
  admin-only intent of Objective #4.
- Edge cases: integer-cast ID allows trivial sequential enumeration.
- Recommended fix: add `require_once __DIR__.'/../admin-auth/require_admin.php';`
  to both files (matches every other admin endpoint). Two-line change each.
- Regression tests: unauthenticated request → 401; staff-session request → 200;
  customer-session request → 401.
- Estimated effort: Small

### [H-01] Unrestricted service-image upload permits PHP code execution

- Severity: **High** (authenticated RCE path) · Confidence: **Confirmed** (code path; not exploited live)
- Category: Unsafe file upload
- Location: `includes/services/create.php:23-32`; `includes/services/update.php:36-44`
- Affected roles/workflows: any active Staff or Super Admin using Services Gallery
- Evidence: extension derived from client-supplied name
  (`pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION)`), no extension/MIME/
  size/content checks; file written into `htdocs/luxeglow/uploads/services/{id}-{time}.{ext}`,
  which Apache serves — and on XAMPP *executes* — directly. No role check beyond
  `require_admin` (Staff allowed).
- Root cause: upload handling written without an allowlist or execution guard.
- Reproduction: POST multipart to `services/create.php` with `image=@shell.php`
  as a logged-in staff account → file stored with `.php` extension → request its
  public URL → server executes it.
- Impact: remote code execution on the web server from a low-trust staff account.
- Edge cases: double extensions (`a.php.jpg`) harmless today since original ext
  is preserved verbatim; uppercase variants bypass naive blacklists.
- Recommended fix: allowlist `jpg/jpeg/png/webp` (case-insensitive); verify with
  `getimagesize()`/finfo; cap size (~2 MB); add `uploads/.htaccess` with
  `php_flag engine off` + `RemoveHandler .php`; prefer randomized filenames.
- Regression tests: upload `.php`/`.phtml`/`.phar` rejected; valid PNG accepted
  and served as `image/*`; oversized upload rejected.
- Estimated effort: Small

### [H-02] Race condition allows double bookings

- Severity: **High** · Confidence: **High** (code-verified; concurrency repro deferred)
- Category: Business invariant / concurrency / data integrity
- Location: `includes/appointments/create.php:49` (check) vs `:59` (transaction start);
  `includes/appointments/_overlap_helper.php:31-47` (non-locking SELECT)
- Affected workflow: online booking (Objectives #1 and #5)
- Evidence: `checkAppointmentOverlap()` executes a plain snapshot SELECT *before*
  `$pdo->beginTransaction()`; no `FOR UPDATE` anywhere. Under InnoDB REPEATABLE
  READ, two concurrent submissions can both observe the slot free and both insert.
  The BK-#### generator (`SELECT MAX(...)+1`) has the same unlocked pattern.
- Root cause: check-then-act across an unprotected read; transaction opened too late.
- Reproduction: fire two parallel POSTs to `create.php` for the same slot with a
  long-enough duration → both return `success:true`, rows overlap.
- Impact: overlapping appointments — the exact defect the system exists to prevent;
  silent revenue/time loss and staff confusion.
- Edge cases: also affects `reschedule.php` (same helper); PK collision on BK-id
  would fail one txn with a generic DB error instead of a friendly retry.
- Recommended fix: open the transaction first, then
  `SELECT ... FROM appointments WHERE appointment_date=? FOR UPDATE` (locks the
  day's rows) before evaluating overlap; keep server-side re-validation.
- Regression tests: scripted parallel double-submit of identical slot asserts
  exactly one success; unit test for overlap math boundaries (touching end/start).
- Estimated effort: Small–Medium

### [H-03] Deleting a service rewrites historical appointments

- Severity: **High** · Confidence: **Confirmed**
- Category: Data integrity / unsafe deletion
- Location: FK `appointment_services_ibfk_2 ... ON DELETE CASCADE` (live schema);
  trigger: `includes/services/delete.php:16-19`
- Affected workflows: admin Services Gallery delete; every consumer of
  `appointment_services` (customer dashboard history, admin lists/revenue,
  `_overlap_helper` duration SUMs)
- Evidence: deleting a service cascades deletion of its `appointment_services`
  rows — including rows belonging to Completed/past appointments. Historical
  service names vanish from dashboards; historical durations shrink, corrupting
  overlap calculations retroactively.
- Root cause: CASCADE chosen for catalog convenience, ignoring append-only nature
  of booking history.
- Reproduction: book appt with service X → delete X in admin → customer
  dashboard shows the past appointment without the service; duration sums change.
- Impact: irreversible corruption of financial/operational records; misleading
  reporting (Objective #4).
- Edge cases: deleting a service referenced only by future Pending bookings also
  breaks those bookings' duration integrity.
- Recommended fix: switch FK to `ON DELETE RESTRICT`; introduce soft-delete
  (`is_active` flag) for catalog removal; keep hard delete only for unused rows.
- Regression tests: delete used service → 409-style error; deactivate → history
  unchanged; overlap duration stable after deactivation.
- Estimated effort: Small (schema + endpoint)

### [H-04] Stored XSS in admin panel escalates Staff to Super Admin actions

- Severity: **High** · Confidence: **Confirmed** (sink + source traced; payload not fired live)
- Category: XSS / vertical privilege escalation
- Location: sink `assets/js/admin-page/admin.js:658` (`${b.service}` into
  `innerHTML`); source: service `name` editable by any Staff via
  `services/update.php`; secondary self-XSS sink `admin.js:401` (`filterText`)
- Affected roles/workflows: every admin-page view that renders services
  (appointment list, services gallery); victim includes Super Admin
- Evidence: legacy admin renders DB strings through template literals into
  `innerHTML`; no escaping utility exists in the file. React side is safe
  (0 `dangerouslySetInnerHTML`).
- Root cause: legacy vanilla-JS rendering predates security review; service names
  treated as trusted because admins enter them.
- Impact: Staff injects `<img src=x onerror=fetch('/includes/staff/create.php?…')>`
  → executes in Super Admin's session → unauthorized staff accounts / resets.
  Persistent (fires on every page load until removed).
- Edge cases: payload survives React homepage (escaped) — targets admin only.
- Recommended fix: escape at sink (textContent or esc() helper) for ALL
  interpolations in admin.js; sanitize service/FAQ text server-side
  (`htmlspecialchars` on output of list endpoints consumed by legacy pages).
- Regression tests: store `<img onerror>` as service name → rendered as text in
  admin lists; automated grep CI check forbidding unguarded innerHTML templates.
- Estimated effort: Small

### [M-01] Session cookies lack hardening; fixation possible

- Severity: Medium · Confidence: Confirmed
- Category: Session management
- Location: repo-wide (0 hits for `session_set_cookie_params` /
  `session_regenerate_id` / ini settings); runtime verified: httponly=off,
  samesite unset, use_strict_mode=off; `includes/auth/login.php` and
  `includes/admin-auth/login.php` populate `$_SESSION` without regenerating ID
- Affected roles/workflows: all sessions (customer + admin)
- Evidence: grep sweep returned zero hardening calls; CLI ini dump captured values above.
- Root cause: stock XAMPP session defaults never reviewed.
- Impact: JS-readable session cookie (amplifies H-04/XSS into full session
  theft); login CSRF/fixation; strict-mode off permits attacker-set IDs.
- Recommended fix: bootstrap snippet setting `cookie_httponly=1`,
  `samesite=Lax`, `use_strict_mode=1`, and `session_regenerate_id(true)` after
  every successful login/verify.
- Regression tests: assert Set-Cookie flags on responses; session id changes after login.
- Estimated effort: Small

### [M-02] Cron token hardcoded and transported in URL

- Severity: Medium · Confidence: Confirmed
- Category: Secret management / abuse
- Location: `includes/cron/run_notifier.php:12`
  (`$_ENV['CRON_SECRET_TOKEN'] ?? 'astrid_cron_secret_key_2026'`), `:14` (`$_GET['token']`)
- Impact: fallback constant ships in tracked source → anyone can invoke
  reminders/auto-cancel (mass email spam to customers, forced cancellations);
  query-string token leaks into access logs/history.
- Recommended fix: fail closed when env var missing (remove fallback); send token
  via `Authorization` header; rotate current value.
- Regression tests: request without/with wrong token → 401; header auth accepted.
- Estimated effort: Small

### [M-03] No rate limiting; OTP generation/storage weak

- Severity: Medium · Confidence: Confirmed
- Category: Brute force / authentication strength
- Location: `includes/auth/login.php`, `register.php`, `verify.php`,
  `resend_otp.php` (no throttling constructs repo-wide);
  `resend_otp.php:16` uses `mt_rand()`; OTP stored plaintext in
  `customers.otp_code`; `verify.php` compares equality only — no expiry, no
  attempt counter (no otp-expiry column in schema)
- Impact: unlimited credential stuffing; 10⁶-space OTP brute-forced via script;
  unthrottled resend → email bombing of arbitrary registered addresses.
- Recommended fix: `random_int(100000,999999)`; hash OTP at rest; add
  `otp_expires_at` + max attempts; per-IP/per-account counters on
  login/resend/verify.
- Regression tests: Nth wrong OTP locks verify; expired code rejected; >N
  resends/min throttled.
- Estimated effort: Medium

### [M-04] Appointment status transitions unvalidated

- Severity: Medium · Confidence: Confirmed
- Category: Business logic
- Location: `includes/appointments/update_status.php:9-13` (whitelist only)
- Impact: impossible states reachable — e.g. Pending future booking set straight
  to Completed (revenue stats inflate), Cancelled re-Confirmed (defeats auto-cancel
  semantics). Auto-cancel sweep can also overwrite a concurrent staff Confirm
  (lost update; see `_autocancel_helper.php` find-then-update gap).
- Recommended fix: transition map (Pending→Confirmed/Cancelled;
  Confirmed→Completed/Cancelled; terminal states locked); conditional autocancel
  UPDATE (`AND status IN ('Pending','Confirmed')` already present — pair with
  row lock or re-check).
- Regression tests: matrix test of legal/illegal transitions; autocancel vs confirm race.
- Estimated effort: Small

### [M-05] Timezone divergence between PHP and MySQL

- Severity: Medium · Confidence: Confirmed (values captured live)
- Category: Date/time correctness
- Location: PHP `date.timezone` unset (UTC); MySQL `time_zone=SYSTEM` (server local, UTC+8)
- Impact: currently latent (autocancel/reminders compare purely in SQL), but any
  future mixing of PHP `time()`/`date()` with SQL `NOW()` skews 8 hours; booking
  min-date computed in browser-local adds a third frame.
- Recommended fix: set `date.timezone = 'Asia/Manila'` in php.ini and align MySQL
  (`time_zone = '+08:00'`); document that appointment times are salon-local.
- Tests: cross-check NOW() vs PHP time within ±seconds.
- Estimated effort: Small

### [M-06] No security headers; plain-HTTP assumptions

- Severity: Medium · Confidence: Confirmed
- Category: Hardening / transport
- Location: root `.htaccess` (SPA rules only); no header directives anywhere
- Impact: clickjacking (no X-Frame-Options/frame-ancestors), MIME-sniffing,
  no CSP backstop against H-04-class bugs, credentials over HTTP locally.
- Recommended fix: add `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, referrer-policy, minimal CSP
  (`default-src 'self'; font/img https:`) — tuned for Google Fonts + inline
  legacy admin styles.
- Tests: `curl -I` assertions per header.
- Estimated effort: Small

### [M-07] Exception detail leaked in OTP resend

- Severity: Medium · Confidence: Confirmed
- Category: Information disclosure
- Location: `includes/auth/resend_otp.php` catch block returns
  `'Failed to resend email: ' . $e->getMessage()`
- Impact: SMTP host/transport internals disclosed to end users; inconsistent with
  the careful handler in `config/database.php`.
- Recommended fix: log details via `error_log`, return generic message.
- Regression tests: force mail failure → response contains no exception text.
- Estimated effort: Trivial

### [L-01] No CSRF tokens; protection relies on browser SameSite default

- Severity: Low · Confidence: Confirmed
- Location: all state-changing endpoints rely on session cookie only
- Impact: modern browsers default unset cookies to Lax, which blocks cross-site
  POSTs — but older/embedded browsers may differ; defense-in-depth gap.
- Fix: SameSite explicitly set (via M-01) is sufficient for this app class;
  full token layer optional. Effort: Small if pursued.

### [L-02] Self-XSS sink in customers search

- Severity: Low · Confidence: Confirmed
- Location: `assets/js/admin-page/admin.js:401` (`filterText` into innerHTML)
- Impact: admin attacking own session; fix alongside H-04.

### [L-03] Orphaned image files accumulate on replacement

- Severity: Low · Confidence: Confirmed
- Location: `includes/services/update.php:36-44` (old file unlinked only when
  `remove_image=1`, not when replaced)
- Impact: disk growth; stale images remain publicly reachable.
- Fix: unlink previous `image_path` before storing new one. Effort: Trivial

### [L-04] FAQ create accepts empty question/answer

- Severity: Low · Confidence: Confirmed
- Location: `includes/faqs/create.php:7-8` (trim only, no emptiness check)
- Impact: blank accordion entries on public site.
- Fix: validate non-empty like other endpoints. Effort: Trivial

### [L-05] Notification table grows without purge

- Severity: Low · Confidence: Confirmed
- Location: `user_notifications`; reads capped (`LIMIT 30`) but no retention job
- Impact: slow unbounded growth. Fix: periodic purge of read notifications >90 days.

### [L-06] Dead code and documentation drift

- Severity: Low · Confidence: Confirmed
- Location: empty `actions/` directory; unreferenced `public/favicon.svg`,
  `icons.svg`; `frontend/.env.example` documents `VITE_PHP_SUBDIR=Luxeglow`
  while actual folder is lowercase `luxeglow` (case-sensitive on Linux)
- Fix: remove dead items; correct example value. Effort: Trivial

### [L-07] Unauthenticated slot enumeration cost

- Severity: Low · Confidence: Confirmed
- Location: `includes/appointments/available_slots.php` — 16 sequential overlap
  scans per request, no auth, no cache
- Impact: trivial amplification for DoS-at-scale; acceptable at capstone traffic.
- Fix (optional): cache per date+duration for 30s. Effort: Small

## 6. Cross-cutting Architectural Concerns

- **Dual frontends**: React SPA (secure-by-default escaping) coexists with the
  legacy vanilla-JS admin (innerHTML patterns). Long-term risk concentration is
  the admin panel; consider migrating it last-but-eventually.
- **Auth debt pattern**: C-01's stray TODOs show guards were planned per-endpoint
  rather than enforced centrally — a router/front-controller would prevent
  recurrences of this bug class.
- **Function-library endpoints** (`notifications/create.php`,
  `email/send_notification.php`) are include-safe today but indistinguishable
  by URL convention.
- **Documentation drift**: see L-06.

## 7. Missing or Inadequate Tests

No test suite exists (zero PHPUnit/Vitest configurations). Untested critical
behavior, in priority order:

1. Overlap/duration math (`_overlap_helper.php` is a pure function — ideal first unit target)
2. Booking creation happy-path, conflict rejection, concurrency (H-02 regression)
3. Per-endpoint auth matrix — every `/includes` route should 401/403 anonymously (C-01 would have been caught)
4. Status transition legality (M-04)
5. One-review-per-appointment constraint end-to-end
6. Migration idempotence/reversibility

Recommended minimum: PHPUnit for the overlap helper boundary table + an
integration test asserting anonymous access is denied on all mutating routes.

## 8. Prioritized Remediation Roadmap

| Order | Item | Effort |
|---|---|---|
| 1 | C-01 auth guards (2 lines ×2) | Minutes |
| 2 | H-01 upload allowlist + uploads/.htaccess exec-off | Small |
| 3 | H-03 FK→RESTRICT + soft-delete column | Small |
| 4 | H-02 transactional locking around availability | Small–Med |
| 5 | H-04 escape admin.js sinks (+L-02) | Small |
| 6 | M-01 session bootstrap hardening | Small |
| 7 | M-03 rate limiting + OTP crypto/expiry | Medium |
| 8 | M-02, M-07 cron token fail-closed + error hygiene | Small |
| 9 | M-04 status transition map | Small |
| 10 | M-05 timezone alignment, M-06 headers, L-03/L-04/L-06 cleanups | Small |

## 9. Positive Controls Already Implemented Correctly

- PDO prepared statements exclusively, with `EMULATE_PREPARES=false` + utf8mb4 (`config/database.php`)
- Caller-aware DB error handler that never leaks credentials into responses
- bcrypt `password_hash()` with 8-char minimum and confirm-match validation
- Server-side recalculation of price AND duration (client totals ignored)
- `appointments.status` ENUM constraint, default Pending
- UNIQUE email index; one-review-per-appointment enforced in BOTH app logic and DB unique key
- SUPER-admin gating on all staff-management endpoints; server-side RBAC check inside `admin_dashboard.php`
- Notification dedup table (`appointment_notifications`) prevents reminder spam
- Ownership scoping on all customer-self-service mutations (queries filter by `$_SESSION['customer_id']`)
- React escapes all interpolation (0 `dangerouslySetInnerHTML`)
- Dependency hygiene: minimal composer set, `npm audit` clean, `.env` untracked
