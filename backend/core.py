"""Shared DB, auth dependencies and helpers for MakeMyEventPro."""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone, timedelta
import os
import re
import uuid
import time
import jwt
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
logger = logging.getLogger("mmep")

JWT_SECRET = os.environ['JWT_SECRET']
JWT_EXPIRE_HOURS = int(os.environ.get('JWT_EXPIRE_HOURS', '720'))
OWNER_EMAIL = os.environ.get('OWNER_EMAIL', 'exactmedia.in@gmail.com')
DEMO_OTP_ENABLED = os.environ.get('DEMO_OTP_ENABLED', 'false').lower() == 'true'
OTP_PROVIDER = os.environ.get('OTP_PROVIDER', 'demo')
PAYMENT_DEMO_ENABLED = os.environ.get('PAYMENT_DEMO_ENABLED', 'false').lower() == 'true'

ADMIN_ROLES = ("admin", "super_admin", "content_manager", "support_manager", "finance_manager")
SUPER_ROLES = ("admin", "super_admin")
VENDOR_ROLES = ("vendor", "vendor_staff")
security = HTTPBearer(auto_error=False)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def slugify(text: str):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def clean(doc):
    if doc is None:
        return None
    return {k: v for k, v in doc.items() if k != "_id"}


async def make_session(user, ua: str = ""):
    sid = new_id()
    await db.sessions.insert_one({"id": sid, "user_id": user["id"], "ua": ua[:200], "created_at": now_iso(),
                                  "expires_at": (datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)).isoformat()})
    payload = {"sub": user["id"], "role": user["role"], "sid": sid,
               "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    if payload.get("sid"):
        if not await db.sessions.find_one({"id": payload["sid"]}):
            raise HTTPException(401, "Session revoked")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("status") == "suspended":
        raise HTTPException(403, "Account suspended")
    user["_sid"] = payload.get("sid")
    return user


async def optional_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        return None
    try:
        return await get_current_user(creds)
    except HTTPException:
        return None


def require_roles(*roles):
    async def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return checker


async def audit(user, action: str, target: str, meta: dict = None):
    await db.audit_logs.insert_one({"id": new_id(), "actor": user.get("email") or user.get("name"), "actor_id": user["id"],
                                    "action": action, "target": target, "meta": meta or {}, "created_at": now_iso()})


async def notify(user_id: Optional[str], title: str, body: str, link: str = None, kind: str = "info"):
    if not user_id:
        return
    await db.notifications.insert_one({"id": new_id(), "user_id": user_id, "title": title, "body": body,
                                       "link": link, "kind": kind, "read": False, "created_at": now_iso()})


async def get_vendor_for_user(user):
    v = await db.vendors.find_one({"user_id": user["id"]}, {"_id": 0})
    if not v:
        raise HTTPException(404, "No vendor profile linked")
    return v


async def get_setting(key: str, default=None):
    s = await db.settings.find_one({"key": key}, {"_id": 0})
    return s["value"] if s else default


# simple in-memory rate limiter (per-process); swap for Redis in multi-node deploys
_hits = {}


def rate_limit(key: str, limit: int, window_sec: int):
    now = time.time()
    hits = [t for t in _hits.get(key, []) if now - t < window_sec]
    if len(hits) >= limit:
        raise HTTPException(429, "Too many requests. Please try again later.")
    hits.append(now)
    _hits[key] = hits


def haversine_km(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, asin, sqrt
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return round(2 * 6371 * asin(sqrt(a)), 1)
