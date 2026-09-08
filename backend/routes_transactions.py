"""Marketplace transactions: enquiries, chat, quotes, bookings, payments, refunds, reviews."""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from core import (db, now_iso, new_id, clean, get_current_user, require_roles, notify, audit, get_setting,
                  get_vendor_for_user, VENDOR_ROLES, ADMIN_ROLES, PAYMENT_DEMO_ENABLED, logger)
import payments as pay

router = APIRouter(tags=["transactions"])

BOOKING_STATUSES = ["enquiry", "quote_sent", "quote_accepted", "payment_pending", "confirmed", "in_progress",
                    "completed", "cancelled", "refund_requested", "refunded", "disputed"]


# ----------------------------- models -----------------------------
class EnquiryCreate(BaseModel):
    vendor_ids: List[str]
    event_type: str
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    location: Optional[str] = None
    guests: Optional[int] = None
    budget: Optional[int] = None
    services: Optional[List[str]] = []
    package_id: Optional[str] = None
    message: Optional[str] = None
    custom_answers: Optional[dict] = {}


class MessageIn(BaseModel):
    text: Optional[str] = None
    file_id: Optional[str] = None


class QuoteItem(BaseModel):
    name: str
    qty: float = 1
    unit_price: float
    description: Optional[str] = None


class QuoteIn(BaseModel):
    items: List[QuoteItem]
    discount: float = 0
    tax_percent: float = 0
    advance_amount: float
    terms: Optional[str] = None
    valid_days: int = Field(7, ge=1, le=90)
    notes: Optional[str] = None
    cancellation_policy: Optional[str] = None


class StatusIn(BaseModel):
    status: str
    note: Optional[str] = None


class PaymentCreate(BaseModel):
    booking_id: str
    type: str = "advance"  # advance | balance
    origin_url: Optional[str] = None
    coupon_code: Optional[str] = None


class RazorpayVerify(BaseModel):
    payment_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class ReviewIn(BaseModel):
    booking_id: str
    rating: int = Field(ge=1, le=5)
    quality: Optional[int] = None
    service: Optional[int] = None
    value: Optional[int] = None
    text: str
    photos: Optional[List[str]] = []


class ReviewResponse(BaseModel):
    response: str


# ----------------------------- helpers -----------------------------
async def _enquiry_access(enquiry_id: str, user):
    e = await db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Enquiry not found")
    if user["role"] in ADMIN_ROLES or e["user_id"] == user["id"]:
        return e, "customer" if e["user_id"] == user["id"] else "admin"
    v = await db.vendors.find_one({"id": e["vendor_id"]}, {"_id": 0, "user_id": 1})
    if v and v.get("user_id") == user["id"]:
        return e, "vendor"
    raise HTTPException(403, "Forbidden")


async def _booking_access(booking_id: str, user):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] in ADMIN_ROLES:
        return b, "admin"
    if b["user_id"] == user["id"]:
        return b, "customer"
    v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "user_id": 1})
    if v and v.get("user_id") == user["id"]:
        return b, "vendor"
    raise HTTPException(403, "Forbidden")


async def _set_booking_status(b, status, actor, note=None):
    hist = {"status": status, "by": actor, "note": note, "at": now_iso()}
    await db.bookings.update_one({"id": b["id"]}, {"$set": {"status": status, "updated_at": now_iso()}, "$push": {"history": hist}})
    await db.enquiries.update_one({"id": b["enquiry_id"]}, {"$set": {"status": status}})


async def effective_payment():
    """Resolve the active checkout config from the DB-stored payment_mode.
    Secrets are never included — only the public razorpay key_id and boolean flags.
    When no payment_mode is stored, the current env-driven behavior is preserved."""
    mode = await get_setting("payment_mode", None)
    demo_on = await get_setting("demo_payment_enabled", None)
    rzp_on = await get_setting("razorpay_enabled", True)
    if demo_on is None:
        demo_on = PAYMENT_DEMO_ENABLED
    if mode is None:
        if pay.active_provider() == "razorpay":
            mode = "razorpay_live" if pay.RZP_KEY_ID.startswith("rzp_live") else "razorpay_test"
        elif demo_on:
            mode = "demo"
        else:
            mode = "none"
    if mode == "demo":
        prov = "demo" if demo_on else "none"
        return {"payment_mode": "demo", "provider": prov, "rzp_mode": None, "razorpay_key_id": None,
                "demo_enabled": bool(demo_on), "checkout_available": prov != "none"}
    if mode == "razorpay_test":
        ok = bool(rzp_on) and pay.razorpay_test_configured()
        return {"payment_mode": "razorpay_test", "provider": "razorpay" if ok else "none", "rzp_mode": "test",
                "razorpay_key_id": pay.public_key_id("test") if ok else None, "demo_enabled": False,
                "checkout_available": ok}
    if mode == "razorpay_live":
        ok = bool(rzp_on) and pay.razorpay_live_configured()
        return {"payment_mode": "razorpay_live", "provider": "razorpay" if ok else "none", "rzp_mode": "live",
                "razorpay_key_id": pay.public_key_id("live") if ok else None, "demo_enabled": False,
                "checkout_available": ok}
    return {"payment_mode": "none", "provider": "none", "rzp_mode": None, "razorpay_key_id": None,
            "demo_enabled": False, "checkout_available": False}


# ----------------------------- enquiries -----------------------------
@router.post("/enquiries")
async def create_enquiry(body: EnquiryCreate, user=Depends(get_current_user)):
    created = []
    for vid in body.vendor_ids[:10]:
        vendor = await db.vendors.find_one({"id": vid, "status": "approved"}, {"_id": 0})
        if not vendor:
            continue
        pkg = next((p for p in vendor.get("packages", []) if p["id"] == body.package_id), None) if body.package_id else None
        doc = {"id": new_id(), "user_id": user["id"], "customer_name": user.get("name"), "customer_phone": user.get("phone"),
               "vendor_id": vid, "vendor_name": vendor["business_name"], "vendor_slug": vendor["slug"],
               "vendor_cover": vendor.get("cover"), "category_slug": vendor["category_slug"],
               "event_type": body.event_type, "event_date": body.event_date, "event_time": body.event_time,
               "location": body.location or user.get("city"), "guests": body.guests, "budget": body.budget,
               "services": body.services, "package": pkg, "message": body.message, "custom_answers": body.custom_answers,
               "status": "new", "unread_vendor": 1, "unread_customer": 0, "created_at": now_iso(), "updated_at": now_iso()}
        await db.enquiries.insert_one({**doc})
        if body.message:
            await db.messages.insert_one({"id": new_id(), "enquiry_id": doc["id"], "sender_id": user["id"], "sender_role": "customer",
                                          "text": body.message, "file_id": None, "created_at": now_iso()})
        created.append(clean(doc))
        await notify(user["id"], "Enquiry sent", f"Your enquiry was sent to {vendor['business_name']}.", f"/enquiries/{doc['id']}")
        await notify(vendor.get("user_id"), "New enquiry", f"{user.get('name')} enquired for {body.event_type}.", f"/vendor/leads/{doc['id']}", "lead")
    return {"created": len(created), "enquiries": created}


@router.get("/enquiries")
async def my_enquiries(user=Depends(get_current_user)):
    return await db.enquiries.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.get("/enquiries/{enquiry_id}")
async def enquiry_detail(enquiry_id: str, user=Depends(get_current_user)):
    e, role = await _enquiry_access(enquiry_id, user)
    quotes = await db.quotes.find({"enquiry_id": enquiry_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    booking = await db.bookings.find_one({"enquiry_id": enquiry_id}, {"_id": 0})
    vendor = await db.vendors.find_one({"id": e["vendor_id"]}, {"_id": 0, "business_name": 1, "slug": 1, "cover": 1, "business_phone": 1, "area": 1, "rating": 1})
    unread_key = "unread_customer" if role == "customer" else "unread_vendor"
    await db.enquiries.update_one({"id": enquiry_id}, {"$set": {unread_key: 0}})
    return {"enquiry": e, "quotes": quotes, "booking": booking, "vendor": vendor, "viewer_role": role}


@router.get("/enquiries/{enquiry_id}/messages")
async def get_messages(enquiry_id: str, after: Optional[str] = None, user=Depends(get_current_user)):
    await _enquiry_access(enquiry_id, user)
    q = {"enquiry_id": enquiry_id}
    if after:
        q["created_at"] = {"$gt": after}
    return await db.messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)


@router.post("/enquiries/{enquiry_id}/messages")
async def send_message(enquiry_id: str, body: MessageIn, user=Depends(get_current_user)):
    e, role = await _enquiry_access(enquiry_id, user)
    if not body.text and not body.file_id:
        raise HTTPException(400, "Message is empty")
    if body.file_id:
        f = await db.files.find_one({"id": body.file_id, "owner_id": user["id"]})
        if not f:
            raise HTTPException(400, "Invalid file")
    msg = {"id": new_id(), "enquiry_id": enquiry_id, "sender_id": user["id"], "sender_role": role,
           "sender_name": user.get("name"), "text": (body.text or "")[:3000], "file_id": body.file_id, "created_at": now_iso()}
    await db.messages.insert_one({**msg})
    upd = {"updated_at": now_iso()}
    if role == "vendor" and e["status"] == "new":
        upd["status"] = "responded"
    inc = {"unread_customer": 1} if role == "vendor" else {"unread_vendor": 1}
    await db.enquiries.update_one({"id": enquiry_id}, {"$set": upd, "$inc": inc})
    if role == "vendor":
        await notify(e["user_id"], f"Message from {e['vendor_name']}", (body.text or "Sent an attachment")[:80], f"/enquiries/{enquiry_id}", "chat")
    else:
        v = await db.vendors.find_one({"id": e["vendor_id"]}, {"_id": 0, "user_id": 1})
        await notify(v.get("user_id") if v else None, f"Message from {user.get('name')}", (body.text or "Sent an attachment")[:80], f"/vendor/leads/{enquiry_id}", "chat")
    return clean(msg)


# ----------------------------- quotes -----------------------------
def _quote_totals(q: QuoteIn):
    subtotal = round(sum(i.qty * i.unit_price for i in q.items), 2)
    discount = min(q.discount, subtotal)
    taxable = subtotal - discount
    tax = round(taxable * q.tax_percent / 100, 2)
    total = round(taxable + tax, 2)
    if q.advance_amount > total:
        raise HTTPException(400, "Advance cannot exceed total")
    return subtotal, discount, tax, total


@router.post("/enquiries/{enquiry_id}/quotes")
async def create_quote(enquiry_id: str, body: QuoteIn, user=Depends(require_roles(*VENDOR_ROLES))):
    e, role = await _enquiry_access(enquiry_id, user)
    if role != "vendor":
        raise HTTPException(403, "Only the vendor can quote")
    if not body.items:
        raise HTTPException(400, "Add at least one item")
    if await db.bookings.find_one({"enquiry_id": enquiry_id, "status": {"$nin": ["cancelled"]}}):
        raise HTTPException(400, "A booking already exists for this enquiry")
    subtotal, discount, tax, total = _quote_totals(body)
    await db.quotes.update_many({"enquiry_id": enquiry_id, "status": "sent"}, {"$set": {"status": "superseded"}})
    doc = {"id": new_id(), "enquiry_id": enquiry_id, "vendor_id": e["vendor_id"], "vendor_name": e["vendor_name"],
           "user_id": e["user_id"], "items": [i.model_dump() for i in body.items], "subtotal": subtotal,
           "discount": discount, "tax_percent": body.tax_percent, "tax": tax, "total": total,
           "advance_amount": body.advance_amount, "balance_amount": round(total - body.advance_amount, 2),
           "terms": body.terms, "notes": body.notes, "cancellation_policy": body.cancellation_policy,
           "expires_at": (datetime.now(timezone.utc) + timedelta(days=body.valid_days)).isoformat(),
           "status": "sent", "created_at": now_iso()}
    await db.quotes.insert_one({**doc})
    await db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "quote_sent", "updated_at": now_iso()}, "$inc": {"unread_customer": 1}})
    await db.messages.insert_one({"id": new_id(), "enquiry_id": enquiry_id, "sender_id": user["id"], "sender_role": "vendor",
                                  "sender_name": e["vendor_name"], "text": f"Sent a quotation of ₹{total:,.0f}", "quote_id": doc["id"], "created_at": now_iso()})
    await notify(e["user_id"], "Quote received", f"{e['vendor_name']} sent a quote of ₹{total:,.0f}.", f"/enquiries/{enquiry_id}", "quote")
    return clean(doc)


@router.post("/quotes/{quote_id}/{action}")
async def quote_action(quote_id: str, action: str, user=Depends(get_current_user)):
    q = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Quote not found")
    if q["user_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    if q["status"] != "sent":
        raise HTTPException(400, f"Quote is {q['status']}")
    if action == "reject":
        await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "rejected"}})
        await db.enquiries.update_one({"id": q["enquiry_id"]}, {"$set": {"status": "responded"}})
        v = await db.vendors.find_one({"id": q["vendor_id"]}, {"_id": 0, "user_id": 1})
        await notify(v.get("user_id"), "Quote declined", f"{user.get('name')} declined your quote.", f"/vendor/leads/{q['enquiry_id']}")
        return {"ok": True, "status": "rejected"}
    if action != "accept":
        raise HTTPException(400, "Invalid action")
    if q["expires_at"] < now_iso():
        await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "expired"}})
        raise HTTPException(400, "Quote has expired — ask the vendor for a fresh quote")
    e = await db.enquiries.find_one({"id": q["enquiry_id"]}, {"_id": 0})
    commission_pct = await get_setting("commission_percent", 10)
    booking = {"id": new_id(), "code": "MMEP-" + new_id()[:6].upper(), "enquiry_id": e["id"], "quote_id": quote_id,
               "user_id": user["id"], "customer_name": user.get("name"), "customer_phone": user.get("phone"),
               "vendor_id": q["vendor_id"], "vendor_name": q["vendor_name"], "category_slug": e.get("category_slug"),
               "event_type": e["event_type"], "event_date": e.get("event_date"), "location": e.get("location"),
               "guests": e.get("guests"), "items": q["items"], "subtotal": q["subtotal"], "discount": q["discount"],
               "tax": q["tax"], "total": q["total"], "advance_amount": q["advance_amount"], "balance_amount": q["balance_amount"],
               "paid_amount": 0, "commission_percent": commission_pct, "terms": q.get("terms"),
               "cancellation_policy": q.get("cancellation_policy") or await get_setting("default_cancellation_policy", ""),
               "status": "payment_pending", "history": [{"status": "quote_accepted", "by": "customer", "at": now_iso()},
                                                        {"status": "payment_pending", "by": "system", "at": now_iso()}],
               "created_at": now_iso(), "updated_at": now_iso()}
    await db.bookings.insert_one({**booking})
    await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "accepted", "booking_id": booking["id"]}})
    await db.enquiries.update_one({"id": e["id"]}, {"$set": {"status": "payment_pending", "booking_id": booking["id"]}})
    v = await db.vendors.find_one({"id": q["vendor_id"]}, {"_id": 0, "user_id": 1})
    await notify(v.get("user_id"), "Quote accepted", f"{user.get('name')} accepted your quote. Awaiting advance payment.", f"/vendor/bookings")
    await notify(user["id"], "Quote accepted", "Pay the advance to confirm your booking.", f"/bookings/{booking['id']}", "booking")
    return {"ok": True, "status": "accepted", "booking": clean(booking)}


# ----------------------------- bookings -----------------------------
@router.get("/bookings")
async def my_bookings(user=Depends(get_current_user)):
    return await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.get("/bookings/{booking_id}")
async def booking_detail(booking_id: str, user=Depends(get_current_user)):
    b, role = await _booking_access(booking_id, user)
    pays = await db.payments.find({"booking_id": booking_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    review = await db.reviews.find_one({"booking_id": booking_id}, {"_id": 0})
    vendor = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "business_name": 1, "slug": 1, "cover": 1, "address": 1, "business_phone": 1, "gst_number": 1})
    eff = await effective_payment()
    return {"booking": b, "payments": pays, "review": review, "vendor": vendor, "viewer_role": role,
            "payment_config": {"provider": eff["provider"], "razorpay_key_id": eff["razorpay_key_id"],
                               "payment_mode": eff["payment_mode"], "checkout_available": eff["checkout_available"]},
            "demo_payment_enabled": eff["demo_enabled"]}


@router.get("/bookings/{booking_id}/invoice")
async def booking_invoice(booking_id: str, user=Depends(get_current_user)):
    b, _ = await _booking_access(booking_id, user)
    pays = await db.payments.find({"booking_id": booking_id, "status": "paid"}, {"_id": 0}).to_list(50)
    vendor = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "business_name": 1, "address": 1, "gst_number": 1, "business_phone": 1, "email": 1})
    return {"invoice_no": f"INV-{b['code']}", "issued_at": now_iso(), "booking": b, "vendor": vendor,
            "customer": {"name": b["customer_name"], "phone": b["customer_phone"]}, "payments": pays,
            "paid": sum(p["amount"] for p in pays), "due": round(b["total"] - sum(p["amount"] for p in pays), 2),
            "platform": {"name": "MakeMyEventPro", "email": "exactmedia.in@gmail.com"}}


VENDOR_TRANSITIONS = {"confirmed": ["in_progress", "cancelled"], "in_progress": ["completed"], "payment_pending": ["cancelled"]}
CUSTOMER_TRANSITIONS = {"payment_pending": ["cancelled"], "confirmed": ["cancelled"], "completed": ["disputed"], "in_progress": ["disputed"]}


@router.post("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, body: StatusIn, user=Depends(get_current_user)):
    b, role = await _booking_access(booking_id, user)
    if body.status not in BOOKING_STATUSES:
        raise HTTPException(400, "Invalid status")
    allowed = VENDOR_TRANSITIONS if role == "vendor" else CUSTOMER_TRANSITIONS if role == "customer" else {b["status"]: BOOKING_STATUSES}
    if body.status not in allowed.get(b["status"], []):
        raise HTTPException(400, f"Cannot move from {b['status']} to {body.status} as {role}")
    if body.status == "cancelled" and role == "customer" and b["paid_amount"] > 0:
        body.status = "refund_requested"
    await _set_booking_status(b, body.status, role, body.note)
    if role == "admin":
        await audit(user, "booking.status", booking_id, {"status": body.status})
    other = (await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "user_id": 1}) or {}).get("user_id") if role == "customer" else b["user_id"]
    await notify(other, f"Booking {b['code']} {body.status.replace('_', ' ')}", body.note or "Status updated.",
                 f"/bookings/{booking_id}" if role != "customer" else "/vendor/bookings", "booking")
    if body.status == "completed":
        await notify(b["user_id"], "How was your event?", f"Rate {b['vendor_name']} and help others.", f"/bookings/{booking_id}", "review")
    return {"ok": True, "status": body.status}


@router.post("/bookings/{booking_id}/refund/{action}")
async def refund_action(booking_id: str, action: str, body: StatusIn = None, user=Depends(require_roles(*ADMIN_ROLES))):
    """Admin resolves refund requests: approve (refund via provider) or reject."""
    b, _ = await _booking_access(booking_id, user)
    if b["status"] not in ("refund_requested", "disputed"):
        raise HTTPException(400, "No refund pending")
    if action == "reject":
        await _set_booking_status(b, "cancelled", "admin", (body.note if body else None) or "Refund rejected per policy")
        return {"ok": True}
    if action != "approve":
        raise HTTPException(400, "Invalid action")
    for p in await db.payments.find({"booking_id": booking_id, "status": "paid"}, {"_id": 0}).to_list(20):
        try:
            if p["provider"] == "razorpay" and p.get("provider_payment_id"):
                pay.razorpay_refund(p["provider_payment_id"], p["amount"], p.get("rzp_mode", "test"))
            elif p["provider"] == "stripe" and p.get("provider_payment_intent"):
                import stripe
                stripe.api_key = pay.STRIPE_API_KEY
                stripe.Refund.create(payment_intent=p["provider_payment_intent"])
        except Exception as ex:
            logger.error(f"refund failed {p['id']}: {ex}")
            raise HTTPException(502, f"Provider refund failed: {ex}")
        await db.payments.update_one({"id": p["id"]}, {"$set": {"status": "refunded", "refunded_at": now_iso()}})
        await db.ledger.insert_one({"id": new_id(), "type": "refund", "booking_id": booking_id, "vendor_id": b["vendor_id"],
                                    "amount": -p["amount"], "created_at": now_iso()})
    await _set_booking_status(b, "refunded", "admin", body.note if body else None)
    await audit(user, "booking.refund", booking_id)
    await notify(b["user_id"], "Refund processed", f"Refund for {b['code']} initiated to the original payment method.", f"/bookings/{booking_id}")
    return {"ok": True}


# ----------------------------- payments -----------------------------
async def _apply_coupon(code, amount, user_id, vendor_id, category_slug):
    c = await db.coupons.find_one({"code": code.upper(), "active": True}, {"_id": 0})
    if not c:
        raise HTTPException(400, "Invalid coupon")
    if c.get("expires_at") and c["expires_at"] < now_iso():
        raise HTTPException(400, "Coupon expired")
    if c.get("max_uses") and c.get("uses", 0) >= c["max_uses"]:
        raise HTTPException(400, "Coupon exhausted")
    if c.get("category_slug") and c["category_slug"] != category_slug:
        raise HTTPException(400, "Coupon not valid for this category")
    if c.get("min_amount") and amount < c["min_amount"]:
        raise HTTPException(400, f"Minimum amount ₹{c['min_amount']}")
    disc = amount * c["value"] / 100 if c["type"] == "percent" else c["value"]
    if c.get("max_discount"):
        disc = min(disc, c["max_discount"])
    return round(min(disc, amount), 2), c


async def _mark_paid(p, provider_ref: dict):
    """Idempotent: mark payment paid, update booking, ledger, notify."""
    r = await db.payments.update_one({"id": p["id"], "status": {"$ne": "paid"}},
                                     {"$set": {"status": "paid", "paid_at": now_iso(), **provider_ref}})
    if r.modified_count == 0:
        return
    b = await db.bookings.find_one({"id": p["booking_id"]}, {"_id": 0})
    paid = b["paid_amount"] + p["amount"] + p.get("discount", 0)
    upd = {"paid_amount": round(paid, 2), "updated_at": now_iso()}
    if b["status"] == "payment_pending":
        upd["status"] = "confirmed"
    if paid >= b["total"] - 0.01:
        upd["fully_paid"] = True
    await db.bookings.update_one({"id": b["id"]}, {"$set": upd, "$push": {"history": {"status": upd.get("status", b["status"]), "by": "payment", "note": f"{p['type']} ₹{p['amount']:,.0f} paid", "at": now_iso()}}})
    if upd.get("status") == "confirmed":
        await db.enquiries.update_one({"id": b["enquiry_id"]}, {"$set": {"status": "confirmed"}})
    if p.get("coupon_code"):
        await db.coupons.update_one({"code": p["coupon_code"]}, {"$inc": {"uses": 1}})
    await db.ledger.insert_one({"id": new_id(), "type": "payment", "booking_id": b["id"], "vendor_id": b["vendor_id"],
                                "payment_id": p["id"], "amount": p["amount"], "commission": p["commission"],
                                "vendor_amount": p["vendor_amount"], "payout_status": "pending", "created_at": now_iso()})
    await db.vendors.update_one({"id": b["vendor_id"]}, {"$inc": {"revenue": p["vendor_amount"]}})
    v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "user_id": 1})
    await notify(b["user_id"], "Payment successful", f"₹{p['amount']:,.0f} received. Booking {b['code']} is {upd.get('status', b['status'])}.", f"/bookings/{b['id']}", "payment")
    await notify(v.get("user_id"), "Payment received", f"{b['customer_name']} paid ₹{p['amount']:,.0f} for {b['code']}.", "/vendor/bookings", "payment")


@router.get("/payments/config")
async def payment_config():
    eff = await effective_payment()
    return {"provider": eff["provider"], "razorpay_key_id": eff["razorpay_key_id"],
            "payment_mode": eff["payment_mode"], "demo_enabled": eff["demo_enabled"],
            "checkout_available": eff["checkout_available"]}


@router.post("/payments/create")
async def create_payment(body: PaymentCreate, request: Request, user=Depends(get_current_user)):
    b, role = await _booking_access(body.booking_id, user)
    if role != "customer":
        raise HTTPException(403, "Only the customer can pay")
    if b["status"] not in ("payment_pending", "confirmed", "in_progress"):
        raise HTTPException(400, f"Booking is {b['status']}")
    due = round(b["total"] - b["paid_amount"], 2)
    if due <= 0:
        raise HTTPException(400, "Booking fully paid")
    amount = min(b["advance_amount"], due) if body.type == "advance" and b["paid_amount"] == 0 else due
    discount, coupon = 0, None
    if body.coupon_code:
        discount, coupon = await _apply_coupon(body.coupon_code, amount, user["id"], b["vendor_id"], b.get("category_slug"))
    charge = round(amount - discount, 2)
    if charge <= 0:
        raise HTTPException(400, "Nothing to charge")
    commission = round(amount * b["commission_percent"] / 100, 2)
    eff = await effective_payment()
    provider = eff["provider"]
    if provider == "none":
        raise HTTPException(503, "Online payment is temporarily unavailable")
    p = {"id": new_id(), "booking_id": b["id"], "booking_code": b["code"], "user_id": user["id"], "vendor_id": b["vendor_id"],
         "type": body.type if b["paid_amount"] == 0 else "balance", "amount": charge, "gross_amount": amount, "discount": discount,
         "coupon_code": coupon["code"] if coupon else None, "commission": commission, "vendor_amount": round(amount - commission, 2),
         "currency": "INR", "provider": provider, "rzp_mode": eff["rzp_mode"], "status": "created", "created_at": now_iso()}
    resp = {"payment_id": p["id"], "amount": charge, "provider": p["provider"]}
    if provider == "razorpay":
        order = pay.razorpay_create_order(charge, f"mmep_{p['id'][:8]}", {"booking": b["code"], "payment_id": p["id"]}, eff["rzp_mode"])
        p["provider_order_id"] = order["id"]
        resp.update({"razorpay": {"key": eff["razorpay_key_id"], "order_id": order["id"], "amount": order["amount"], "currency": "INR",
                                  "name": "MakeMyEventPro", "description": f"{b['vendor_name']} · {b['code']}",
                                  "prefill": {"name": user.get("name"), "contact": user.get("phone"), "email": user.get("email") or ""}}})
    elif provider == "stripe":
        origin = (body.origin_url or str(request.base_url)).rstrip("/")
        webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
        session = await pay.stripe_create_session(charge, f"{origin}/payment/success?payment_id={p['id']}&session_id={{CHECKOUT_SESSION_ID}}",
                                                  f"{origin}/bookings/{b['id']}", {"payment_id": p["id"], "booking_id": b["id"]}, webhook_url)
        p["provider_session_id"] = session.session_id
        resp["checkout_url"] = session.url
    await db.payments.insert_one({**p})
    return resp


@router.post("/payments/razorpay/verify")
async def razorpay_verify(body: RazorpayVerify, user=Depends(get_current_user)):
    p = await db.payments.find_one({"id": body.payment_id, "user_id": user["id"]}, {"_id": 0})
    if not p or p.get("provider_order_id") != body.razorpay_order_id:
        raise HTTPException(404, "Payment not found")
    if not pay.razorpay_verify_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature, p.get("rzp_mode", "test")):
        await db.payments.update_one({"id": p["id"]}, {"$set": {"status": "failed", "failed_reason": "signature"}})
        raise HTTPException(400, "Signature verification failed")
    await _mark_paid(p, {"provider_payment_id": body.razorpay_payment_id})
    return {"ok": True, "status": "paid"}


@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request):
    body = await request.body()
    if not pay.razorpay_verify_webhook(body, request.headers.get("X-Razorpay-Signature", "")):
        raise HTTPException(400, "Invalid signature")
    import json
    ev = json.loads(body)
    if ev.get("event") in ("payment.captured", "order.paid"):
        ent = ev["payload"]["payment"]["entity"]
        p = await db.payments.find_one({"provider_order_id": ent.get("order_id")}, {"_id": 0})
        if p:
            await _mark_paid(p, {"provider_payment_id": ent["id"]})
    return {"status": "ok"}


@router.get("/payments/status/{payment_id}")
async def payment_status(payment_id: str, request: Request, user=Depends(get_current_user)):
    p = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Payment not found")
    if p["user_id"] != user["id"] and user["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Forbidden")
    if p["status"] != "paid" and p["provider"] == "stripe" and p.get("provider_session_id"):
        try:
            st = await pay.stripe_status(p["provider_session_id"], f"{str(request.base_url).rstrip('/')}/api/webhook/stripe")
            if st.payment_status == "paid":
                await _mark_paid(p, {"provider_payment_intent": getattr(st, "payment_intent_id", None)})
                p = await db.payments.find_one({"id": payment_id}, {"_id": 0})
        except Exception as ex:
            logger.warning(f"stripe status check failed: {ex}")
    return {"payment_id": p["id"], "status": p["status"], "amount": p["amount"], "booking_id": p["booking_id"]}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    try:
        ev = await pay.stripe_webhook(body, request.headers.get("Stripe-Signature", ""), f"{str(request.base_url).rstrip('/')}/api/webhook/stripe")
    except Exception as ex:
        raise HTTPException(400, f"Webhook error: {ex}")
    if ev.payment_status == "paid" and ev.session_id:
        p = await db.payments.find_one({"provider_session_id": ev.session_id}, {"_id": 0})
        if p:
            await _mark_paid(p, {})
    return {"status": "ok"}


@router.post("/payments/{payment_id}/demo-confirm")
async def demo_confirm(payment_id: str, user=Depends(get_current_user)):
    """Simulates a successful gateway callback for the Demo payment mode."""
    eff = await effective_payment()
    if not eff["demo_enabled"]:
        raise HTTPException(404, "Not found")
    p = await db.payments.find_one({"id": payment_id, "user_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Payment not found")
    await _mark_paid(p, {"provider_payment_id": f"demo_{payment_id[:8]}"})
    return {"ok": True, "status": "paid"}


@router.get("/coupons/validate")
async def validate_coupon(code: str, amount: float, category: Optional[str] = None, user=Depends(get_current_user)):
    disc, c = await _apply_coupon(code, amount, user["id"], None, category)
    return {"valid": True, "discount": disc, "coupon": {"code": c["code"], "type": c["type"], "value": c["value"], "title": c.get("title")}}


# ----------------------------- reviews -----------------------------
@router.post("/reviews")
async def create_review(body: ReviewIn, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": body.booking_id, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b["status"] != "completed":
        raise HTTPException(400, "You can review after the event is completed")
    if await db.reviews.find_one({"booking_id": body.booking_id}):
        raise HTTPException(409, "Already reviewed")
    doc = {"id": new_id(), "vendor_id": b["vendor_id"], "user_id": user["id"], "booking_id": b["id"], "name": user.get("name"),
           "rating": body.rating, "quality": body.quality or body.rating, "service": body.service or body.rating,
           "value": body.value or body.rating, "text": body.text[:2000], "photos": body.photos[:6], "status": "pending",
           "response": None, "verified_booking": True, "created_at": now_iso()}
    await db.reviews.insert_one({**doc})
    v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "user_id": 1})
    await notify(v.get("user_id"), "New review", f"{user.get('name')} rated you {body.rating}★ (pending moderation).", "/vendor")
    return clean(doc)


async def recompute_rating(vendor_id: str):
    revs = await db.reviews.find({"vendor_id": vendor_id, "status": "approved"}, {"_id": 0, "rating": 1}).to_list(5000)
    rating = round(sum(r["rating"] for r in revs) / len(revs), 1) if revs else 0
    await db.vendors.update_one({"id": vendor_id}, {"$set": {"rating": rating, "review_count": len(revs)}})


@router.post("/reviews/{review_id}/respond")
async def respond_review(review_id: str, body: ReviewResponse, user=Depends(require_roles(*VENDOR_ROLES))):
    v = await get_vendor_for_user(user)
    r = await db.reviews.update_one({"id": review_id, "vendor_id": v["id"]}, {"$set": {"response": body.response[:1000], "responded_at": now_iso()}})
    if r.matched_count == 0:
        raise HTTPException(404, "Review not found")
    return {"ok": True}


@router.get("/vendor/reviews")
async def vendor_reviews(user=Depends(require_roles(*VENDOR_ROLES))):
    v = await get_vendor_for_user(user)
    return await db.reviews.find({"vendor_id": v["id"]}, {"_id": 0}).sort("created_at", -1).to_list(300)
