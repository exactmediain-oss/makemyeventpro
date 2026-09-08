# MakeMyEventPro — PRD

## Original problem statement
Build MakeMyEventPro: a premium, location-based, multi-vendor **event marketplace** for India (launch city: Hyderabad, architected for national expansion). Customers: Discover → Compare → Enquire → Shortlist → Book → Pay → Review. Vendors: Register → Verify → Publish → Leads → Quotes → Bookings → Payments. Three experiences: Customer marketplace, Vendor Dashboard, Super Admin console. Everything important (categories, themes, custom fields, locations, commission, banners, plans) must be admin-configurable, not hard-coded.

## Confirmed decisions (owner)
- DB: **MongoDB** (platform native; PostgreSQL not available here) — normalized collections + references.
- Mobile: **responsive/PWA web now**; native Android/iOS a future track reusing the same API.
- Auth: **Mobile OTP via Firebase** — currently **MOCKED demo mode** (demo code returned + universal `123456`, env-gated by `DEMO_OTP_ENABLED`). Firebase keys pending.
- Payments: **Stripe** default (Razorpay optional), wired in Phase 4.
- Owner/super-admin account: **exactmedia.in@gmail.com** (phone 9999900001).

## Architecture
FastAPI (API-first, `/api`, JWT, RBAC, rate-limit) + MongoDB + React (mobile-first). Adapters for OTP/Payment/Notifier/Storage. Full architecture in `/app/ARCHITECTURE.md`.

## Roles (RBAC)
customer, vendor, vendor_staff, content_manager, support_manager, finance_manager, admin, super_admin — single `role` field + permission gating.

## Implemented — Phase 1 (2026-06, verified: backend 32/32 tests pass)
- OTP auth (send/verify, demo/Firebase-ready), JWT, `require_roles` RBAC.
- Hyderabad seed: 1 city + 12 areas, 10 categories w/ dynamic themes + subcategories + amenities, 17 event types, ~16 approved demo vendors + 1 pending (for KYC), reviews, 4 location banners, seeded admin + vendor accounts.
- Customer marketplace: location selector, dynamic category theme switching, hero banner carousel, popular categories, event types, featured/trending/top-rated/premium rows, how-it-works, footer, mobile bottom-nav.
- Vendor listing + filters (price/rating/verified/featured) + sort + search; Airbnb-style vendor profile (gallery, packages, services, amenities, reviews, social, sticky enquiry card, similar vendors).
- Favorites, multi-vendor Enquiry flow, in-app Notifications.
- Vendor comparison drawer (up to 3).
- My Event planner: create event, budget summary, 10-item checklist with per-item budget/status + "Find Vendors" deep-link, progress tracking.
- Vendor Dashboard: stats, profile completion, verification badge, lead pipeline table.
- Super Admin console: platform stats, KYC approve/reject queue, all-vendors table + feature/unfeature, categories & theme viewer, banners viewer, audit logging on actions.

## Backlog (prioritized)
- **P0 Phase 2**: Vendor onboarding wizard (13 steps), KYC document upload (object storage), dynamic custom-field engine (admin field builder), full search facets + geo "near me".
- **P1 Phase 3**: Enquiry→Lead→Quote lifecycle, customer-vendor chat, review submission + moderation.
- **P1 Phase 4**: Booking lifecycle, Stripe payments (UPI/cards), commission engine, coupons, payouts, refunds.
- **P2 Phase 5**: Ads/banners engine + targeting, subscriptions/plans, analytics, CMS, reports/export.
- **P2 Phase 6**: Event Planner ↔ booking coordination, bundled event packages.
- **P2 Phase 7**: Native apps, push/SMS/WhatsApp, PWA + SEO/SSR.

## Test credentials
See `/app/memory/test_credentials.md`. Admin 9999900001 · Vendor 9999900002 · any phone = customer · OTP `123456`.
