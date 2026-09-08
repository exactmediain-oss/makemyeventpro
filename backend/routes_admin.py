"""Admin control plane: vendors review, categories, customers, coupons, reviews, bookings, payments, plans, CMS, settings."""
import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from core import db, now_iso, new_id, slugify, clean, require_roles, audit, notify, get_setting, ADMIN_ROLES, SUPER_ROLES, PAYMENT_DEMO_ENABLED
import payments as pay

router = APIRouter(prefix="/admin", tags=["admin"])
ANY_ADMIN = require_roles(*ADMIN_ROLES)
SUPER = require_roles(*SUPER_ROLES)
CONTENT = require_roles(*SUPER_ROLES, "content_manager")
FINANCE = require_roles(*SUPER_ROLES, "finance_manager")


class Note(BaseModel):
    note: Optional[str] = None


class CategoryUpsert(BaseModel):
    name: str
    slug: Optional[str] = None
    icon: Optional[str] = "Sparkles"
    description: Optional[str] = ""
    theme: Optional[dict] = None
    banner: Optional[str] = ""
    banner_title: Optional[str] = None
    banner_subtitle: Optional[str] = None
    order: Optional[int] = 99
    active: Optional[bool] = True
    subcategories: Optional[List[str]] = []
    amenities: Optional[List[str]] = []


class BannerUpsert(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    cta: Optional[str] = "Explore"
    image: str
    category_slug: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    link: Optional[str] = "#"
    priority: Optional[int] = 1
    status: Optional[str] = "active"
    target_platform: Optional[str] = "all"
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    kind: Optional[str] = "banner"  # banner | ad


class CouponIn(BaseModel):
    code: str
    title: Optional[str] = ""
    type: str = "percent"  # percent | flat
    value: float
    max_discount: Optional[float] = None
    min_amount: Optional[float] = None
    category_slug: Optional[str] = None
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None
    active: bool = True


class PlanIn(BaseModel):
    name: str
    price_monthly: float
    features: List[str] = []
    lead_limit: Optional[int] = None
    featured_slots: int = 0
    commission_percent: Optional[float] = None
    active: bool = True
    order: int = 10


class PageIn(BaseModel):
    slug: str
    title: str
    content: str
    published: bool = True


class SettingIn(BaseModel):
    key: str
    value: object


class Broadcast(BaseModel):
    title: str
    body: str
    audience: str = "all"  # all | customers | vendors
    link: Optional[str] = None


# ----------------------------- stats -----------------------------
@router.get("/stats")
async def admin_stats(user=Depends(ANY_ADMIN)):
    paid = await db.payments.find({"status": "paid"}, {"_id": 0, "amount": 1, "commission": 1}).to_list(100000)
    return {
        "total_customers": await db.users.count_documents({"role": "customer"}),
        "total_vendors": await db.vendors.count_documents({}),
        "pending_vendors": await db.vendors.count_documents({"status": {"$in": ["submitted", "under_review"]}}),
        "verified_vendors": await db.vendors.count_documents({"verified": True}),
        "active_vendors": await db.vendors.count_documents({"status": "approved"}),
        "total_enquiries": await db.enquiries.count_documents({}),
        "total_bookings": await db.bookings.count_documents({}),
        "total_reviews": await db.reviews.count_documents({}),
        "pending_reviews": await db.reviews.count_documents({"status": "pending"}),
        "refund_requests": await db.bookings.count_documents({"status": {"$in": ["refund_requested", "disputed"]}}),
        "gmv": round(sum(p["amount"] for p in paid), 2),
        "commission_earned": round(sum(p.get("commission", 0) for p in paid), 2),
        "categories": await db.categories.count_documents({}),
        "banners": await db.banners.count_documents({}),
        "cities": await db.locations.count_documents({"type": "city"}),
        "fields": await db.field_definitions.count_documents({}),
    }


# ----------------------------- vendors -----------------------------
@router.get("/vendors")
async def admin_vendors(status: Optional[str] = None, q: Optional[str] = None, user=Depends(ANY_ADMIN)):
    query = {}
    if status:
        query["status"] = status
    if q:
        query["business_name"] = {"$regex": q, "$options": "i"}
    return await db.vendors.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.get("/vendors/{vendor_id}")
async def admin_vendor_detail(vendor_id: str, user=Depends(ANY_ADMIN)):
    v = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Vendor not found")
    owner = await db.users.find_one({"id": v.get("user_id")}, {"_id": 0, "name": 1, "phone": 1, "email": 1}) if v.get("user_id") else None
    fields = await db.field_definitions.find({"category_slug": v.get("category_slug"), "active": True}, {"_id": 0}).sort("order", 1).to_list(200)
    return {"vendor": v, "owner": owner, "fields": fields}


VENDOR_ACTIONS = {
    "review": {"status": "under_review"},
    "approve": {"status": "approved", "verified": True, "approved_at": None},
    "reject": {"status": "rejected", "verified": False},
    "request_corrections": {"status": "corrections_requested"},
    "suspend": {"status": "suspended"},
    "reactivate": {"status": "approved"},
    "feature": {"featured": True}, "unfeature": {"featured": False},
    "premium": {"premium": True}, "unpremium": {"premium": False},
}
ACTION_MSG = {
    "approve": ("Congratulations! You're verified", "Your business is now live on MakeMyEventPro."),
    "reject": ("Application rejected", "Your application was not approved."),
    "request_corrections": ("Corrections needed", "Please update your application and resubmit."),
    "suspend": ("Account suspended", "Your listing has been suspended. Contact support."),
    "reactivate": ("Listing reactivated", "Your listing is live again."),
    "review": ("Application under review", "Our team is reviewing your documents."),
}


@router.post("/vendors/{vendor_id}/{action}")
async def admin_vendor_action(vendor_id: str, action: str, body: Note = None, user=Depends(SUPER)):
    if action not in VENDOR_ACTIONS:
        raise HTTPException(400, "Invalid action")
    v = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Vendor not found")
    upd = dict(VENDOR_ACTIONS[action])
    if "approved_at" in upd:
        upd["approved_at"] = now_iso()
    note = body.note if body else None
    if action in ("reject", "request_corrections", "suspend"):
        upd["admin_note"] = note
    upd["updated_at"] = now_iso()
    await db.vendors.update_one({"id": vendor_id}, {"$set": upd})
    await db.vendor_status_history.insert_one({"id": new_id(), "vendor_id": vendor_id, "action": action, "note": note,
                                               "by": user.get("email") or user["name"], "created_at": now_iso()})
    await audit(user, f"vendor.{action}", vendor_id, {"note": note})
    if action in ACTION_MSG:
        t, b = ACTION_MSG[action]
        await notify(v.get("user_id"), t, f"{b} {('Note: ' + note) if note else ''}".strip(), "/vendor", "kyc")
    return {"ok": True, "action": action}


@router.get("/vendors/{vendor_id}/history")
async def vendor_history(vendor_id: str, user=Depends(ANY_ADMIN)):
    return await db.vendor_status_history.find({"vendor_id": vendor_id}, {"_id": 0}).sort("created_at", -1).to_list(100)


# ----------------------------- customers -----------------------------
@router.get("/customers")
async def admin_customers(q: Optional[str] = None, role: Optional[str] = None, user=Depends(ANY_ADMIN)):
    query = {}
    if role:
        query["role"] = role
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q}}, {"email": {"$regex": q, "$options": "i"}}]
    return await db.users.find(query, {"_id": 0, "firebase_uid": 0}).sort("created_at", -1).to_list(1000)


@router.post("/customers/{user_id}/{action}")
async def customer_action(user_id: str, action: str, body: Note = None, user=Depends(SUPER)):
    if action not in ("suspend", "activate", "make_admin", "make_customer"):
        raise HTTPException(400, "Invalid action")
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User not found")
    if target["role"] == "super_admin":
        raise HTTPException(400, "Cannot modify super admin")
    upd = {"suspend": {"status": "suspended"}, "activate": {"status": "active"},
           "make_admin": {"role": "admin"}, "make_customer": {"role": "customer"}}[action]
    await db.users.update_one({"id": user_id}, {"$set": upd})
    if action == "suspend":
        await db.sessions.delete_many({"user_id": user_id})
    await audit(user, f"user.{action}", user_id, {"note": body.note if body else None})
    return {"ok": True}


# ----------------------------- categories -----------------------------
@router.post("/categories")
async def create_category(body: CategoryUpsert, user=Depends(CONTENT)):
    slug = slugify(body.slug or body.name)
    if not slug:
        raise HTTPException(400, "Invalid slug")
    existing = await db.categories.find_one({"slug": slug}, {"_id": 0})
    payload = body.model_dump()
    payload.pop("slug", None)
    doc = {**(existing or {"id": new_id(), "slug": slug, "created_at": now_iso()}), **payload, "slug": slug}
    accent = (doc.get("theme") or {}).get("accent") or "#7C3AED"
    secondary = (doc.get("theme") or {}).get("secondary") or "#EC4899"
    doc["theme"] = {"gradient": "from-blue-600 via-purple-600 to-pink-500", "accent": accent, "secondary": secondary,
                    "bg_soft": accent + "14", "glow": accent + "40", "active_bg": f"linear-gradient(135deg, {accent}, {secondary})",
                    "active_text": "#FFFFFF", "overlay": 0.75, **(doc.get("theme") or {})}
    await db.categories.update_one({"slug": slug}, {"$set": doc}, upsert=True)
    await audit(user, "category.upsert", slug)
    return clean(await db.categories.find_one({"slug": slug}, {"_id": 0}))


@router.put("/categories/{slug}")
async def update_category(slug: str, body: dict, user=Depends(CONTENT)):
    allowed = {"name", "icon", "description", "theme", "banner", "banner_title", "banner_subtitle", "order", "active", "subcategories", "amenities"}
    upd = {k: v for k, v in body.items() if k in allowed}
    if "theme" in upd and isinstance(upd["theme"], dict):
        cur = await db.categories.find_one({"slug": slug}, {"_id": 0, "theme": 1}) or {}
        t = {**(cur.get("theme") or {}), **upd["theme"]}
        if "accent" in upd["theme"]:
            t["bg_soft"] = t["accent"] + "14"
            t["glow"] = t["accent"] + "40"
        upd["theme"] = t
    r = await db.categories.update_one({"slug": slug}, {"$set": {**upd, "updated_at": now_iso()}})
    if r.matched_count == 0:
        raise HTTPException(404, "Category not found")
    await audit(user, "category.update", slug, {"keys": list(upd)})
    return clean(await db.categories.find_one({"slug": slug}, {"_id": 0}))


@router.put("/categories/{slug}/icon")
async def update_icon(slug: str, body: dict, user=Depends(CONTENT)):
    return await update_category(slug, {"icon": body.get("icon")}, user)


@router.put("/categories/{slug}/banner")
async def update_banner_cat(slug: str, body: dict, user=Depends(CONTENT)):
    return await update_category(slug, {k: v for k, v in body.items() if k in ("banner", "banner_title", "banner_subtitle")}, user)


@router.put("/categories/{slug}/theme")
async def update_theme(slug: str, theme: dict, user=Depends(CONTENT)):
    return await update_category(slug, {"theme": theme}, user)


@router.delete("/categories/{slug}")
async def delete_category(slug: str, user=Depends(SUPER)):
    if slug == "all":
        raise HTTPException(400, "'All Categories' cannot be deleted")
    if await db.vendors.count_documents({"category_slug": slug}):
        raise HTTPException(400, "Category has vendors; deactivate instead")
    await db.categories.delete_one({"slug": slug})
    await audit(user, "category.delete", slug)
    return {"ok": True}


class Reorder(BaseModel):
    slugs: List[str]


@router.post("/categories/reorder")
async def reorder_categories(body: Reorder, user=Depends(CONTENT)):
    for i, s in enumerate(body.slugs):
        await db.categories.update_one({"slug": s}, {"$set": {"order": i + 1}})
    return {"ok": True}


# ----------------------------- banners / ads -----------------------------
@router.get("/banners")
async def all_banners(user=Depends(CONTENT)):
    return await db.banners.find({}, {"_id": 0}).sort("priority", 1).to_list(500)


@router.post("/banners")
async def create_banner(body: BannerUpsert, user=Depends(CONTENT)):
    doc = {"id": new_id(), **body.model_dump(), "impressions": 0, "clicks": 0, "created_at": now_iso()}
    await db.banners.insert_one({**doc})
    await audit(user, "banner.create", doc["id"])
    return clean(doc)


@router.put("/banners/{banner_id}")
async def update_banner(banner_id: str, body: BannerUpsert, user=Depends(CONTENT)):
    r = await db.banners.update_one({"id": banner_id}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Banner not found")
    return clean(await db.banners.find_one({"id": banner_id}, {"_id": 0}))


@router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: str, user=Depends(CONTENT)):
    await db.banners.delete_one({"id": banner_id})
    await audit(user, "banner.delete", banner_id)
    return {"ok": True}


# ----------------------------- coupons -----------------------------
@router.get("/coupons")
async def coupons(user=Depends(FINANCE)):
    return await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/coupons")
async def create_coupon(body: CouponIn, user=Depends(FINANCE)):
    code = body.code.upper().strip()
    doc = {"id": new_id(), **body.model_dump(), "code": code, "uses": 0, "created_at": now_iso()}
    await db.coupons.update_one({"code": code}, {"$set": doc}, upsert=True)
    await audit(user, "coupon.upsert", code)
    return clean(await db.coupons.find_one({"code": code}, {"_id": 0}))


@router.delete("/coupons/{code}")
async def delete_coupon(code: str, user=Depends(FINANCE)):
    await db.coupons.delete_one({"code": code.upper()})
    return {"ok": True}


# ----------------------------- reviews moderation -----------------------------
@router.get("/reviews")
async def admin_reviews(status: Optional[str] = None, user=Depends(ANY_ADMIN)):
    q = {"status": status} if status else {}
    return await db.reviews.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.post("/reviews/{review_id}/{action}")
async def moderate_review(review_id: str, action: str, user=Depends(ANY_ADMIN)):
    if action not in ("approve", "reject", "delete"):
        raise HTTPException(400, "Invalid action")
    r = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Review not found")
    if action == "delete":
        await db.reviews.delete_one({"id": review_id})
    else:
        await db.reviews.update_one({"id": review_id}, {"$set": {"status": "approved" if action == "approve" else "rejected"}})
    from routes_transactions import recompute_rating
    await recompute_rating(r["vendor_id"])
    await audit(user, f"review.{action}", review_id)
    return {"ok": True}


# ----------------------------- bookings / payments / commissions -----------------------------
@router.get("/bookings")
async def admin_bookings(status: Optional[str] = None, user=Depends(ANY_ADMIN)):
    q = {"status": status} if status else {}
    return await db.bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.get("/enquiries")
async def admin_enquiries(user=Depends(ANY_ADMIN)):
    return await db.enquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.get("/payments")
async def admin_payments(user=Depends(FINANCE)):
    return await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.get("/ledger")
async def admin_ledger(user=Depends(FINANCE)):
    rows = await db.ledger.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    by_vendor = {}
    for r in rows:
        if r["type"] == "payment":
            d = by_vendor.setdefault(r["vendor_id"], {"vendor_id": r["vendor_id"], "gross": 0, "commission": 0, "payable": 0, "pending_payout": 0})
            d["gross"] += r["amount"]
            d["commission"] += r["commission"]
            d["payable"] += r["vendor_amount"]
            if r.get("payout_status") == "pending":
                d["pending_payout"] += r["vendor_amount"]
    for vid, d in by_vendor.items():
        v = await db.vendors.find_one({"id": vid}, {"_id": 0, "business_name": 1, "bank": 1})
        d["vendor_name"] = v["business_name"] if v else vid
        d["has_bank"] = bool(v and v.get("bank"))
    return {"entries": rows, "vendors": list(by_vendor.values())}


@router.post("/ledger/payout/{vendor_id}")
async def mark_payout(vendor_id: str, body: Note = None, user=Depends(FINANCE)):
    r = await db.ledger.update_many({"vendor_id": vendor_id, "type": "payment", "payout_status": "pending"},
                                    {"$set": {"payout_status": "paid", "payout_at": now_iso(), "payout_note": body.note if body else None}})
    await audit(user, "payout.mark_paid", vendor_id, {"entries": r.modified_count})
    v = await db.vendors.find_one({"id": vendor_id}, {"_id": 0, "user_id": 1})
    await notify(v.get("user_id") if v else None, "Payout processed", "Your pending earnings have been settled to your bank.", "/vendor", "payment")
    return {"ok": True, "entries": r.modified_count}


# ----------------------------- plans -----------------------------
@router.get("/plans")
async def plans(user=Depends(ANY_ADMIN)):
    return await db.plans.find({}, {"_id": 0}).sort("order", 1).to_list(50)


@router.post("/plans")
async def upsert_plan(body: PlanIn, user=Depends(SUPER)):
    slug = slugify(body.name)
    doc = {"id": new_id(), "slug": slug, **body.model_dump(), "created_at": now_iso()}
    await db.plans.update_one({"slug": slug}, {"$set": doc}, upsert=True)
    await audit(user, "plan.upsert", slug)
    return clean(await db.plans.find_one({"slug": slug}, {"_id": 0}))


@router.delete("/plans/{slug}")
async def delete_plan(slug: str, user=Depends(SUPER)):
    await db.plans.delete_one({"slug": slug})
    return {"ok": True}


# ----------------------------- CMS pages -----------------------------
@router.get("/pages")
async def admin_pages(user=Depends(CONTENT)):
    return await db.pages.find({}, {"_id": 0}).sort("slug", 1).to_list(200)


@router.post("/pages")
async def upsert_page(body: PageIn, user=Depends(CONTENT)):
    slug = slugify(body.slug)
    doc = {"id": new_id(), **body.model_dump(), "slug": slug, "updated_at": now_iso()}
    await db.pages.update_one({"slug": slug}, {"$set": doc}, upsert=True)
    await audit(user, "page.upsert", slug)
    return clean(await db.pages.find_one({"slug": slug}, {"_id": 0}))


@router.delete("/pages/{slug}")
async def delete_page(slug: str, user=Depends(CONTENT)):
    await db.pages.delete_one({"slug": slug})
    return {"ok": True}


# ----------------------------- settings (logo, splash, commission, policies) -----------------------------
@router.get("/settings")
async def admin_settings(user=Depends(ANY_ADMIN)):
    return await db.settings.find({}, {"_id": 0}).to_list(200)


@router.put("/settings")
async def put_setting(body: SettingIn, user=Depends(SUPER)):
    await db.settings.update_one({"key": body.key}, {"$set": {"key": body.key, "value": body.value, "updated_at": now_iso()}}, upsert=True)
    await audit(user, "setting.update", body.key)
    return {"ok": True}


# ----------------------------- payment settings (mode selection; secrets stay server-side) -----------------------------
class PaymentSettingsIn(BaseModel):
    payment_mode: str  # demo | razorpay_test | razorpay_live
    demo_payment_enabled: Optional[bool] = None
    razorpay_enabled: Optional[bool] = None


async def _payment_settings_status():
    mode = await get_setting("payment_mode", None)
    demo_on = await get_setting("demo_payment_enabled", None)
    rzp_on = await get_setting("razorpay_enabled", True)
    if demo_on is None:
        demo_on = PAYMENT_DEMO_ENABLED
    test_ok = pay.razorpay_test_configured()
    live_ok = pay.razorpay_live_configured()
    eff_mode = mode
    if eff_mode is None:
        eff_mode = "demo" if demo_on else "none"
    if eff_mode == "razorpay_test":
        active_provider = "razorpay" if (rzp_on and test_ok) else "none"
    elif eff_mode == "razorpay_live":
        active_provider = "razorpay" if (rzp_on and live_ok) else "none"
    elif eff_mode == "demo":
        active_provider = "demo" if demo_on else "none"
    else:
        active_provider = "none"
    return {
        "payment_mode": eff_mode,
        "is_explicitly_set": mode is not None,
        "demo_payment_enabled": bool(demo_on),
        "razorpay_enabled": bool(rzp_on),
        "razorpay_test": {"key_id_configured": bool(pay.RZP_TEST_KEY_ID),
                          "key_secret_configured": bool(pay.RZP_TEST_KEY_SECRET), "configured": test_ok},
        "razorpay_live": {"key_id_configured": bool(pay.RZP_LIVE_KEY_ID),
                          "key_secret_configured": bool(pay.RZP_LIVE_KEY_SECRET), "configured": live_ok},
        "active_provider": active_provider,
        "checkout_available": active_provider != "none",
    }


@router.get("/payment-settings")
async def get_payment_settings(user=Depends(ANY_ADMIN)):
    return await _payment_settings_status()


@router.put("/payment-settings")
async def update_payment_settings(body: PaymentSettingsIn, user=Depends(SUPER)):
    if body.payment_mode not in ("demo", "razorpay_test", "razorpay_live"):
        raise HTTPException(400, "Invalid payment mode")
    if body.payment_mode == "razorpay_test" and not pay.razorpay_test_configured():
        raise HTTPException(400, "Razorpay Test Mode is not configured")
    if body.payment_mode == "razorpay_live" and not pay.razorpay_live_configured():
        raise HTTPException(400, "Razorpay Live Mode is not configured")
    prev = await get_setting("payment_mode", None)
    await db.settings.update_one({"key": "payment_mode"}, {"$set": {"key": "payment_mode", "value": body.payment_mode, "updated_at": now_iso()}}, upsert=True)
    if body.demo_payment_enabled is not None:
        await db.settings.update_one({"key": "demo_payment_enabled"}, {"$set": {"key": "demo_payment_enabled", "value": bool(body.demo_payment_enabled), "updated_at": now_iso()}}, upsert=True)
    if body.razorpay_enabled is not None:
        await db.settings.update_one({"key": "razorpay_enabled"}, {"$set": {"key": "razorpay_enabled", "value": bool(body.razorpay_enabled), "updated_at": now_iso()}}, upsert=True)
    await audit(user, "payment.mode.update", body.payment_mode,
                {"previous_mode": prev, "new_mode": body.payment_mode,
                 "demo_payment_enabled": body.demo_payment_enabled, "razorpay_enabled": body.razorpay_enabled})
    return await _payment_settings_status()


class TestConnIn(BaseModel):
    mode: str  # razorpay_test | razorpay_live


@router.post("/payment-settings/test-connection")
async def payment_test_connection(body: TestConnIn, user=Depends(SUPER)):
    """Validate Razorpay credentials without charging. Returns status only, never secrets."""
    if body.mode not in ("razorpay_test", "razorpay_live"):
        raise HTTPException(400, "Invalid mode")
    rzp_mode = "test" if body.mode == "razorpay_test" else "live"
    result = pay.test_connection(rzp_mode)
    await audit(user, "payment.test_connection", body.mode, {"ok": result["ok"]})
    return result


@router.get("/integrations-status")
async def integrations_status(user=Depends(ANY_ADMIN)):
    """Configured/Not-Configured status for all integrations. Secrets are never returned."""
    def has(*names):
        return any(bool(os.environ.get(n)) for n in names)
    return {
        "firebase": {"configured": has("FIREBASE_SERVICE_ACCOUNT_JSON", "FIREBASE_SERVICE_ACCOUNT_PATH"),
                     "provider": os.environ.get("OTP_PROVIDER", "demo"),
                     "demo_otp_enabled": os.environ.get("DEMO_OTP_ENABLED", "false").lower() == "true"},
        "razorpay_test": {"configured": pay.razorpay_test_configured()},
        "razorpay_live": {"configured": pay.razorpay_live_configured()},
        "google_maps": {"configured": has("GOOGLE_MAPS_API_KEY", "REACT_APP_GOOGLE_MAPS_API_KEY")},
        "whatsapp": {"api_configured": has("WHATSAPP_API_TOKEN", "WHATSAPP_TOKEN"), "click_to_chat": True},
        "email": {"configured": has("RESEND_API_KEY", "SENDGRID_API_KEY", "SMTP_HOST")},
        "sms": {"configured": has("TWILIO_AUTH_TOKEN", "SMS_API_KEY")},
    }


# ----------------------------- notifications -----------------------------
@router.post("/notifications/broadcast")
async def broadcast(body: Broadcast, user=Depends(SUPER)):
    q = {} if body.audience == "all" else {"role": "customer"} if body.audience == "customers" else {"role": {"$in": ["vendor", "vendor_staff"]}}
    users = await db.users.find(q, {"_id": 0, "id": 1}).to_list(100000)
    for u in users:
        await notify(u["id"], body.title, body.body, body.link, "broadcast")
    await audit(user, "notification.broadcast", body.audience, {"count": len(users)})
    return {"ok": True, "sent": len(users)}


@router.get("/audit-logs")
async def audit_logs(user=Depends(SUPER)):
    return await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)
