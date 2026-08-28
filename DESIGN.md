# Astrid Nails & Beauty Bar — shipped design system

This document records the shipped interface direction for the Soft Luxury Salon system. It is an implementation contract alongside [PRODUCT.md](PRODUCT.md), not a source of product claims. The approved visual references are [the public canon](.impeccable/mocks/decision/canon.webp) and [the Appointment Atelier comp](.impeccable/mocks/dashboard/appointment-atelier.webp), with their prompt sidecars next to each image.

## Visual thesis

The product presents Astrid Nails & Beauty Bar as a calm, considered Lucena City appointment journey: editorial beauty presentation in public surfaces, then a precise workbench for customers and staff. Warm porcelain grounds, deep ink, plum actions, blush fields, fine rules, restrained brass, and real operational content form one world. LuxeGlow is a subordinate product label; Astrid Nails & Beauty Bar remains the salon identity.

## Tokens and typography

- Public ground is warm porcelain around `#FAF7F4`; app ground is `#FBFAF9`.
- Ink is deep navy/ink; plum is the primary action family around `#4A146B` and `#6C147E`.
- Blush fields are around `#EBDFDC`; brass is restrained around `#E2CEB1` / `#B69A42`.
- Bodoni Moda is the high-contrast display face. Manrope is the workhorse sans. Both load through the existing Google Fonts link in `frontend/index.html`.
- Use 12–16px corners, generous whitespace, fine 1px rules, and either a border or a shallow shadow per surface. Pills are reserved for compact status/control treatments. Decorative gradients are not part of this system.

## Composition and navigation

The public first viewport uses a familiar, restrained header and a split editorial hero: the exact headline “Beauty care, booked around you.”, Lucena City context, clear “Book an appointment” and “Explore services” actions, one dominant salon scene, and nails/lashes treatment crops. Real services, published feedback, about information, FAQs, and footer details continue below through live data.

Customer routes remain separate one-active-workspace views: Overview, Book Appointment, My Appointments, Notifications, Ratings & Reviews, and My Profile. The shell uses a slim rail on wide screens and a drawer on small screens. Booking keeps real service selection (one to eight), date/slot loading, validation, booking RPC, errors, summary, receipt, and the in-salon payment note.

Admin remains a protected one-active-tab workspace: Appointments, Services, Customers, FAQs, Business info, and admin-only Staff accounts. The active tab keeps its list/work area and contextual inspector together; selecting an appointment or customer does not discard queue context. Completed and Cancelled appointments remain readable but are read-only. Small screens replace the rail with a usable section select and stack inspector content without page overflow.

## Supported states and behavior

Loading, empty, error, success, toast, modal, receipt/print, validation, and mobile states are explicit. Auth remains role-aware: email links are primary, optional six-digit signup/recovery codes are accepted when an email template provides them, and a blank recovery code preserves the secure `PASSWORD_RECOVERY` session flow. Existing Supabase/RLS-backed APIs, routes, role boundaries, timezone behavior, and backend data are unchanged.

## Image provenance and review artifacts

The shipped rasters are `frontend/public/homepage_hero.jpg`, `frontend/public/nails_hero.jpg`, and `frontend/public/lashes_hero.jpg`. They are existing project imagery with intended-use provenance embedded in their image metadata; the provenance scan is run with `.agents/skills/impeccable/scripts/embed-prompt.mjs --scan frontend/public`. Visual review artifacts are `.impeccable/review/hero-repro.png`, `.impeccable/review/desktop.png`, and `.impeccable/review/mobile.png`.

## Do / don’t

- Do keep copy grounded in live salon data and describe feedback as published customer feedback; do not call it independently verified.
- Do preserve one active customer route or admin tab at a time, real controls, semantic inputs, keyboard access, touch-sized actions, and visible state feedback.
- Do use intentional image crops, editorial hierarchy, fine rules, and restrained elevation to carry the salon world.
- Don’t add invented services, staff, locations, policies, awards, ratings, fees, payments, reports, walk-ins, stylist assignments, or operational KPIs.
- Don’t introduce emoji/Unicode icons, purple SaaS gradients, nested card walls, eyebrow labels above headings, or unsupported backend capabilities.
