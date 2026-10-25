# Local reschedule approval draft

This draft is in the task workspace, based on the maintained LuxeGlow checkout
including its existing uncommitted changes. The original checkout is unchanged.
The migration was applied only to an isolated, no-network PostgreSQL container with synthetic data; it has not been applied to the project or a live database. No project/live push, deployment, account creation, key retrieval, SMS, email, or appointment operation was performed.

## Behavior

- Customers submit a proposed time and reason. This inserts a separate request;
  the original appointment's time, status, staff assignment, duration and price
  remain intact. The proposed slot is not reserved.
- A newer customer request supersedes the prior pending request without deleting
  history. Every approval addresses an immutable request ID, never a client-chosen
  replacement time. Retries of an already-resolved decision return its result.
- Staff cannot initiate an arbitrary reschedule. The UI has a review-only dialog,
  the client API no longer exposes the direct method, and the migration revokes
  and disables the former database RPCs for both customers and staff.
- Approval takes the existing schedule/date/staff locks, locks the appointment
  and request, checks the original snapshot and revalidates eligibility, time,
  hours, active/bookable staff and overlaps. Only then does it move the allocation
  atomically. The booking status and assigned staff are retained; a Pending booking
  still needs the normal confirmation action.
- Rejection needs a reason and retains the original allocation. A changed,
  cancelled, completed, arrived or expired original appointment makes the request
  stale. A slot conflict at approval resolves the request as conflicted while
  retaining the original booking. The customer can submit a new request if still
  eligible. Existing cancellation and no-show rules are unchanged.
- Customer and staff views show request history. Pending requests appear above
  the staff appointment queue, independently of its filters, with an explicit
  refresh control. Availability excludes the original appointment itself, so an
  overlapping replacement can be requested without releasing the original slot.
- Existing booking email/in-app notifications run when an approved move changes
  the appointment, with accurate approval wording. Old reminders are invalidated
  by the existing trigger. Request receipt and decline/conflict notices are in-app.
  No booking/status SMS is introduced.

## Confirmed role and remaining phone policy

1. **Approval role confirmed:** both active Head and Admin approve or reject customer requests. `can_approve_reschedule()` retains the existing `is_staff()` boundary. Both roles lack direct appointment Reschedule/Cancel actions; arbitrary rescheduling RPCs and raw appointment-time changes are denied. Existing manual-cancellation denial is preserved. Other "Cancel" labels in the staff page close service/account dialogs; they do not cancel appointments.
2. **Phone verification:** UniSMS is for verification codes only. No mandatory phone
   gate is enabled in this draft. Conservative proposal: leave existing users and
   bookings accessible, add nullable verified-phone metadata, allow voluntary
   verification, clear verification after a phone change, and decide separately
   whether new registrations or a future sensitive action require it. Do not
   bulk-mark old numbers verified, require retroactive verification to log in, or
   cancel/reassign appointments because a number is unverified.

For a later OTP implementation, use a server-only provider adapter, expiring
hashed codes, bounded verification attempts, resend cooldowns and per-number/user
limits. Do not log codes or expose provider keys in Vite. Normalize Philippine
numbers, explain the default sender's Globe/DITO restriction, and avoid claiming
carrier support from prefixes because numbers can be ported. Retain email access
for existing users and unsupported numbers until the gate policy is decided.

Account/pagination fixes remain plan-only. Unavailability is omitted entirely.

## Verification and limits

- Production Vite build passes (existing large-bundle advisory remains).
- All 57 frontend test files pass, including 11 new fully mocked request/review
  API and outcome tests. These verify client payloads, authorization guards,
  invalid-input behavior, no automatic retry, history and stale/conflict feedback.
- Changed-source lint reports zero errors; the existing AdminPage effect warnings
  remain. Synthetic desktop/mobile browser checks used a separate temporary tab. Other project tabs were untouched.
- After explicit user approval, all 41 repository migrations ran in official `postgres:16`, inside container `luxe-reschedule-qa-20261025` with no network, no published ports, no host mounts and temporary fake data. The test container was removed after verification. All 52 actual SQL permission/state/race checks passed. The harness applies real migrations with minimal synthetic Supabase Auth/Storage scaffolding; it does not exercise the hosted Auth, Storage, PostgREST, Realtime or email services.
- Races used held PostgreSQL transactions and observed wait states: approval versus approval, ordinary booking versus approval, and customer cancellation versus approval. At most one allocation won each conflicting slot, with originals retained or cancelled according to the authorized workflow.
- Visual checks covered customer request/submission, Admin/Head appointment details, Head History details, mobile long-reason wrapping, and conflict feedback. No horizontal overflow was observed at 390px. Two scoped fixes added an explicit empty-queue message and moved keyboard focus to the conflict outcome after decision controls disappear.
- QA fixtures in `frontend/qa` replace authentication/API/notification modules and block client fetches. They never use project credentials or service connections. Their entry is separate from the production app entry.

The actual database suite covers ownership/RLS and direct-write denial; original-slot retention; slot conflicts; simultaneous approvals; concurrent booking/cancellation; superseded IDs; arrival/status/expiry invalidation; closure and staff deactivation; legacy assignments; partially overlapping replacements; both Pending/Confirmed status preservation; retries; stale reminder invalidation; and one approved-move email job. Mocked API tests are not used as proof of database guarantees. Full hosted end-to-end delivery remains outside this local task.

Both migration trees contain identical `20261025000000_customer_reschedule_approval.sql`.
The change patch is relative to the captured, uncommitted working baseline, not
just Git HEAD. Compare the baseline manifest before applying it to a later checkout.
