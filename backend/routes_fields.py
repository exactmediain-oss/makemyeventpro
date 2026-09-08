"""Dynamic category field builder — admin defines fields per category/subcategory; vendors fill values."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from core import db, now_iso, new_id, slugify, clean, require_roles, audit, SUPER_ROLES

router = APIRouter(tags=["fields"])
FIELD_TYPES = ["text", "number", "currency", "boolean", "select", "multiselect", "checkbox", "date", "time",
               "datetime", "range", "file", "image", "video", "url"]
FIELD_ADMIN = require_roles(*SUPER_ROLES, "content_manager")


class FieldDef(BaseModel):
    category_slug: str
    subcategory: Optional[str] = None
    key: Optional[str] = None
    label: str
    type: str
    options: Optional[List[str]] = []
    unit: Optional[str] = None
    help_text: Optional[str] = None
    default: Optional[object] = None
    required: bool = False
    order: int = 100
    customer_visible: bool = True
    vendor_only: bool = False
    filterable: bool = False
    searchable: bool = False
    featured: bool = False
    min: Optional[float] = None
    max: Optional[float] = None
    group: Optional[str] = "Details"
    active: bool = True


@router.get("/fields")
async def public_fields(category: str, subcategory: Optional[str] = None, scope: str = "all"):
    q = {"category_slug": category, "active": True}
    if subcategory:
        q["$or"] = [{"subcategory": None}, {"subcategory": subcategory}]
    else:
        q["subcategory"] = None
    if scope == "customer":
        q["customer_visible"] = True
        q["vendor_only"] = False
    if scope == "filters":
        q["filterable"] = True
    return await db.field_definitions.find(q, {"_id": 0}).sort("order", 1).to_list(300)


@router.get("/admin/fields")
async def admin_fields(category: Optional[str] = None, user=Depends(FIELD_ADMIN)):
    q = {"category_slug": category} if category else {}
    return await db.field_definitions.find(q, {"_id": 0}).sort([("category_slug", 1), ("order", 1)]).to_list(2000)


@router.post("/admin/fields")
async def create_field(body: FieldDef, user=Depends(FIELD_ADMIN)):
    if body.type not in FIELD_TYPES:
        raise HTTPException(400, f"type must be one of {FIELD_TYPES}")
    if body.type in ("select", "multiselect") and not body.options:
        raise HTTPException(400, "Select fields need options")
    if not await db.categories.find_one({"slug": body.category_slug}):
        raise HTTPException(404, "Category not found")
    key = body.key or slugify(body.label).replace("-", "_")
    if await db.field_definitions.find_one({"category_slug": body.category_slug, "key": key, "subcategory": body.subcategory}):
        raise HTTPException(409, "Field key already exists for this category")
    doc = {"id": new_id(), **body.model_dump(), "key": key, "created_at": now_iso()}
    await db.field_definitions.insert_one({**doc})
    await audit(user, "field.create", doc["id"], {"key": key, "category": body.category_slug})
    return clean(doc)


@router.put("/admin/fields/{field_id}")
async def update_field(field_id: str, body: FieldDef, user=Depends(FIELD_ADMIN)):
    if body.type not in FIELD_TYPES:
        raise HTTPException(400, "Invalid type")
    upd = body.model_dump()
    upd.pop("key", None)
    upd["updated_at"] = now_iso()
    r = await db.field_definitions.update_one({"id": field_id}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Field not found")
    await audit(user, "field.update", field_id)
    return clean(await db.field_definitions.find_one({"id": field_id}, {"_id": 0}))


@router.delete("/admin/fields/{field_id}")
async def delete_field(field_id: str, user=Depends(FIELD_ADMIN)):
    r = await db.field_definitions.delete_one({"id": field_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Field not found")
    await audit(user, "field.delete", field_id)
    return {"ok": True}


class Reorder(BaseModel):
    ids: List[str]


@router.post("/admin/fields/reorder")
async def reorder_fields(body: Reorder, user=Depends(FIELD_ADMIN)):
    for i, fid in enumerate(body.ids):
        await db.field_definitions.update_one({"id": fid}, {"$set": {"order": (i + 1) * 10}})
    return {"ok": True}


def validate_values(defs: list, values: dict):
    """Server-side validation of vendor custom field values against definitions."""
    errors = {}
    for d in defs:
        val = values.get(d["key"])
        if val in (None, "", []):
            if d.get("required"):
                errors[d["key"]] = "Required"
            continue
        t = d["type"]
        try:
            if t in ("number", "currency", "range"):
                num = float(val if t != "range" else val.get("max", 0))
                if d.get("min") is not None and num < d["min"]:
                    errors[d["key"]] = f"Min {d['min']}"
                if d.get("max") is not None and num > d["max"]:
                    errors[d["key"]] = f"Max {d['max']}"
            elif t == "select" and val not in d.get("options", []):
                errors[d["key"]] = "Invalid option"
            elif t == "multiselect" and not set(val).issubset(set(d.get("options", []))):
                errors[d["key"]] = "Invalid option"
            elif t in ("boolean", "checkbox") and not isinstance(val, bool):
                errors[d["key"]] = "Must be true/false"
            elif t == "url" and not str(val).startswith(("http://", "https://")):
                errors[d["key"]] = "Must be a URL"
        except (TypeError, ValueError, AttributeError):
            errors[d["key"]] = "Invalid value"
    return errors
