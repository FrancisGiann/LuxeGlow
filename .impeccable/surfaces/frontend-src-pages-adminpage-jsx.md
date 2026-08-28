---
version: 1
slug: "frontend-src-pages-adminpage-jsx"
primary_target: "frontend/src/pages/AdminPage.jsx"
related_targets: []
---

Scope: Protected /admin workspace for staff and administrators. Mode: Operate.
Audience/job/action: Front-desk staff scan today’s appointments, update status, reschedule, inspect customers, manage services/images and published content; administrators additionally manage staff access.
Important states: Loading, empty collections, selected appointment/customer, Pending/Confirmed/Completed/Cancelled, save success, validation/API error, inactive staff, role restrictions, and mobile overflow.
Constraints: Preserve all current RLS-backed actions, role gates, staff invitation/reset, service image upload, customer history, FAQ/business editing, and Manila-time behavior. Do not add walk-ins, payments, reports, extra locations, staff assignment, or fabricated KPIs.
Direction: Soft Luxury Salon identity with the Appointment Atelier right-hand composition. Approved comp: .impeccable/mocks/dashboard/appointment-atelier.webp. Use a restrained light operate scene suitable for a bright front desk.
Component grammar: Slim functional rail, dense central appointment table/list, persistent contextual inspector on wide screens, familiar inputs, fine dividers, restrained status tint, 12–16px corners, tabular numerals, no nested cards.
Memorable moment: Selecting an appointment opens its real details and actions in place; staff retain the queue context while updating or rescheduling.
Unresolved: Generated customer names, phone numbers, notes, dates, and direct Cancel button in the comp are illustrative and must not become production data or new capability.
