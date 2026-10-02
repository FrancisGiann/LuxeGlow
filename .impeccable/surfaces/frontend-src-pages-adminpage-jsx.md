---
version: 1
slug: "frontend-src-pages-adminpage-jsx"
primary_target: "frontend/src/pages/AdminPage.jsx"
related_targets: []
---

Scope: Protected /admin workspace for staff and administrators. Mode: Operate.
Audience/job/action: Front-desk staff scan all-date Pending and Confirmed bookings, including overdue requests, update status, reschedule, inspect customers, manage services/images and published content; administrators additionally manage staff access.
Important states: Loading, empty collections, selected appointment/customer, Pending/Confirmed/Completed/Cancelled, save success, validation/API error, inactive staff, role restrictions, and mobile overflow.
Constraints: Preserve all current RLS-backed actions, role gates, staff invitation/reset, service image upload, customer history, FAQ/business editing, and Manila-time behavior. Staff/admins manage one weekly interval per day and full-day closures; save schedule changes even when active appointments conflict, surfacing references without mutating appointments. Show published staff rating aggregates only in this workspace and the optional booking picker. Do not add walk-ins, payments, reports, extra locations, or fabricated KPIs.
Direction: Soft Luxury Salon identity with the Appointment Atelier right-hand composition. Approved comp: .impeccable/mocks/dashboard/appointment-atelier.webp. Use a restrained light operate scene suitable for a bright front desk.
Component grammar: Slim functional rail, dense full-width appointment queue, familiar inputs, fine dividers, restrained status tint, 12–16px corners, tabular numerals, no nested cards. Keep search and the filter summary/count visible; place date/status/Today/All dates/reset controls under a Filters disclosure. Rows contain only date/time, customer name, services, and status. Show full customer, reference, team, service, arrival, and action details in a centered, focus-trapped dialog. Status and reschedule confirmations replace the details dialog, preserve the queue selection on cancellation, refresh after success, and close the selection when it leaves the active filter. Return focus to the initiating row or the queue heading if filtering removes it. Keep notification details in one dialog at a time and defer no-show prompts until appointment dialogs close. On small screens, replace the rail with a capped 320px off-canvas drawer opened by a hamburger trigger; preserve the role-gated section list and active-section context, with backdrop/Escape/navigation close, body scroll lock, and focus return to the trigger.
Memorable moment: Administrators and Heads enter a calm, all-date active booking queue; selecting a row opens its real details and actions while preserving the exact queue context underneath.
Unresolved: Generated customer names, phone numbers, notes, dates, and direct Cancel button in the comp are illustrative and must not become production data or new capability.
