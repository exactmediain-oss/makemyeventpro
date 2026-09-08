# MakeMyEventPro — Technical Architecture & Roadmap

> Premium, location-based, multi-vendor **event marketplace**. Launch city: **Hyderabad**. Architected for national expansion.

---

## 1. Platform Reality & Key Decisions (confirmed with owner)

| Spec ask | Build environment reality | Decision |
|---|---|---|
| PostgreSQL | Platform runs **MongoDB** natively | Use MongoDB with **normalized collections** + explicit references (same entities/relationships as the spec's ER model). |
| Native Android + iOS apps | This stack compiles a **React web** app, not App Store/Play binaries | Ship a **mobile-first, PWA-capable responsive web app** now. Because the backend is **API-first**, native apps are a future track that reuse the exact same REST API. |
| Mobile OTP via SMS provider | Owner has **Google Firebase** | Auth is **modular**. Phase-1 ships a **demo OTP** (code surfaced in UI/response) behind an `OtpProvider` interface; Firebase Phone Auth plugs in by swapping the provider + adding keys. **Currently MOCKED.** |
| India payments (UPI/cards) | — | **Stripe** (recommended, keys-free test) as the default gateway adapter; Razorpay adapter can be added. Payment provider credentials are **config-driven**, never hard-coded. Wired in **Phase 4**. |
| WhatsApp / Push / SMS notifications | Require paid providers | Notification service is **channel-abstracted**. Phase 1 = **in-app notifications**; SMS/Push/WhatsApp adapters added later. |

### Technical conflicts / gaps surfaced
1. **PostgreSQL vs Mongo** — resolved above (relational modeling preserved via references + indexes).
2. **Native mobile** — cannot be built here; delivered as responsive/PWA, native is a separate track.
3. **Real OTP/SMS/WhatsApp/Push** — all need paid third parties + keys; shipped as swappable adapters, mocked until keys are provided.
4. **Radius / distance targeting & "near me"** — needs geospatial queries; handled with Mongo `2dsphere` indexes on vendor `location.geo` and banner targeting.
5. **Natural-language search** — full NLP is out of scope for MVP; implemented as tokenized keyword + faceted filter search, structured to later add a search engine.
6. **SEO for a JS SPA** — CRA SPAs are weak for crawler SEO; the API already exposes SEO-friendly `/city/category/vendor-slug` data. True SSR/prerender is a future track (Next.js migration or prerender service).
7. **Admin 2FA, audit trail, KYC document vault, reconciliation** — modeled now, fully built in Phases 4–5.
8. **8 user roles** — implemented via a single `role` + permission matrix (RBAC), not 8 separate auth systems.

---

## 2. High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  CLIENTS (one API, many faces)                                   │
│  • Customer Marketplace (React, mobile-first, PWA)               │
│  • Vendor Dashboard (React SaaS)                                 │
│  • Super Admin Console (React SaaS)                              │
│  • Future: Android / iOS (reuse same REST API)                   │
└───────────────▲───────────────────────────────────────────────┘
                │ HTTPS  (/api/*, JWT Bearer)
┌───────────────┴───────────────────────────────────────────────┐
│  FastAPI (API-first, /api prefix, RBAC, rate-limit, validation) │
│  Auth · Marketplace · Vendor · Admin · Enquiry/Booking · Planner │
│  Adapters: OtpProvider · PaymentGateway · Notifier · Storage     │
└───────────────▲───────────────────────────────────────────────┘
                │ Motor (async)
┌───────────────┴───────────────────────────────────────────────┐
│  MongoDB  — normalized collections, 2dsphere + text indexes      │
│  Object storage (vendor media / docs / invoices) — Phase 2/4     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. User Roles & RBAC

`customer · vendor · vendor_staff · content_manager · support_manager · finance_manager · admin · super_admin`

Single `users.role` field + a **permission matrix** gates every protected route (`require_role(...)` dependency). Vendor staff permissions are scoped to their parent vendor. This avoids 8 parallel auth systems while satisfying the spec's role list.

Owner/super-admin seeded account: **exactmedia.in@gmail.com**.

---

## 4. Data Model (MongoDB collections)

Core (Phase 1 live): `users`, `otps`, `cities` (with embedded `areas`), `categories` (embedded `theme`, `subcategories`, `amenities`), `event_types`, `vendors` (embedded `services`, `packages`, `social`, `custom_fields`, `geo`), `banners`, `favorites`, `enquiries`, `reviews`, `customer_events` (embedded checklist/budget/tasks), `notifications`.

Modeled for later phases: `quotes`, `quote_items`, `bookings`, `payments`, `refunds`, `commissions`, `payouts`, `coupons`, `coupon_usage`, `subscriptions`, `subscription_plans`, `vendor_subscriptions`, `advertisements`, `ad_campaigns`, `ad_events`, `custom_fields` (admin field-builder registry), `messages`/`conversations`, `support_tickets`, `cms_pages`, `audit_logs`.

**Dynamic-by-design (never hard-coded):** categories, subcategories, category **theme colors**, custom fields/amenities, locations, commission rules, banners/ads, subscription plans. All are documents editable from the Admin console.

Indexes: `vendors` → `city`, `category_slug`, `rating`, `starting_price`, `featured`, text index on name/description, `2dsphere` on `geo`; `otps` TTL; `favorites` unique `(user_id,vendor_id)`.

---

## 5. API Surface (`/api`)

- **Auth**: `send-otp`, `verify-otp`, `me` (JWT, rate-limited).
- **Marketplace (public)**: `categories`, `event-types`, `cities`, `banners?city=&category=`, `vendors` (filter/sort/search/paginate), `vendors/{slug}`, `vendors/{slug}/reviews`.
- **Customer**: `favorites` (list/toggle), `enquiries` (create/list), `events` (My-Event planner CRUD), `notifications`.
- **Vendor**: `vendor/me`, `vendor/stats`, `vendor/leads`, `vendor/services`.
- **Admin**: `admin/stats`, `admin/vendors` (+approve/reject/feature), `admin/categories` (CRUD), `admin/banners` (CRUD), `admin/cities`.

Cross-cutting: pagination, filtering, sorting, search, JWT authz, OTP rate-limiting, Pydantic validation.

---

## 6. Search & Recommendation (MVP → future)
Ranking blends relevance + rating + verification + featured/sponsored (sponsored clearly marked, never fully overriding relevance). Geospatial "near you" via `2dsphere`. Recommendations start rule-based (location + category + event type) and are structured to evolve.

---

## 7. Development Roadmap

- **Phase 1 (this build)** ✅ Architecture, Mongo schema, OTP auth (demo), RBAC/roles, Admin + Vendor + Customer foundations, Hyderabad seed (locations, 10 categories w/ dynamic themes, event types, demo vendors, banners), customer marketplace (location, dynamic category theme, hero banners, discovery sections, vendor cards, vendor profile, favorites, enquiry, compare), vendor dashboard shell, admin dashboard shell.
- **Phase 2** Vendor onboarding wizard, KYC docs, media/object storage, dynamic custom-field engine, full search + filters.
- **Phase 3** Enquiries→Leads→Quotes, chat, favorites, reviews & moderation.
- **Phase 4** Bookings lifecycle, payments (Stripe), commission engine, coupons, payouts, refunds.
- **Phase 5** Dynamic banners/ads engine, subscriptions, analytics, CMS, reports/export, audit logs.
- **Phase 6** Event Planner deep coordination (budget/checklist/timeline ↔ vendor booking), bundled packages.
- **Phase 7** Native Android/iOS, push notifications, SMS/WhatsApp, PWA + SEO/SSR hardening, app-store readiness.

After every phase: test all journeys (customer/vendor/admin), fix, verify responsive UI + API security + data relationships.

---

## 8. Security & Config
JWT auth, OTP rate-limiting, role-based authz, input validation, secure file upload (Phase 2), no raw card data (tokenized gateway), private docs never public. **All credentials via environment variables**; dev/staging/prod separated by env. INR ₹, Asia/Kolkata display, UTC storage.
