"""File uploads via Emergent Object Storage with validation. Files served through /api/files/{id}."""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import Response
from typing import Optional
import os
import uuid
import requests
import jwt
from core import db, now_iso, new_id, get_current_user, clean, ADMIN_ROLES, JWT_SECRET, logger

router = APIRouter(prefix="/files", tags=["files"])

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "makemyeventpro"
storage_key = None

ALLOWED = {
    "image": ({"image/jpeg", "image/png", "image/webp", "image/gif"}, 8 * 1024 * 1024),
    "video": ({"video/mp4", "video/webm", "video/quicktime"}, 100 * 1024 * 1024),
    "document": ({"application/pdf", "image/jpeg", "image/png", "image/webp"}, 10 * 1024 * 1024),
}
PRIVATE_PURPOSES = {"kyc", "bank", "chat"}


def init_storage(force=False):
    global storage_key
    if storage_key and not force:
        return storage_key
    if not EMERGENT_KEY:
        raise HTTPException(503, "Object storage not configured (EMERGENT_LLM_KEY missing)")
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    r.raise_for_status()
    storage_key = r.json()["storage_key"]
    return storage_key


def put_object(path, data, content_type):
    key = init_storage()
    r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if r.status_code == 404:
        key = init_storage(force=True)
        r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    r.raise_for_status()
    return r.json()


def get_object(path):
    key = init_storage()
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 404:
        key = init_storage(force=True)
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


@router.post("/upload")
async def upload(file: UploadFile = File(...), kind: str = Form("image"), purpose: str = Form("gallery"),
                 user=Depends(get_current_user)):
    if kind not in ALLOWED:
        raise HTTPException(400, "kind must be image|video|document")
    types, max_size = ALLOWED[kind]
    ct = file.content_type or ""
    if ct not in types:
        raise HTTPException(400, f"Unsupported file type {ct} for {kind}")
    data = await file.read()
    if len(data) > max_size:
        raise HTTPException(413, f"File too large (max {max_size // (1024*1024)} MB)")
    if len(data) == 0:
        raise HTTPException(400, "Empty file")
    ext = (file.filename or "bin").rsplit(".", 1)[-1].lower()[:5]
    fid = new_id()
    path = f"{APP_NAME}/{purpose}/{user['id']}/{fid}.{ext}"
    try:
        result = put_object(path, data, ct)
    except requests.HTTPError as e:
        logger.error(f"storage upload failed: {e}")
        raise HTTPException(502, "Storage upload failed")
    doc = {"id": fid, "storage_path": result["path"], "original_filename": file.filename, "content_type": ct,
           "size": len(data), "kind": kind, "purpose": purpose, "owner_id": user["id"],
           "private": purpose in PRIVATE_PURPOSES, "is_deleted": False, "created_at": now_iso()}
    await db.files.insert_one({**doc})
    return {**clean(doc), "url": f"/api/files/{fid}"}


@router.get("/{file_id}")
async def serve(file_id: str, auth: Optional[str] = Query(None)):
    rec = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "File not found")
    if rec.get("private"):
        if not auth:
            raise HTTPException(401, "Auth required")
        try:
            payload = jwt.decode(auth, JWT_SECRET, algorithms=["HS256"])
        except jwt.PyJWTError:
            raise HTTPException(401, "Invalid token")
        if payload["sub"] != rec["owner_id"] and payload.get("role") not in ADMIN_ROLES:
            # chat attachments: allow both participants
            allowed = False
            if rec["purpose"] == "chat":
                msg = await db.messages.find_one({"file_id": file_id})
                if msg:
                    enq = await db.enquiries.find_one({"id": msg["enquiry_id"]})
                    v = await db.vendors.find_one({"id": enq["vendor_id"]}) if enq else None
                    allowed = enq and (enq["user_id"] == payload["sub"] or (v and v.get("user_id") == payload["sub"]))
            if not allowed:
                raise HTTPException(403, "Forbidden")
    data, ct = get_object(rec["storage_path"])
    return Response(content=data, media_type=rec.get("content_type", ct),
                    headers={"Cache-Control": "private, max-age=3600" if rec.get("private") else "public, max-age=86400"})


@router.delete("/{file_id}")
async def soft_delete(file_id: str, user=Depends(get_current_user)):
    rec = await db.files.find_one({"id": file_id})
    if not rec:
        raise HTTPException(404, "File not found")
    if rec["owner_id"] != user["id"] and user["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Forbidden")
    await db.files.update_one({"id": file_id}, {"$set": {"is_deleted": True}})
    return {"ok": True}
