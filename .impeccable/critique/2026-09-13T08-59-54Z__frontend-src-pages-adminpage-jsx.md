---
target: admin dashboard UI, option density, and staff versus administrator visibility
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-09-13T08-59-54Z
slug: frontend-src-pages-adminpage-jsx
---
## Verdict

Yes—the dashboard is a little overwhelming, but the problem is the information architecture, not the visual style. The UI has a solid, calm foundation and uses one active workspace at a time, so it is not a bad dashboard. The friction comes from putting seven staff sections and eight admin sections into one flat, equally weighted navigation list.

The best fix is to preserve every capability while grouping it by frequency:

- **Daily work:** Overview, Appointments, Customers
- **Salon setup:** Services, Hours & closures
- **Website content:** FAQs, Business info
- **People & access:** Staff accounts (admin only)

I would also make **Today’s appointments** the operational landing focus and visually demote monthly metrics such as “Weekend bookings this month.”

## What staff and administrators see

| Area | Normal staff | Administrator |
|---|---:|---:|
| Overview and operational metrics | Yes | Yes |
| All appointments, customer/service details, status changes, rescheduling | Yes | Yes |
| Services, publishing, images, homepage curation | Yes | Yes |
| Customer contact details and appointment history | Yes | Yes |
| FAQs and business information | Yes | Yes |
| Hours, closure dates, and schedule conflicts | Yes | Yes |
| Staff notifications | Yes | Yes |
| Staff accounts | No | Yes |
| Invite staff/admin accounts | No | Yes |
| Change role, activation, booking eligibility, and position title | No | Yes |
| Send staff password-recovery email | No | Yes |
| Inspect each staff member’s availability, appointments, and published rating | No | Yes |

The current role split is intentionally narrow: normal staff get almost the whole operational/content workspace; administrators get one extra Staff accounts area for identity and access management.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3/4 | Loading, success, error, and busy states exist; not every operation has equally specific feedback. |
| 2 | Match with the real world | 4/4 | Salon language, pesos, Manila-time dates, and appointment states are clear. |
| 3 | User control and freedom | 3/4 | Dialogs have exits and terminal records become read-only; saved status changes have no undo. |
| 4 | Consistency and standards | 3/4 | Components and interaction patterns are coherent; role naming and flat navigation weaken consistency. |
| 5 | Error prevention | 3/4 | Consequential changes are confirmed and inputs constrained; appointment triage lacks date/status controls. |
| 6 | Recognition over recall | 3/4 | Active location and contextual details are visible; locating a booking still relies on scanning. |
| 7 | Flexibility and efficiency | 2/4 | No appointment search/filter, scheduled-time default, bulk actions, or shortcuts are evident. |
| 8 | Aesthetic and minimalist design | 3/4 | The restrained token system is strong; the section hierarchy carries unnecessary equal weight. |
| 9 | Error recovery | 3/4 | Errors are surfaced and availability offers retry; completed mutations generally cannot be undone. |
| 10 | Help and documentation | 1/4 | Complex scheduling and access concepts have little contextual guidance. |
| **Total** |  | **28/40** | **Good foundation; focused restructuring needed.** |

## Design specificity

The surface feels authored for Astrid Nails & Beauty Bar: warm porcelain, plum/brass accents, serif/sans pairing, Lucena-time scheduling, peso pricing, and salon-specific operational copy. The workbench structure itself—rail, metric cards, list, inspector—is conventional, but appropriately so for an operations tool.

The deterministic scan found **0 rule violations** in `AdminPage.jsx`. That is useful evidence that the source avoids common visual anti-patterns, but it does not invalidate the cognitive-load issue: a detector cannot decide whether eight legitimate destinations deserve equal prominence.

A signed-in browser review was not possible because `/admin` correctly redirected the unauthenticated fresh tabs to the login modal. Mutable overlay injection was also unavailable, so there is no reliable user-visible overlay and rendered spacing/contrast claims remain provisional rather than invented.

## What is working

- The soft-luxury visual system is restrained and product-specific rather than generic purple SaaS styling.
- Appointment details and actions stay together in a contextual inspector, while completed/cancelled records are protected from further editing.
- Consequential actions use confirmation copy, and the UI explicitly distinguishes appointment counts from revenue/payment figures.
- Mobile navigation has unusually good fundamentals: a current-section cue, Escape/backdrop close, focus containment/return, scroll locking, and touch-sized controls.

## Priority issues

**[P1] Appointments are a complete archive, not a strong daily queue**

The list renders the full appointment collection, ordered by record creation rather than scheduled time, with no date, status, or search controls. During a busy shift, staff must manually scan to find today’s work.

**Fix:** Default to today, order by appointment time, expose compact date/status filters, and retain an obvious All appointments reset.
**Suggested command:** `$impeccable distill`

**[P2] The top-level navigation is too flat**

Seven destinations for staff and eight for administrators exceed a comfortable single choice set. Daily work, occasional configuration, public-site content, and access management receive the same weight.

**Fix:** Group sections under Daily work, Salon setup, Website content, and People & access. Keep group labels visible and avoid hiding today’s core tools.
**Suggested command:** `$impeccable distill`

**[P2] The overview gives equal prominence to unequal information**

Today’s bookings and Pending requests drive immediate work. Bookings this month, Weekend bookings this month, and Popular services are secondary. Equal cards make the user decide what matters instead of expressing that priority.

**Fix:** Lead with today/pending and a short actionable queue; demote monthly insights below the fold or into a compact secondary summary.
**Suggested command:** `$impeccable layout`

**[P2] Role identity is under-explained**

Staff and administrators share nearly everything, but the UI does not visibly explain the current role. Elsewhere, normal staff can encounter the label Admin dashboard.

**Fix:** Standardize on Staff workspace, show a small Staff or Administrator role label near the signed-in name, and reserve admin language for the accounts/access area.
**Suggested command:** `$impeccable clarify`

**[P3] Contextual guidance is sparse**

Schedule conflicts, booking eligibility, and account activation are consequential concepts. The copy is generally good, but there is no lightweight help path for unfamiliar staff.

**Fix:** Add short inline guidance only beside the complex controls; avoid a documentation wall.
**Suggested command:** `$impeccable onboard`

## Persona red flags

**Alex, the experienced front-desk user:** No appointment filtering, schedule-first ordering, keyboard accelerators, or bulk path is evident. Repeated record opening will become the dominant cost during a busy shift.

**Sam, the keyboard/screen-reader user:** The source has labeled controls, visible-focus classes, semantic dialogs, Escape handling, live status/error roles, and large targets. No static blocker was found, but authenticated testing at 200% zoom and with real screen-reader announcements is still required.

**Casey, the interrupted mobile staff member:** Selecting an appointment replaces the list with its detail view. The Back to appointments path is clear, but returning from an interruption requires reconstructing queue position unless selection/scroll state is preserved.

## Minor observations

- The overview’s not payment or revenue figures note is an excellent trust guardrail.
- The desktop list/inspector pattern fits this product better than opening every appointment in a modal.
- Loading every workspace dataset together may make initial access feel heavier than necessary; lazy-loading the active section would reinforce the proposed hierarchy.
- Normal staff can query profile data under the current staff RLS policy even though the Staff accounts UI is hidden. That may be intentional for operations, but hidden in navigation should not be treated as the security boundary; the admin-only mutations are separately guarded.

## Questions to consider

- Should a shift worker land on Today’s queue while administrators retain Overview?
- Which occasional settings genuinely need to stay one click from the sidebar?
- Would the monthly metrics change a same-day decision, or are they better treated as secondary insight?
