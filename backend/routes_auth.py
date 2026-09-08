"""Auth: OTP provider adapter (firebase | demo), sessions, profile."""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import os
import re
import json
import random
from core import (db, now_iso, new_id, clean, make_session, get_current_user, rate_limit,
                  DEMO_OTP_ENABLED, OTP_PROVIDER, logger)

router = APIRouter(prefix="/auth", tags=["auth"])
_firebase_ready = False


def _init_firebase():
    global _firebase_ready
    if _firebase_ready:
        return True
    try:
        import firebase_admin
        from firebase_admin import credentials
        raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
        if not firebase_admin._apps:
            if raw:
                cred = credentials.Certificate(json.loads(raw))
            elif path and os.path.exists(path):
                cred = credentials.Certificate(path)
            else:
                return False
            firebase_admin.initialize_app(cred)
        _firebase_ready = True
        return True
    except Exception as e:
        logger.error(f"Firebase init failed: {e}")
        return False


class SendOtp(BaseModel):
    phone: str


class VerifyOtp(BaseModel):
    phone: str
    code: str
    name: Optional[str] = None
    role: Optional[str] = "customer"


class FirebaseVerify(BaseModel):
    id_token: str
    name: Optional[str] = None
    role: Optional[str] = "customer"


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    avatar: Optional[str] = None


def norm_phone(p: str):
    p = re.sub(r'\D', '', p or '')
    if len(p) == 12 and p.startswith('91'):
        p = p[2:]
    if not re.fullmatch(r'\d{10}', p):
        raise HTTPException(400, "Enter a valid 10-digit mobile number")
    return p


async def upsert_user(phone: str, name: Optional[str], role: Optional[str], firebase_uid: str = None):
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        user = {"id": new_id(), "phone": phone, "name": name or "Guest User", "email": None,
                "role": role if role in ("customer", "vendor") else "customer", "city": "Hyderabad",
                "avatar": None, "status": "active", "firebase_uid": firebase_uid, "created_at": now_iso()}
        await db.users.insert_one({**user})
    elif firebase_uid and not user.get("firebase_uid"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"firebase_uid": firebase_uid}})
    if user.get("status") == "suspended":
        raise HTTPException(403, "Account suspended. Contact support.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login_at": now_iso()}})
    return user


@router.get("/config")
async def auth_config():
    return {"provider": OTP_PROVIDER, "demo_enabled": DEMO_OTP_ENABLED and OTP_PROVIDER == "demo",
            "firebase_backend_ready": _init_firebase() if OTP_PROVIDER == "firebase" else False}


@router.post("/send-otp")
async def send_otp(body: SendOtp, request: Request):
    phone = norm_phone(body.phone)
    rate_limit(f"otp:{request.client.host}", 20, 600)
    window = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    if await db.otps.count_documents({"phone": phone, "created_at": {"$gt": window}}) >= 5:
        raise HTTPException(429, "Too many OTP requests. Please try again in 10 minutes.")
    if OTP_PROVIDER == "firebase":
        # Firebase sends the SMS from the client SDK; backend only verifies the ID token.
        return {"sent": False, "provider": "firebase", "message": "Use Firebase client SDK to send OTP"}
    code = str(random.randint(100000, 999999))
    await db.otps.insert_one({"phone": phone, "code": code, "attempts": 0, "created_at": now_iso(),
                              "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()})
    resp = {"sent": True, "provider": "demo"}
    if DEMO_OTP_ENABLED:
        resp.update({"demo_otp": code, "message": "DEMO MODE — OTP shown for development only"})
    return resp


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtp, request: Request):
    if OTP_PROVIDER == "firebase":
        raise HTTPException(400, "Use /auth/firebase-verify with the Firebase ID token")
    phone = norm_phone(body.phone)
    rate_limit(f"verify:{phone}", 10, 600)
    rec = await db.otps.find_one({"phone": phone}, sort=[("created_at", -1)])
    if not rec:
        raise HTTPException(400, "Request an OTP first")
    if rec.get("attempts", 0) >= 5:
        raise HTTPException(429, "Too many attempts. Request a new OTP.")
    universal = DEMO_OTP_ENABLED and body.code == "123456"
    if not universal and rec["code"] != body.code:
        await db.otps.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Incorrect OTP")
    if not universal and rec["expires_at"] < now_iso():
        raise HTTPException(400, "OTP expired")
    await db.otps.delete_many({"phone": phone})
    user = await upsert_user(phone, body.name, body.role)
    token = await make_session(user, request.headers.get("user-agent", ""))
    return {"token": token, "user": clean(user)}


@router.post("/firebase-verify")
async def firebase_verify(body: FirebaseVerify, request: Request):
    rate_limit(f"fb:{request.client.host}", 30, 600)
    if not _init_firebase():
        raise HTTPException(503, "Firebase not configured on server (FIREBASE_SERVICE_ACCOUNT_JSON/PATH missing)")
    from firebase_admin import auth as fb_auth
    try:
        decoded = fb_auth.verify_id_token(body.id_token)
    except Exception as e:
        raise HTTPException(401, f"Invalid Firebase token: {e}")
    phone_number = decoded.get("phone_number")
    if not phone_number:
        raise HTTPException(400, "Token has no phone number")
    user = await upsert_user(norm_phone(phone_number), body.name, body.role, decoded.get("uid"))
    token = await make_session(user, request.headers.get("user-agent", ""))
    return {"token": token, "user": clean(user)}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    u = clean(user)
    u.pop("_sid", None)
    return u


@router.put("/me")
async def update_me(body: ProfileUpdate, user=Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "email" in upd and upd["email"] and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', upd["email"]):
        raise HTTPException(400, "Invalid email")
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    return clean(await db.users.find_one({"id": user["id"]}, {"_id": 0}))


@router.post("/logout")
async def logout(user=Depends(get_current_user)):
    if user.get("_sid"):
        await db.sessions.delete_one({"id": user["_sid"]})
    return {"ok": True}


@router.post("/logout-all")
async def logout_all(user=Depends(get_current_user)):
    await db.sessions.delete_many({"user_id": user["id"]})
    return {"ok": True}


@router.get("/sessions")
async def sessions(user=Depends(get_current_user)):
    return await db.sessions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
