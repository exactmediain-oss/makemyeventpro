"""Payment provider adapter: razorpay | stripe | none (env PAYMENT_PROVIDER). Keys only from env."""
import os
import hmac
import hashlib
from fastapi import HTTPException
from core import logger

PAYMENT_PROVIDER = os.environ.get("PAYMENT_PROVIDER", "razorpay")
RZP_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RZP_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RZP_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")


def razorpay_configured():
    return bool(RZP_KEY_ID and RZP_KEY_SECRET and not RZP_KEY_ID.startswith("rzp_placeholder"))


def stripe_configured():
    return bool(STRIPE_API_KEY)


def active_provider():
    if PAYMENT_PROVIDER == "razorpay" and razorpay_configured():
        return "razorpay"
    if PAYMENT_PROVIDER == "stripe" and stripe_configured():
        return "stripe"
    if razorpay_configured():
        return "razorpay"
    if stripe_configured():
        return "stripe"
    return "none"


def public_config():
    return {"provider": active_provider(), "razorpay_key_id": RZP_KEY_ID if razorpay_configured() else None,
            "razorpay_configured": razorpay_configured(), "stripe_configured": stripe_configured()}


def _rzp_client():
    import razorpay
    return razorpay.Client(auth=(RZP_KEY_ID, RZP_KEY_SECRET))


def razorpay_create_order(amount_inr: float, receipt: str, notes: dict):
    if not razorpay_configured():
        raise HTTPException(503, "Razorpay keys not configured")
    order = _rzp_client().order.create({"amount": int(round(amount_inr * 100)), "currency": "INR",
                                        "receipt": receipt[:40], "payment_capture": 1, "notes": notes})
    return order


def razorpay_verify_signature(order_id: str, payment_id: str, signature: str):
    msg = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(RZP_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def razorpay_verify_webhook(body: bytes, signature: str):
    if not RZP_WEBHOOK_SECRET:
        return False
    expected = hmac.new(RZP_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def razorpay_refund(payment_id: str, amount_inr: float):
    return _rzp_client().payment.refund(payment_id, {"amount": int(round(amount_inr * 100))})


async def stripe_create_session(amount_inr: float, success_url: str, cancel_url: str, metadata: dict, webhook_url: str):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    req = CheckoutSessionRequest(amount=float(amount_inr), currency="inr", success_url=success_url,
                                 cancel_url=cancel_url, metadata={k: str(v) for k, v in metadata.items()})
    return await sc.create_checkout_session(req)


async def stripe_status(session_id: str, webhook_url: str):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    return await sc.get_checkout_status(session_id)


async def stripe_webhook(body: bytes, signature: str, webhook_url: str):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    return await sc.handle_webhook(body, signature)
