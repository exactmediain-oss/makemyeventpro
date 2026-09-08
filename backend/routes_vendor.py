"""Vendor onboarding wizard (draft → submitted → under_review → approved/rejected/corrections_requested/suspended)."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from core import (db, now_iso, new_id, slugify, clean, get_current_user, require_roles, notify, audit,
                  get_vendor_for_user, VENDOR_ROLES, ADMIN_ROLES)

router = APIRouter(prefix="/vendor", tags=["vendor"])

STEPS = ["business", "contact", "category", "location", "online", "legal", "kyc", "bank", "media", "fields", "terms"]
REQUIRED_FOR_SUBMIT = {
    "business_name": "Business name", "owner_name": "Owner / contact person", "business_type": "Business type",
    "category_slug": "Category", "description": "Business description", "address": "Address",
    "city": "City", "area": "Area / locality", "business_phone": "Business phone",
}


class OnboardingDraft(BaseModel):
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    business_type: Optional[str] = None
    category_slug: Optional[str] = None
    subcategories: Optional[List[str]] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    area: Optional[str] = None
    pincode: Optional[str] = None
    geo: Optional[dict] = None  # {"lat":..,"lng":..}
    service_areas: Optional[List[str]] = None
    service_radius_km: Optional[int] = None
    business_phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    social: Optional[dict] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    registration_number: Optional[str] = None
    registration_type: Optional[str] = None
    kyc_documents: Optional[List[dict]] = None  # [{type, file_id, name}]
    bank: Optional[dict] = None  # {account_name, account_number, ifsc, bank_name, upi_id}
    logo: Optional[str] = None
    cover: Optional[str] = None
    gallery: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    custom_fields: Optional[dict] = None
    amenities: Optional[List[str]] = None
    services: Optional[List[dict]] = None
    packages: Optional[List[dict]] = None
    event_types: Optional[List[str]] = None
    starting_price: Optional[int] = None
    price_unit: Optional[str] = None
    years: Optional[int] = None
    terms_accepted: Optional[bool] = None
    declaration_accepted: Optional[bool] = None
    current_step: Optional[int] = None
    blocked_dates: Optional[List[str]] = None
    working_days: Optional[List[str]] = None


def completion(v: dict):
    keys = list(REQUIRED_FOR_SUBMIT) + ["email", "geo", "service_areas", "social", "gst_number", "pan_number",
                                        "kyc_documents", "bank", "logo", "cover", "gallery", "packages", "custom_fields"]
    filled = sum(1 for k in keys if v.get(k))
    return int(filled * 100 / len(keys))


@router.get("/onboarding")
async def get_onboarding(user=Depends(get_current_user)):
    v = await db.vendors.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"vendor": v, "steps": STEPS, "required": REQUIRED_FOR_SUBMIT}


@router.put("/onboarding")
async def save_onboarding(body: OnboardingDraft, user=Depends(get_current_user)):
    if user["role"] not in ("customer", "vendor", "vendor_staff"):
        raise HTTPException(403, "Only customer/vendor accounts can register a business")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    v = await db.vendors.find_one({"user_id": user["id"]}, {"_id": 0})
    if v and v["status"] in ("submitted", "under_review"):
        raise HTTPException(400, "Application is under review and cannot be edited")
    if "category_slug" in upd:
        cat = await db.categories.find_one({"slug": upd["category_slug"]}, {"_id": 0})
        if not cat:
            raise HTTPException(400, "Invalid category")
        upd["category_name"] = cat["name"]
    if "gst_number" in upd and upd["gst_number"] and len(upd["gst_number"]) != 15:
        raise HTTPException(400, "GST number must be 15 characters")
    if "pan_number" in upd and upd["pan_number"] and len(upd["pan_number"]) != 10:
        raise HTTPException(400, "PAN must be 10 characters")
    if "geo" in upd and upd["geo"] and "lat" in upd["geo"]:
        upd["geo"] = {"type": "Point", "coordinates": [float(upd["geo"]["lng"]), float(upd["geo"]["lat"])]}
    if not v:
        v = {"id": new_id(), "user_id": user["id"], "status": "draft", "verified": False, "featured": False,
             "premium": False, "trending": False, "rating": 0, "review_count": 0, "profile_views": 0, "revenue": 0,
             "response_rate": 0, "response_time": "-", "gallery": [], "videos": [], "services": [], "packages": [],
             "amenities": [], "custom_fields": {}, "social": {}, "kyc_documents": [], "city": "Hyderabad",
             "price_unit": "per event", "created_at": now_iso()}
        await db.vendors.insert_one({**v})
        if user["role"] == "customer":
            await db.users.update_one({"id": user["id"]}, {"$set": {"role": "vendor"}})
    merged = {**v, **upd}
    if merged.get("business_name") and not merged.get("slug"):
        base = slugify(merged["business_name"])
        slug, n = base, 1
        while await db.vendors.find_one({"slug": slug, "id": {"$ne": v["id"]}}):
            n += 1
            slug = f"{base}-{n}"
        upd["slug"] = slug
    upd["profile_completion"] = completion(merged)
    upd["updated_at"] = now_iso()
    if v["status"] == "corrections_requested":
        upd["status"] = "draft"
    await db.vendors.update_one({"id": v["id"]}, {"$set": upd})
    return clean(await db.vendors.find_one({"id": v["id"]}, {"_id": 0}))


@router.post("/onboarding/submit")
async def submit_onboarding(user=Depends(get_current_user)):
    v = await db.vendors.find_one({"user_id": user["id"]}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Start the registration first")
    if v["status"] not in ("draft", "rejected", "corrections_requested"):
        raise HTTPException(400, f"Cannot submit in status {v['status']}")
    missing = [label for k, label in REQUIRED_FOR_SUBMIT.items() if not v.get(k)]
    if not v.get("terms_accepted") or not v.get("declaration_accepted"):
        missing.append("Terms & declaration")
    if not v.get("kyc_documents"):
        missing.append("At least one KYC document")
    fields = await db.field_definitions.find({"category_slug": v["category_slug"], "required": True, "active": True}, {"_id": 0}).to_list(200)
    for f in fields:
        if (v.get("custom_fields") or {}).get(f["key"]) in (None, "", []):
            missing.append(f"Field: {f['label']}")
    if missing:
        raise HTTPException(400, {"message": "Complete required fields before submitting", "missing": missing})
    await db.vendors.update_one({"id": v["id"]}, {"$set": {"status": "submitted", "submitted_at": now_iso(), "admin_note": None}})
    await db.users.update_one({"id": user["id"]}, {"$set": {"role": "vendor"}})
    await notify(user["id"], "Application submitted", "Your vendor application is with our verification team.", "/vendor")
    admins = await db.users.find({"role": {"$in": list(ADMIN_ROLES)}}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await notify(a["id"], "New vendor application", f"{v.get('business_name')} submitted KYC for review.", "/admin", "kyc")
    return {"ok": True, "status": "submitted"}


@router.get("/me")
async def vendor_me(user=Depends(require_roles(*VENDOR_ROLES))):
    return await get_vendor_for_user(user)


@router.put("/me")
async def vendor_update(body: OnboardingDraft, user=Depends(require_roles(*VENDOR_ROLES))):
    """Approved vendors edit listing (not KYC/legal/bank which need re-verification via onboarding)."""
    v = await get_vendor_for_user(user)
    allowed = {"description", "gallery", "videos", "logo", "cover", "social", "website", "services", "packages",
               "amenities", "event_types", "starting_price", "price_unit", "custom_fields", "service_areas",
               "business_phone", "email", "subcategories", "years", "blocked_dates", "working_days"}
    upd = {k: val for k, val in body.model_dump().items() if val is not None and k in allowed}
    upd["updated_at"] = now_iso()
    await db.vendors.update_one({"id": v["id"]}, {"$set": upd})
    return clean(await db.vendors.find_one({"id": v["id"]}, {"_id": 0}))


@router.get("/stats")
async def vendor_stats(user=Depends(require_roles(*VENDOR_ROLES))):
    v = await get_vendor_for_user(user)
    paid = await db.payments.find({"vendor_id": v["id"], "status": "paid"}, {"_id": 0, "vendor_amount": 1}).to_list(5000)
    return {
        "profile_completion": v.get("profile_completion", 0), "verification": v.get("status"),
        "total_leads": await db.enquiries.count_documents({"vendor_id": v["id"]}),
        "new_leads": await db.enquiries.count_documents({"vendor_id": v["id"], "status": "new"}),
        "quotes_sent": await db.quotes.count_documents({"vendor_id": v["id"]}),
        "bookings": await db.bookings.count_documents({"vendor_id": v["id"]}),
        "confirmed_bookings": await db.bookings.count_documents({"vendor_id": v["id"], "status": {"$in": ["confirmed", "in_progress", "completed"]}}),
        "earnings": sum(p.get("vendor_amount", 0) for p in paid),
        "rating": v.get("rating"), "review_count": v.get("review_count"),
        "profile_views": v.get("profile_views", 0),
        "services": len(v.get("services", [])), "packages": len(v.get("packages", [])),
    }


@router.get("/leads")
async def vendor_leads(user=Depends(require_roles(*VENDOR_ROLES))):
    v = await get_vendor_for_user(user)
    return await db.enquiries.find({"vendor_id": v["id"]}, {"_id": 0}).sort("created_at", -1).to_list(300)


@router.get("/bookings")
async def vendor_bookings(user=Depends(require_roles(*VENDOR_ROLES))):
    v = await get_vendor_for_user(user)
    return await db.bookings.find({"vendor_id": v["id"]}, {"_id": 0}).sort("created_at", -1).to_list(300)


@router.get("/payments")
async def vendor_payments(user=Depends(require_roles(*VENDOR_ROLES))):
    v = await get_vendor_for_user(user)
    return await db.payments.find({"vendor_id": v["id"]}, {"_id": 0}).sort("created_at", -1).to_list(300)
