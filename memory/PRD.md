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

## Phase 2 — Marketplace Core (June 2026) — IMPLEMENTED (agent-tested; Phase-2 flows pending user acceptance)
Backend modularised: `core.py` (db/auth/RBAC/audit/notify/rate-limit), `routes_auth.py` (OTP adapter `OTP_PROVIDER=demo|firebase`, session-backed JWT, logout/logout-all, profile), `routes_vendor.py` (11-step onboarding draft/submit, status draft→submitted→under_review→approved/rejected/corrections_requested/suspended, vendor leads/bookings/payments/stats), `routes_fields.py` (dynamic field builder: 15 types, flags, reorder, filters `f_<key>`), `routes_locations.py` (Country→State→City→Area→Pincode, search, nearest by GPS), `routes_transactions.py` (enquiries+chat w/ attachments, itemized quotes, accept→booking, payments adapter Razorpay/Stripe/demo, coupons, refunds, invoice, booking statuses incl. refund_requested/disputed, reviews gated on completed booking + moderation + vendor reply, ledger/commission), `routes_admin.py` (vendors review/approve/reject/corrections/suspend/feature, customers, categories CRUD+theme/icon/banner, banners/ads, coupons, plans, CMS pages, settings incl. logo/splash/commission, broadcast notifications, payouts, audit), `storage.py` (Emergent Object Storage uploads with type/size validation; private KYC/chat files).
Frontend: onboarding wizard (`/vendor/onboarding`), vendor portal tabs (leads/bookings/payments/reviews), lead detail w/ chat + quote builder (`/vendor/leads/:id`), customer enquiries/bookings/booking detail (pay, invoice, cancel/refund, review), profile, payment success, 16-tab admin console (KYC queue, Field Builder, Locations, Category Manager w/ icon picker + colour pickers + banner upload + live preview, etc.), location context (GPS/manual/search), distance & "serves your area" ranking, dynamic filters, Google Maps picker (env key), Firebase client (env config).
Category theme system: single source of truth `CategoryThemeContext` (+CSS vars) fed by admin-managed `categories.theme` {accent, secondary, active_bg, active_text, header_color, light_bg, heading_color, button_color, overlay} + banner/banner_title/banner_subtitle; "All Categories" entry (`slug=all`, `is_all`) restores default brand theme; header/chips/hero/headings/buttons all theme-driven. Verified for all 9 categories desktop+mobile, no console errors.
ENV (backend): OTP_PROVIDER, DEMO_OTP_ENABLED, FIREBASE_SERVICE_ACCOUNT_JSON|PATH, PAYMENT_PROVIDER, PAYMENT_DEMO_ENABLED, RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET, STRIPE_API_KEY, EMERGENT_LLM_KEY (object storage). ENV (frontend): REACT_APP_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/APP_ID, REACT_APP_GOOGLE_MAPS_API_KEY.
MOCKED until credentials supplied: OTP (demo 123456), payments (demo-confirm), Google Maps (manual lat/lng fallback). Stripe claimable sandbox rejected India → use STRIPE_API_KEY path.
Next phase candidates (P0): testing_agent full regression of Phase 2; wire real Firebase/Razorpay/Maps keys; vendor availability calendar & blocked dates; subscriptions purchase flow; WhatsApp/SMS notification adapter; Hostinger/CloudPanel deployment guide.
