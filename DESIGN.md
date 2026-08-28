# Astrid Nails & Beauty Bar — shipped design system

This document records the shipped interface direction for the Soft Luxury Salon system. It is an implementation contract alongside [PRODUCT.md](PRODUCT.md), not a source of product claims. The approved visual references are [the public canon](.impeccable/mocks/decision/canon.webp) and [the Appointment Atelier comp](.impeccable/mocks/dashboard/appointment-atelier.webp), with their prompt sidecars next to each image.

## Visual thesis

The product presents Astrid Nails & Beauty Bar as a calm, considered Lucena City appointment journey: editorial beauty presentation in public surfaces, then a precise workbench for customers and staff. Warm porcelain grounds, deep ink, plum actions, blush fields, fine rules, restrained brass, and real operational content form one world. LuxeGlow is a subordinate product label; Astrid Nails & Beauty Bar remains the salon identity.

## Tokens and typography

- Canvas is warm parchment `#F6EDE7`; raised surfaces are warm ivory `#FFF8F3`, with blush fields around `#EBDFDC`.
- Headings use aubergine `#3D1D3D`; cocoa-plum body ink uses `#553D4D` and `#6F5966` for secondary copy.
- Plum is the primary action family around `#4A146B` and `#6C147E`; brass is restrained around `#D5BD8F`, `#A48638`, and readable brass text `#796323`.
- Lora is the readable editorial serif for display, headings, and the salon wordmark. Manrope is the workhorse sans for body and operational text. Both load through the existing Google Fonts link in `frontend/index.html`.
- Use 12–16px corners, generous whitespace, fine 1px rules, and either a border or a shallow shadow per surface. Pills are reserved for compact status/control treatments. Decorative gradients are not part of this system.

Representative WCAG contrast ratios (calculated against the shipped solid tokens): `ink-900` is 12.62:1 on canvas / 13.86:1 on surface; `ink-700` is 8.42:1 / 9.24:1; `ink-500` is 5.52:1 / 6.06:1; and `ink-300` placeholder text is 4.58:1 / 5.03:1. White text on the primary `brand-800` action is 13.10:1. Status text is darkened for its 10% tinted fields: success is 5.72:1 on canvas tint, warning 5.31:1, and danger 4.61:1 (all at least WCAG AA for body text).

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
