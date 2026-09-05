# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Local customers in Lucena City booking nail, lash, spa, waxing, gentleman, or kiddie treatments for themselves or family members.
- Salon staff and front-desk operators managing appointments, customer records, services, business information, and published content.
- Salon administrators managing staff access and the same operational workspace.

## Product Purpose

Astrid Nails & Beauty Bar combines service discovery, online appointment requests, customer self-service, and salon operations in one product. Customers should be able to understand the treatment menu, find an available Manila-time slot, submit a booking request, and track its status. Staff should be able to operate the same appointment lifecycle without losing clarity or control.

Success means more qualified appointment requests, less scheduling friction, clear status communication, and an admin workspace that is efficient during daily salon operations.

## Positioning

The product joins a Lucena City salon's public presence directly to its booking and front-desk workflow: the treatment a customer chooses becomes the same appointment record that customers and staff track through Pending, Confirmed, Completed, or Cancelled states.

An exact competitive or commercial positioning statement remains open and must not be invented.

## Operating Context

- Customers browse services, open a service-led `/book?service=<id>` flow, keep a session-scoped guest draft, authenticate at the final submit action, select treatments and an optional staff preference, choose an available date and 30-minute time slot, submit a pending appointment, receive notifications, review appointment history, print appointment records, and review completed visits. Authentication never submits a saved draft automatically.
- Staff update appointment status, reschedule appointments, manage active services and images, inspect customer history, edit FAQs and business information, and manage weekly hours and full-day closure dates.
- Administrators can additionally invite staff, change staff roles or activation, and initiate staff password recovery.
- Appointment scheduling uses Asia/Manila time and currently allows dates up to 60 days ahead.
- The seeded weekly schedule is Monday–Saturday 10:00–20:00 and Sunday 11:00–18:00 until staff edit it. Each day has one continuous interval; full-day closures are separate exceptions. A booking may end exactly at closing, but never after it.
- “No preference” is the default staff choice. Anonymous availability exposes only aggregate open/unavailable slots; authenticated booking creation assigns deterministically under a date lock by fewest booked minutes, then booking count, then stable staff id, and returns the actual assignment.
- Existing Pending and Confirmed appointments survive schedule edits. Staff receive conflict references and reasons for follow-up; schedule saving never moves or cancels appointments.
- Visit rating and assigned-staff rating are separate 1–5 values; the staff rating is required when a team member was assigned and remains NULL for unassigned legacy visits. Staff aggregates are shown only in the booking picker and protected admin workspace, never on public staff pages or the homepage.
- Payment is settled at the salon after staff confirmation; appointment records are not proof of payment.

## Capabilities and Constraints

- Preserve all current customer, staff, and administrator functionality.
- Preserve Supabase Auth, Postgres/RLS, Storage, Edge Functions, and the existing React/Vite application stack.
- Preserve the status vocabulary: Pending, Confirmed, Completed, and Cancelled.
- Public registration creates customer accounts only. Staff and administrator access must remain protected by administrator-controlled provisioning and authorization.
- The legacy PHP/MySQL surface is a rollback archive, not the active application.
- The interface must remain responsive for mobile and desktop web use.
- Keep the customer overview intentionally small and action-led; retain the Overview and Ratings & Reviews routes and compatibility redirect while making the primary navigation exactly Home, My Appointments, Ratings & Reviews, and My Profile. Notifications remain available through the notification bell, while Book appointment is a separate prominent action.
- Business address, hours, policies, certifications, hygiene claims, and other optional seed content require confirmation before being treated as public proof.

## Brand Commitments

- Preserve the public name **Astrid Nails & Beauty Bar**.
- **LuxeGlow** may remain as the product or experience label, subordinate to the salon name.
- Existing photography may be edited, cropped, or replaced.
- The approved visual direction is **Soft Luxury Salon**, the category standard executed at full craft: porcelain and warm-white grounds, deep ink type, plum primary actions, blush accents, restrained brass details, and polished salon photography.
- Treat **Aesop** as the benchmark for disciplined craft, **Glossier** for approachable beauty presentation, and **Fresha** for salon-specific operational clarity. These are quality bars, not layouts or claims to copy.
- The voice should be welcoming, clear, locally relevant, and operationally trustworthy; it should not fabricate luxury, certification, hygiene, popularity, or performance claims.

## Evidence on Hand

- Real application workflows, routes, role boundaries, appointment states, scheduling rules, and service-management capabilities are implemented in the repository.
- The canonical seed includes nine treatment records with names, categories, prices, durations, and ratings, but deployed content may differ.
- Published reviews come from completed appointments, but the public interface must not call them independently verified without stronger evidence.
- Existing hero photography is available, but some imagery contains third-party salon signage or branded products and must be cropped, edited, or replaced before becoming identity-defining artwork.
- No confirmed commercial benchmarks, awards, customer counts, years in business, staff counts, or market-leadership claims are on hand.

## Product Principles

1. Make the next appointment action obvious without hiding price, duration, availability, or status.
2. Let customer-facing choices and staff-facing records share one understandable language.
3. Use real service and appointment evidence instead of generic beauty-industry claims.
4. Keep daily salon operations fast, legible, and recoverable across desktop and mobile.
5. Express Lucena City relevance through confirmed business truth, not invented local decoration.

## Accessibility & Inclusion

- Do not assume the audience is exclusively women; services include adults, children, and gentleman packages.
- Preserve keyboard access, visible focus, semantic labels, reduced-motion support, readable contrast, and touch-friendly controls.
- Status and validation meaning must never depend on color alone.
