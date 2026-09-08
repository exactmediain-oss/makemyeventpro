from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Annotated
from datetime import datetime, timezone, timedelta
import uuid
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev_secret')
JWT_EXPIRE_HOURS = int(os.environ.get('JWT_EXPIRE_HOURS', '720'))
OWNER_EMAIL = os.environ.get('OWNER_EMAIL', 'exactmedia.in@gmail.com')
DEMO_OTP_ENABLED = os.environ.get('DEMO_OTP_ENABLED', 'true').lower() == 'true'

app = FastAPI(title="MakeMyEventPro API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)
logger = logging.getLogger("mmep")


# ----------------------------- helpers -----------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def slugify(text: str):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def make_token(user):
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_roles(*roles):
    async def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return checker


# ----------------------------- models -----------------------------
class SendOtp(BaseModel):
    phone: str


class VerifyOtp(BaseModel):
    phone: str
    code: str
    name: Optional[str] = None
    role: Optional[str] = "customer"


class FavoriteToggle(BaseModel):
    vendor_id: str


class EnquiryCreate(BaseModel):
    vendor_ids: List[str]
    event_type: str
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    location: Optional[str] = None
    guests: Optional[int] = None
    budget: Optional[int] = None
    services: Optional[List[str]] = []
    message: Optional[str] = None


class EventCreate(BaseModel):
    title: str
    event_type: str
    date: Optional[str] = None
    location: Optional[str] = None
    guests: Optional[int] = None
    budget: Optional[int] = None


class ChecklistUpdate(BaseModel):
    checklist: List[dict]


class CategoryUpsert(BaseModel):
    name: str
    icon: Optional[str] = "Sparkles"
    description: Optional[str] = ""
    theme: Optional[dict] = None
    banner: Optional[str] = ""
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


# ----------------------------- auth -----------------------------
@api.post("/auth/send-otp")
async def send_otp(body: SendOtp):
    phone = body.phone.strip()
    if not re.fullmatch(r'\+?\d{10,13}', phone):
        raise HTTPException(400, "Enter a valid mobile number")
    # rate limit: max 5 OTP requests / 10 min
    window = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    recent = await db.otps.count_documents({"phone": phone, "created_at": {"$gt": window}})
    if recent >= 5:
        raise HTTPException(429, "Too many OTP requests. Please try again later.")
    code = str(random.randint(100000, 999999))
    await db.otps.insert_one({
        "phone": phone, "code": code,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        "created_at": now_iso(), "attempts": 0,
    })
    # MOCKED: real Firebase Phone Auth plugs in here. Demo code returned in response.
    return {"sent": True, "demo_otp": code, "message": "Demo OTP (Firebase pending) — also accepts 123456"}


@api.post("/auth/verify-otp")
async def verify_otp(body: VerifyOtp):
    phone = body.phone.strip()
    rec = await db.otps.find_one({"phone": phone}, sort=[("created_at", -1)])
    valid = DEMO_OTP_ENABLED and body.code == "123456"  # universal demo bypass (MOCKED, env-gated)
    if not valid:
        if not rec:
            raise HTTPException(400, "Request an OTP first")
        if rec["code"] != body.code:
            raise HTTPException(400, "Incorrect OTP")
        if rec["expires_at"] < now_iso():
            raise HTTPException(400, "OTP expired")
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        user = {
            "id": new_id(), "phone": phone, "name": body.name or "Guest User",
            "email": None, "role": body.role if body.role in ("customer", "vendor") else "customer",
            "city": "Hyderabad", "avatar": None, "status": "active", "created_at": now_iso(),
        }
        await db.users.insert_one({**user})
    token = make_token(user)
    return {"token": token, "user": {k: v for k, v in user.items() if k != "_id"}}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "_id"}


# ----------------------------- marketplace (public) -----------------------------
@api.get("/categories")
async def get_categories():
    return await db.categories.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(100)


@api.get("/event-types")
async def get_event_types():
    return await db.event_types.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(200)


@api.get("/cities")
async def get_cities():
    return await db.cities.find({}, {"_id": 0}).to_list(100)


@api.get("/banners")
async def get_banners(city: Optional[str] = None, category: Optional[str] = None):
    q = {"status": "active"}
    if category:
        q["$or"] = [{"category_slug": category}, {"category_slug": None}]
    banners = await db.banners.find(q, {"_id": 0}).sort("priority", 1).to_list(50)
    if city:
        banners = [b for b in banners if not b.get("city") or b.get("city") == city]
    return banners


@api.get("/vendors")
async def list_vendors(
    category: Optional[str] = None,
    city: Optional[str] = None,
    area: Optional[str] = None,
    event_type: Optional[str] = None,
    q: Optional[str] = None,
    verified: Optional[bool] = None,
    featured: Optional[bool] = None,
    min_rating: Optional[float] = None,
    max_price: Optional[int] = None,
    sort: str = "relevance",
    page: int = 1,
    limit: int = 24,
):
    limit = max(1, min(limit, 100))
    page = max(1, page)
    query = {"status": "approved"}
    if category:
        query["category_slug"] = category
    if city:
        query["city"] = city
    if area:
        query["area"] = area
    if event_type:
        query["event_types"] = event_type
    if verified:
        query["verified"] = True
    if featured:
        query["featured"] = True
    if min_rating:
        query["rating"] = {"$gte": min_rating}
    if max_price:
        query["starting_price"] = {"$lte": max_price}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"business_name": rx}, {"description": rx},
                        {"category_name": rx}, {"subcategories": rx}, {"area": rx}]
    sort_map = {
        "rating": [("rating", -1)],
        "price_low": [("starting_price", 1)],
        "price_high": [("starting_price", -1)],
        "newest": [("created_at", -1)],
        "relevance": [("featured", -1), ("rating", -1)],
    }
    total = await db.vendors.count_documents(query)
    cursor = db.vendors.find(query, {"_id": 0}).sort(sort_map.get(sort, sort_map["relevance"]))
    cursor = cursor.skip((page - 1) * limit).limit(limit)
    items = await cursor.to_list(limit)
    return {"total": total, "page": page, "limit": limit, "items": items}


@api.get("/vendors/{slug}")
async def vendor_detail(slug: str):
    v = await db.vendors.find_one({"slug": slug}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Vendor not found")
    reviews = await db.reviews.find({"vendor_id": v["id"], "status": "approved"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    similar = await db.vendors.find(
        {"category_slug": v["category_slug"], "slug": {"$ne": slug}, "status": "approved"},
        {"_id": 0}).limit(6).to_list(6)
    return {"vendor": v, "reviews": reviews, "similar": similar}


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


@api.post("/enquiries")
async def create_enquiry(body: EnquiryCreate, user=Depends(get_current_user)):
    created = []
    for vid in body.vendor_ids:
        vendor = await db.vendors.find_one({"id": vid}, {"_id": 0})
        if not vendor:
            continue
        doc = {
            "id": new_id(), "user_id": user["id"], "customer_name": user.get("name"),
            "vendor_id": vid, "vendor_name": vendor["business_name"],
            "event_type": body.event_type, "event_date": body.event_date, "event_time": body.event_time,
            "location": body.location or user.get("city"), "guests": body.guests, "budget": body.budget,
            "services": body.services, "message": body.message,
            "status": "new", "created_at": now_iso(),
        }
        await db.enquiries.insert_one({**doc})
        created.append({k: v for k, v in doc.items() if k != "_id"})
        await db.notifications.insert_one({
            "id": new_id(), "user_id": user["id"], "title": "Enquiry sent",
            "body": f"Your enquiry was sent to {vendor['business_name']}.",
            "read": False, "created_at": now_iso(),
        })
    return {"created": len(created), "enquiries": created}


@api.get("/enquiries")
async def my_enquiries(user=Depends(get_current_user)):
    return await db.enquiries.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.get("/notifications")
async def my_notifications(user=Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


# ---- My Event planner ----
DEFAULT_CHECKLIST = ["Venue", "Catering", "Photography", "Videography", "Decoration",
                     "Makeup", "Invitations", "DJ / Entertainment", "Transportation", "Jewellery"]


@api.get("/events")
async def list_events(user=Depends(get_current_user)):
    return await db.customer_events.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@api.post("/events")
async def create_event(body: EventCreate, user=Depends(get_current_user)):
    checklist = [{"id": new_id(), "task": t, "category_slug": slugify(t.split(" ")[0]),
                  "status": "not_started", "allocated": 0, "vendor_id": None} for t in DEFAULT_CHECKLIST]
    doc = {
        "id": new_id(), "user_id": user["id"], "title": body.title, "event_type": body.event_type,
        "date": body.date, "location": body.location or user.get("city"), "guests": body.guests,
        "budget": body.budget or 0, "spent": 0, "checklist": checklist, "created_at": now_iso(),
    }
    await db.customer_events.insert_one({**doc})
    return {k: v for k, v in doc.items() if k != "_id"}


@api.put("/events/{event_id}/checklist")
async def update_checklist(event_id: str, body: ChecklistUpdate, user=Depends(get_current_user)):
    ev = await db.customer_events.find_one({"id": event_id, "user_id": user["id"]})
    if not ev:
        raise HTTPException(404, "Event not found")
    spent = sum(int(i.get("allocated", 0)) for i in body.checklist if i.get("status") == "completed")
    await db.customer_events.update_one({"id": event_id}, {"$set": {"checklist": body.checklist, "spent": spent}})
    ev = await db.customer_events.find_one({"id": event_id}, {"_id": 0})
    return ev


# ----------------------------- vendor dashboard -----------------------------
@api.get("/vendor/me")
async def vendor_me(user=Depends(require_roles("vendor", "vendor_staff"))):
    v = await db.vendors.find_one({"user_id": user["id"]}, {"_id": 0})
    if not v:
        raise HTTPException(404, "No vendor profile linked")
    return v


@api.get("/vendor/stats")
async def vendor_stats(user=Depends(require_roles("vendor", "vendor_staff"))):
    v = await db.vendors.find_one({"user_id": user["id"]}, {"_id": 0})
    if not v:
        raise HTTPException(404, "No vendor profile linked")
    leads = await db.enquiries.count_documents({"vendor_id": v["id"]})
    new_leads = await db.enquiries.count_documents({"vendor_id": v["id"], "status": "new"})
    return {
        "profile_completion": v.get("profile_completion", 80),
        "verification": v.get("status"),
        "total_leads": leads, "new_leads": new_leads,
        "rating": v.get("rating"), "review_count": v.get("review_count"),
        "profile_views": v.get("profile_views", 0),
        "revenue": v.get("revenue", 0),
        "services": len(v.get("services", [])), "packages": len(v.get("packages", [])),
    }


@api.get("/vendor/leads")
async def vendor_leads(user=Depends(require_roles("vendor", "vendor_staff"))):
    v = await db.vendors.find_one({"user_id": user["id"]}, {"_id": 0})
    if not v:
        raise HTTPException(404, "No vendor profile linked")
    return await db.enquiries.find({"vendor_id": v["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ----------------------------- admin -----------------------------
ADMIN_ROLES = ("admin", "super_admin", "content_manager", "support_manager", "finance_manager")


@api.get("/admin/stats")
async def admin_stats(user=Depends(require_roles(*ADMIN_ROLES))):
    return {
        "total_customers": await db.users.count_documents({"role": "customer"}),
        "total_vendors": await db.vendors.count_documents({}),
        "pending_vendors": await db.vendors.count_documents({"status": "submitted"}),
        "verified_vendors": await db.vendors.count_documents({"verified": True}),
        "active_vendors": await db.vendors.count_documents({"status": "approved"}),
        "total_enquiries": await db.enquiries.count_documents({}),
        "total_reviews": await db.reviews.count_documents({}),
        "categories": await db.categories.count_documents({}),
        "banners": await db.banners.count_documents({}),
        "cities": await db.cities.count_documents({}),
    }


@api.get("/admin/vendors")
async def admin_vendors(status: Optional[str] = None, user=Depends(require_roles(*ADMIN_ROLES))):
    q = {}
    if status:
        q["status"] = status
    return await db.vendors.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/admin/vendors/{vendor_id}/{action}")
async def admin_vendor_action(vendor_id: str, action: str, user=Depends(require_roles("admin", "super_admin"))):
    mapping = {
        "approve": {"status": "approved", "verified": True},
        "reject": {"status": "rejected", "verified": False},
        "suspend": {"status": "suspended"},
        "feature": {"featured": True},
        "unfeature": {"featured": False},
    }
    if action not in mapping:
        raise HTTPException(400, "Invalid action")
    r = await db.vendors.update_one({"id": vendor_id}, {"$set": mapping[action]})
    if r.matched_count == 0:
        raise HTTPException(404, "Vendor not found")
    await db.audit_logs.insert_one({
        "id": new_id(), "actor": user["email"] or user["name"], "action": f"vendor.{action}",
        "target": vendor_id, "created_at": now_iso(),
    })
    return {"ok": True, "action": action}


@api.post("/admin/categories")
async def admin_create_category(body: CategoryUpsert, user=Depends(require_roles("admin", "super_admin", "content_manager"))):
    slug = slugify(body.name)
    doc = {"id": new_id(), "slug": slug, **body.model_dump()}
    await db.categories.update_one({"slug": slug}, {"$set": doc}, upsert=True)
    return await db.categories.find_one({"slug": slug}, {"_id": 0})


@api.put("/admin/categories/{slug}/theme")
async def admin_update_theme(slug: str, theme: dict, user=Depends(require_roles("admin", "super_admin", "content_manager"))):
    r = await db.categories.update_one({"slug": slug}, {"$set": {"theme": theme}})
    if r.matched_count == 0:
        raise HTTPException(404, "Category not found")
    await db.audit_logs.insert_one({"id": new_id(), "actor": user.get("email") or user["name"],
                                    "action": "category.theme", "target": slug, "created_at": now_iso()})
    return {"ok": True}


@api.post("/admin/banners")
async def admin_create_banner(body: BannerUpsert, user=Depends(require_roles("admin", "super_admin", "content_manager"))):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.banners.insert_one({**doc})
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/admin/banners/{banner_id}")
async def admin_delete_banner(banner_id: str, user=Depends(require_roles("admin", "super_admin", "content_manager"))):
    await db.banners.delete_one({"id": banner_id})
    return {"ok": True}


@api.get("/admin/audit-logs")
async def admin_audit(user=Depends(require_roles("admin", "super_admin"))):
    return await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api.get("/")
async def root():
    return {"service": "MakeMyEventPro API", "status": "ok"}


# ----------------------------- seed -----------------------------
from seed import seed_database  # noqa: E402


@app.on_event("startup")
async def startup():
    await db.vendors.create_index("category_slug")
    await db.vendors.create_index("city")
    await db.vendors.create_index([("business_name", "text"), ("description", "text")])
    await db.favorites.create_index([("user_id", 1), ("vendor_id", 1)], unique=True)
    await seed_database(db)
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
