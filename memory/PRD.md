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

## 2026-06 — Admin Payment Settings (Demo / Razorpay Test / Razorpay Live)
DB-driven payment mode stored in `settings` collection (`payment_mode`, `demo_payment_enabled`, `razorpay_enabled`); secrets NEVER stored in DB/returned to client (only public razorpay key_id at checkout).
Modes: `demo` | `razorpay_test` | `razorpay_live`. Backend validates the required key pair is configured before activation; when unconfigured, checkout shows "Online payment is temporarily unavailable" (no fake option). Behavior preserved (env-driven) until an admin explicitly sets a mode.
APIs added: `GET /api/admin/payment-settings` (any admin, status chips only), `PUT /api/admin/payment-settings` (super_admin, audited old→new via `payment.mode.update`). `GET /api/payments/config` + booking detail now return effective mode/provider/checkout_available.
ENV added (server-side only): RAZORPAY_TEST_KEY_ID, RAZORPAY_TEST_KEY_SECRET, RAZORPAY_LIVE_KEY_ID, RAZORPAY_LIVE_KEY_SECRET (all empty by default). Legacy single RAZORPAY_KEY_ID/SECRET retained for fallback.
Files: backend/.env, payments.py (test/live key pairs + mode-aware order/verify/refund), routes_transactions.py (effective_payment resolver + create/verify/refund/demo-confirm/config), routes_admin.py (payment-settings endpoints). Frontend: pages/admin/tabs.jsx (PaymentSettingsTab), AdminDashboard.jsx (tab wiring + stats-null render guard fix), PayButton.jsx, BookingDetail.jsx (unavailable message).
Tested (curl+UI): admin GET/PUT, customer 403, test/live not-configured → 400, configured path activates + exposes only key_id (no secret leak), audit logged, mode switch reflects instantly at /payments/config.

## 2026-06 — Three-platform separation & visible "Join as Vendor" entry point
Gap fixed: customer site had no clearly visible vendor entry point (old "List your business" CTA was hidden below lg and led straight to onboarding). Vendor dashboard/onboarding/status-lifecycle already existed and were reused as-is.
Added dedicated Vendor Landing page `/vendor/join` (VendorLanding.jsx) — vendor-branded top bar (separate from customer search header), hero "Grow Your Event Business with MakeMyEventPro", "Start Your Vendor Registration" → /vendor/onboarding, "Already a Vendor? Login" (opens OTP dialog; vendors go to /vendor). Benefits + how-it-works + note that listings go live only after admin approval.
Header: CTA renamed "List your business" → "Join as Vendor", now visible `hidden sm:flex`, routes to /vendor/join (both logged-out button and logged-in customer menu item). Home: added prominent "Join as Vendor" CTA banner section.
Auth/roles UNCHANGED (per constraint): role→vendor still occurs only when a customer saves an onboarding draft/submits (routes_vendor.py), not on click. Public marketplace gated by status:"approved" (server.py:130) — verified all 18 public vendors are approved. Role guards verified: vendor→/api/admin/* = 403, customer→/api/vendor/* = 403.
Files: frontend App.js (route), components/Header.jsx, pages/Home.jsx, pages/vendor/VendorLanding.jsx (new). No backend changes. No env changes. Native mobile apps remain future work — web serves both experiences via role-based routing on shared backend.

## 2026-06 — Production pass: mobile "Join as Vendor" + Login/Create-Account clarity
Two flagged bugs fixed (both verified via browser automation on 390px mobile):
1) Mobile "Join as Vendor" was hidden (header CTA was `hidden sm:flex`). Now the header vendor CTA is always visible — store icon on mobile, full "Join as Vendor" text on sm+ — routing to /vendor/join (never the customer login modal). Mobile bottom nav (Home/Explore/Enquiries/Bookings/Profile) and homepage "Join as Vendor" banner already existed.
2) Auth modal now has a clear Login / Create Account segmented toggle. Create Account requires a name (validated); Login keeps the fast phone-only flow. Backend upsert unchanged (creates new / logs in existing). Full OTP signup verified end-to-end (token persisted, session, user menu, redirect stays on current page).
Files: components/AuthDialog.jsx, components/Header.jsx. No backend/env/DB changes. Customer login/signup confirmed WORKING (earlier report of "not completing" was OTP-focus in test harness, not an app bug).
NOT built this pass (already exist OR remain backlog — see below), to respect budget & "don't break working features".
Bugfix: "Login with OTP" did nothing on /vendor/onboarding, /vendor, /admin because AuthDialog was only mounted in Layout (those routes render outside Layout). Mounted <AuthDialog /> in the logged-out states of VendorOnboarding.jsx, VendorDashboard.jsx, AdminDashboard.jsx. Verified dialog opens with Login/Create-Account toggle.

## 2026-06 — Consolidated pass: Test Connection, Integrations status, Vendor blocked-dates (server-side)
1) Razorpay Test Connection: POST /api/admin/payment-settings/test-connection (super_admin) validates configured keys via a no-charge order.all({count:1}); returns {ok,message}; audited; never returns secrets. Buttons added under each key card in PaymentSettingsTab. Verified: no keys → "not configured"; customer → 403.
2) Admin Integrations tab: GET /api/admin/integrations-status (any admin) reports Configured/Not-Configured for Firebase/Razorpay test+live/Google Maps/WhatsApp(+click-to-chat)/Email/SMS with the exact .env location for each credential (frontend-safe vs backend-secret). No secret VALUES ever returned (verified). New IntegrationsTab in admin console.
3) Vendor blocked dates + SERVER-SIDE double-booking prevention: added blocked_dates/working_days to OnboardingDraft + PUT /vendor/me whitelist. quote_action now rejects (HTTP 400) accepting a quote when event_date is in vendor.blocked_dates OR a confirmed/in_progress booking already exists for that vendor+date. Vendor dashboard → Availability tab to block/unblock dates. Verified end-to-end (blocked date accept → 400).
Files: backend payments.py, routes_admin.py (+import os), routes_vendor.py, routes_transactions.py; frontend pages/admin/tabs.jsx, pages/admin/AdminDashboard.jsx, pages/vendor/VendorDashboard.jsx. No .env/DB destructive changes.
