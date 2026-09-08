from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import re
import logging

from core import (db, client, now_iso, new_id, slugify, clean, get_current_user, optional_user,
                  haversine_km, logger)
import routes_auth, routes_vendor, routes_fields, routes_locations, routes_transactions, routes_admin, storage

app = FastAPI(title="MakeMyEventPro API")
api = APIRouter(prefix="/api")


# ----------------------------- models -----------------------------
class FavoriteToggle(BaseModel):
    vendor_id: str


class EventCreate(BaseModel):
    title: str
    event_type: str
    date: Optional[str] = None
    location: Optional[str] = None
    guests: Optional[int] = None
    budget: Optional[int] = None


class ChecklistUpdate(BaseModel):
    checklist: List[dict]


# ----------------------------- public marketplace -----------------------------
@api.get("/categories")
async def get_categories(include_all: bool = False, include_inactive: bool = False):
    q = {} if include_inactive else {"active": True}
    if not include_all:
        q["is_all"] = {"$ne": True}
    return await db.categories.find(q, {"_id": 0}).sort("order", 1).to_list(100)


@api.get("/categories/{slug}")
async def get_category(slug: str):
    c = await db.categories.find_one({"slug": slug, "active": True}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Category not found")
    c["fields"] = await db.field_definitions.find({"category_slug": slug, "active": True, "filterable": True}, {"_id": 0}).sort("order", 1).to_list(100)
    return c


@api.get("/event-types")
async def get_event_types():
    return await db.event_types.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(200)


@api.get("/cities")
async def get_cities():
    return await db.cities.find({}, {"_id": 0}).to_list(100)


@api.get("/settings/public")
async def public_settings():
    keys = ["logo_url", "splash_url", "brand_name", "support_phone", "support_email", "commission_percent", "default_cancellation_policy", "vendor_terms"]
    rows = await db.settings.find({"key": {"$in": keys}}, {"_id": 0}).to_list(50)
    return {r["key"]: r["value"] for r in rows}


@api.get("/pages/{slug}")
async def public_page(slug: str):
    p = await db.pages.find_one({"slug": slug, "published": True}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Page not found")
    return p


@api.get("/plans")
async def public_plans():
    return await db.plans.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(20)


@api.get("/banners")
async def get_banners(city: Optional[str] = None, area: Optional[str] = None, category: Optional[str] = None, kind: Optional[str] = None):
    q = {"status": "active"}
    if category:
        q["$or"] = [{"category_slug": category}, {"category_slug": None}]
    if kind:
        q["kind"] = kind
    now = now_iso()
    banners = await db.banners.find(q, {"_id": 0}).sort("priority", 1).to_list(100)
    out = []
    for b in banners:
        if b.get("starts_at") and b["starts_at"] > now:
            continue
        if b.get("ends_at") and b["ends_at"] < now:
            continue
        if city and b.get("city") and b["city"] != city:
            continue
        if b.get("area") and area and b["area"] != area:
            continue
        b["_area_match"] = 1 if (area and b.get("area") == area) else 0
        out.append(b)
    out.sort(key=lambda b: (-b["_area_match"], b.get("priority", 99)))
    if out:
        await db.banners.update_many({"id": {"$in": [b["id"] for b in out]}}, {"$inc": {"impressions": 1}})
    return out


@api.post("/banners/{banner_id}/click")
async def banner_click(banner_id: str):
    await db.banners.update_one({"id": banner_id}, {"$inc": {"clicks": 1}})
    return {"ok": True}


@api.get("/vendors")
async def list_vendors(
    request: Request,
    category: Optional[str] = None, subcategory: Optional[str] = None,
    city: Optional[str] = None, area: Optional[str] = None, pincode: Optional[str] = None,
    lat: Optional[float] = None, lng: Optional[float] = None, radius_km: Optional[float] = None,
    event_type: Optional[str] = None, q: Optional[str] = None,
    verified: Optional[bool] = None, featured: Optional[bool] = None, premium: Optional[bool] = None,
    min_rating: Optional[float] = None, max_price: Optional[int] = None, min_price: Optional[int] = None,
    amenities: Optional[str] = None, available_on: Optional[str] = None,
    sort: str = "relevance", page: int = 1, limit: int = 24,
):
    limit = max(1, min(limit, 100))
    page = max(1, page)
    query = {"status": "approved"}
    if category:
        query["category_slug"] = category
    if subcategory:
        query["subcategories"] = subcategory
    if city:
        query["city"] = city
    if pincode:
        query["pincode"] = pincode
    if event_type:
        query["event_types"] = event_type
    if verified:
        query["verified"] = True
    if featured:
        query["featured"] = True
    if premium:
        query["premium"] = True
    if min_rating:
        query["rating"] = {"$gte": min_rating}
    if max_price or min_price:
        query["starting_price"] = {**({"$lte": max_price} if max_price else {}), **({"$gte": min_price} if min_price else {})}
    if amenities:
        query["amenities"] = {"$all": [a for a in amenities.split(",") if a]}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        ors = [{"business_name": rx}, {"description": rx}, {"category_name": rx}, {"subcategories": rx}, {"area": rx}, {"service_areas": rx}]
        searchable = await db.field_definitions.find({"searchable": True, "active": True}, {"_id": 0, "key": 1}).to_list(100)
        ors += [{f"custom_fields.{f['key']}": rx} for f in searchable]
        query["$or"] = ors
    # dynamic field filters: f_<key>=value (select/bool) or f_<key>_min / f_<key>_max
    for k, val in request.query_params.items():
        if not k.startswith("f_") or not val:
            continue
        if k.endswith("_min"):
            query.setdefault(f"custom_fields.{k[2:-4]}", {})["$gte"] = float(val)
        elif k.endswith("_max"):
            query.setdefault(f"custom_fields.{k[2:-4]}", {})["$lte"] = float(val)
        elif val in ("true", "false"):
            query[f"custom_fields.{k[2:]}"] = val == "true"
        else:
            query[f"custom_fields.{k[2:]}"] = {"$in": val.split(",")}
    if available_on:
        query["blocked_dates"] = {"$ne": available_on}

    sort_map = {"rating": [("rating", -1)], "price_low": [("starting_price", 1)], "price_high": [("starting_price", -1)],
                "newest": [("created_at", -1)], "relevance": [("featured", -1), ("rating", -1)]}

    # Locality-first ranking: vendors in / serving the area first, then nearby by distance
    if area or (lat is not None and lng is not None):
        items = await db.vendors.find(query, {"_id": 0}).to_list(2000)
        if lat is None and area:
            loc = await db.locations.find_one({"type": "area", "name": area, "lat": {"$ne": None}}, {"_id": 0})
            if loc:
                lat, lng = loc["lat"], loc["lng"]
        for v in items:
            coords = (v.get("geo") or {}).get("coordinates")
            v["distance_km"] = haversine_km(lat, lng, coords[1], coords[0]) if (lat is not None and coords) else None
            v["serves_area"] = bool(area and (v.get("area") == area or area in (v.get("service_areas") or [])))
        if radius_km and lat is not None:
            items = [v for v in items if v["distance_km"] is None or v["distance_km"] <= radius_km or v["serves_area"]]
        if sort == "distance":
            items.sort(key=lambda v: (v["distance_km"] is None, v["distance_km"] or 0))
        else:
            key = {"rating": lambda v: -v.get("rating", 0), "price_low": lambda v: v.get("starting_price", 0),
                   "price_high": lambda v: -v.get("starting_price", 0), "newest": lambda v: v.get("created_at", "")}.get(sort)
            items.sort(key=lambda v: (v.get("area") != area, not v["serves_area"], v["distance_km"] if v["distance_km"] is not None else 999, not v.get("featured"), -v.get("rating", 0)) if not key else (not v["serves_area"], key(v)))
        total = len(items)
        items = items[(page - 1) * limit: page * limit]
        return {"total": total, "page": page, "limit": limit, "items": items, "area": area}

    total = await db.vendors.count_documents(query)
    items = await db.vendors.find(query, {"_id": 0}).sort(sort_map.get(sort, sort_map["relevance"])).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"total": total, "page": page, "limit": limit, "items": items}


@api.get("/vendors/{slug}")
async def vendor_detail(slug: str, user=Depends(optional_user)):
    v = await db.vendors.find_one({"slug": slug}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Vendor not found")
    is_owner = user and (v.get("user_id") == user["id"] or user["role"] in ("admin", "super_admin"))
    if v["status"] != "approved" and not is_owner:
        raise HTTPException(404, "Vendor not found")
    for k in ("bank", "kyc_documents", "pan_number", "registration_number", "admin_note"):
        if not is_owner:
            v.pop(k, None)
    await db.vendors.update_one({"id": v["id"]}, {"$inc": {"profile_views": 1}})
    reviews = await db.reviews.find({"vendor_id": v["id"], "status": "approved"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    similar = await db.vendors.find({"category_slug": v["category_slug"], "slug": {"$ne": slug}, "status": "approved"}, {"_id": 0}).limit(6).to_list(6)
    fields = await db.field_definitions.find({"category_slug": v["category_slug"], "active": True, "customer_visible": True, "vendor_only": False}, {"_id": 0}).sort("order", 1).to_list(200)
    return {"vendor": v, "reviews": reviews, "similar": similar, "fields": fields}


# ----------------------------- customer -----------------------------
@api.get("/favorites")
async def list_favorites(user=Depends(get_current_user)):
    favs = await db.favorites.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    ids = [f["vendor_id"] for f in favs]
    vendors = await db.vendors.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    return {"vendor_ids": ids, "vendors": vendors}


@api.post("/favorites/toggle")
async def toggle_favorite(body: FavoriteToggle, user=Depends(get_current_user)):
    existing = await db.favorites.find_one({"user_id": user["id"], "vendor_id": body.vendor_id})
    if existing:
        await db.favorites.delete_one({"user_id": user["id"], "vendor_id": body.vendor_id})
        return {"favorited": False}
    await db.favorites.insert_one({"id": new_id(), "user_id": user["id"], "vendor_id": body.vendor_id, "created_at": now_iso()})
    return {"favorited": True}


@api.get("/notifications")
async def my_notifications(user=Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api.post("/notifications/read")
async def read_notifications(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---- My Event planner (architecture-ready: checklist items link to categories & bookings) ----
DEFAULT_CHECKLIST = [("Venue", "venues"), ("Catering", "catering"), ("Photography", "photography"), ("Videography", "photography"),
                     ("Decoration", "decoration"), ("Makeup", "beauty"), ("Invitations", "planning"), ("DJ", "entertainment"),
                     ("Transport", "transportation"), ("Accommodation", "venues")]


@api.get("/events")
async def list_events(user=Depends(get_current_user)):
    events = await db.customer_events.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for ev in events:
        bookings = await db.bookings.find({"user_id": user["id"], "event_type": ev["event_type"]}, {"_id": 0, "category_slug": 1, "vendor_name": 1, "status": 1, "total": 1, "id": 1}).to_list(50)
        for item in ev["checklist"]:
            b = next((b for b in bookings if b.get("category_slug") == item.get("category_slug")), None)
            if b and not item.get("booking_id"):
                item.update({"booking_id": b["id"], "vendor_name": b["vendor_name"], "booking_status": b["status"]})
    return events


@api.post("/events")
async def create_event(body: EventCreate, user=Depends(get_current_user)):
    checklist = [{"id": new_id(), "task": t, "category_slug": c, "status": "not_started", "allocated": 0, "vendor_id": None, "booking_id": None}
                 for t, c in DEFAULT_CHECKLIST]
    doc = {"id": new_id(), "user_id": user["id"], "title": body.title, "event_type": body.event_type, "date": body.date,
           "location": body.location or user.get("city"), "guests": body.guests, "budget": body.budget or 0, "spent": 0,
           "checklist": checklist, "created_at": now_iso()}
    await db.customer_events.insert_one({**doc})
    return clean(doc)


@api.put("/events/{event_id}/checklist")
async def update_checklist(event_id: str, body: ChecklistUpdate, user=Depends(get_current_user)):
    ev = await db.customer_events.find_one({"id": event_id, "user_id": user["id"]})
    if not ev:
        raise HTTPException(404, "Event not found")
    spent = sum(int(i.get("allocated", 0)) for i in body.checklist if i.get("status") == "completed")
    await db.customer_events.update_one({"id": event_id}, {"$set": {"checklist": body.checklist, "spent": spent}})
    return clean(await db.customer_events.find_one({"id": event_id}, {"_id": 0}))


@api.get("/")
async def root():
    return {"service": "MakeMyEventPro API", "status": "ok"}


# ----------------------------- wiring -----------------------------
for r in (routes_auth.router, routes_vendor.router, routes_fields.router, routes_locations.router,
          routes_transactions.router, routes_admin.router, storage.router):
    api.include_router(r)

from seed import seed_database  # noqa: E402

THEME_DEFAULTS = {"secondary": "#EC4899", "active_bg": None, "active_text": "#FFFFFF", "overlay": 0.75,
                  "header_color": None, "light_bg": None, "heading_color": None, "button_color": None}


async def ensure_category_theme_defaults():
    """Data-driven category theming: backfill new theme keys and the 'All Categories' entry."""
    async for c in db.categories.find({}, {"_id": 0, "slug": 1, "theme": 1}):
        theme = {**THEME_DEFAULTS, **(c.get("theme") or {})}
        theme.setdefault("accent", "#7C3AED")
        if not theme.get("active_bg"):
            theme["active_bg"] = f"linear-gradient(135deg, {theme['accent']}, {theme['secondary']})"
        theme["header_color"] = theme.get("header_color") or theme["active_bg"]
        theme["light_bg"] = theme.get("light_bg") or f"{theme['accent']}14"
        theme["heading_color"] = theme.get("heading_color") or theme["accent"]
        theme["button_color"] = theme.get("button_color") or theme["active_bg"]
        await db.categories.update_one({"slug": c["slug"]}, {"$set": {"theme": theme}})
    if not await db.categories.find_one({"slug": "all"}):
        await db.categories.insert_one({
            "id": new_id(), "slug": "all", "name": "All Categories", "icon": "LayoutGrid", "order": 0, "active": True, "is_all": True,
            "description": "Every verified vendor for your event — venues, food, photos, décor and more.",
            "banner": "https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=80",
            "banner_title": "All Event Vendors in Hyderabad", "banner_subtitle": "Browse every category, compare quotes and book with confidence.",
            "theme": {"gradient": "from-blue-600 via-purple-600 to-pink-500", "accent": "#7C3AED", "secondary": "#EC4899",
                      "bg_soft": "rgba(124,58,237,0.08)", "glow": "rgba(124,58,237,0.25)",
                      "active_bg": "linear-gradient(135deg, #2563EB, #7C3AED, #EC4899)", "active_text": "#FFFFFF", "overlay": 0.75},
            "subcategories": [], "amenities": [], "created_at": now_iso()})


@app.on_event("startup")
async def startup():
    await db.vendors.create_index("category_slug")
    await db.vendors.create_index("city")
    await db.vendors.create_index("slug")
    await db.vendors.create_index("service_areas")
    await db.vendors.create_index([("geo", "2dsphere")])
    await db.favorites.create_index([("user_id", 1), ("vendor_id", 1)], unique=True)
    await db.sessions.create_index("id")
    await db.messages.create_index([("enquiry_id", 1), ("created_at", 1)])
    await db.locations.create_index([("type", 1), ("parent_id", 1)])
    await db.field_definitions.create_index([("category_slug", 1), ("order", 1)])
    await seed_database(db)
    await ensure_category_theme_defaults()
    try:
        storage.init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    logger.info("MakeMyEventPro startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
