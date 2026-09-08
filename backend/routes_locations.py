"""Location hierarchy: country → state → city → area → pincode. Admin-managed, dynamic."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import re
from core import db, now_iso, new_id, slugify, clean, require_roles, audit, SUPER_ROLES, haversine_km

router = APIRouter(tags=["locations"])
TYPES = ["country", "state", "city", "area", "pincode"]
LOC_ADMIN = require_roles(*SUPER_ROLES, "content_manager")


class LocationIn(BaseModel):
    type: str
    name: str
    parent_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    pincode: Optional[str] = None
    active: bool = True
    order: int = 100
    is_launch: bool = False


@router.get("/locations")
async def list_locations(type: Optional[str] = None, parent_id: Optional[str] = None, active_only: bool = True):
    q = {}
    if type:
        q["type"] = type
    if parent_id:
        q["parent_id"] = parent_id
    if active_only:
        q["active"] = True
    return await db.locations.find(q, {"_id": 0}).sort([("order", 1), ("name", 1)]).to_list(2000)


@router.get("/locations/tree")
async def location_tree(city_slug: Optional[str] = None):
    q = {"active": True}
    cities = await db.locations.find({**q, "type": "city"}, {"_id": 0}).sort("order", 1).to_list(200)
    out = []
    for c in cities:
        if city_slug and c["slug"] != city_slug:
            continue
        areas = await db.locations.find({**q, "type": "area", "parent_id": c["id"]}, {"_id": 0}).sort("name", 1).to_list(500)
        for a in areas:
            a["pincodes"] = [p["name"] for p in await db.locations.find({"type": "pincode", "parent_id": a["id"]}, {"_id": 0}).to_list(50)]
        state = await db.locations.find_one({"id": c.get("parent_id")}, {"_id": 0})
        out.append({**c, "state": state["name"] if state else None, "areas": areas})
    return out


@router.get("/locations/search")
async def search_locations(q: str, city: Optional[str] = None):
    if len(q) < 2:
        return []
    rx = {"$regex": re.escape(q), "$options": "i"}
    query = {"active": True, "$or": [{"name": rx}, {"pincode": rx}]}
    res = await db.locations.find(query, {"_id": 0}).limit(15).to_list(15)
    for r in res:
        parent = await db.locations.find_one({"id": r.get("parent_id")}, {"_id": 0, "name": 1, "type": 1})
        r["parent_name"] = parent["name"] if parent else None
    return res


@router.get("/locations/nearest")
async def nearest_area(lat: float, lng: float):
    areas = await db.locations.find({"type": "area", "active": True, "lat": {"$ne": None}}, {"_id": 0}).to_list(2000)
    if not areas:
        raise HTTPException(404, "No areas configured")
    best = min(areas, key=lambda a: haversine_km(lat, lng, a["lat"], a["lng"]))
    city = await db.locations.find_one({"id": best["parent_id"]}, {"_id": 0})
    return {"area": best, "city": city, "distance_km": haversine_km(lat, lng, best["lat"], best["lng"])}


@router.post("/admin/locations")
async def create_location(body: LocationIn, user=Depends(LOC_ADMIN)):
    if body.type not in TYPES:
        raise HTTPException(400, f"type must be one of {TYPES}")
    if body.type != "country" and not body.parent_id:
        raise HTTPException(400, "parent_id required")
    if body.parent_id and not await db.locations.find_one({"id": body.parent_id}):
        raise HTTPException(404, "Parent not found")
    doc = {"id": new_id(), **body.model_dump(), "slug": slugify(body.name), "created_at": now_iso()}
    await db.locations.insert_one({**doc})
    await audit(user, "location.create", doc["id"], {"name": body.name, "type": body.type})
    return clean(doc)


@router.put("/admin/locations/{loc_id}")
async def update_location(loc_id: str, body: LocationIn, user=Depends(LOC_ADMIN)):
    upd = {**body.model_dump(), "slug": slugify(body.name), "updated_at": now_iso()}
    r = await db.locations.update_one({"id": loc_id}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Location not found")
    await audit(user, "location.update", loc_id)
    return clean(await db.locations.find_one({"id": loc_id}, {"_id": 0}))


@router.delete("/admin/locations/{loc_id}")
async def delete_location(loc_id: str, user=Depends(LOC_ADMIN)):
    if await db.locations.count_documents({"parent_id": loc_id}):
        raise HTTPException(400, "Delete child locations first")
    await db.locations.delete_one({"id": loc_id})
    await audit(user, "location.delete", loc_id)
    return {"ok": True}
