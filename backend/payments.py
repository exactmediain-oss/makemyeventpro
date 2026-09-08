"""Payment provider adapter: razorpay (test/live) | stripe | demo.
Keys are read only from env and never returned to clients. Razorpay key_id is a public
identifier (safe for the browser checkout); the key SECRET stays server-side only."""
import os
import hmac
import hashlib
from fastapi import HTTPException
from core import logger

PAYMENT_PROVIDER = os.environ.get("PAYMENT_PROVIDER", "razorpay")

# Legacy single key pair (kept for backward compatibility / env fallback)
RZP_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RZP_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RZP_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")

# Test / Live key pairs (server-side only, never sent to the frontend)
RZP_TEST_KEY_ID = os.environ.get("RAZORPAY_TEST_KEY_ID", "")
RZP_TEST_KEY_SECRET = os.environ.get("RAZORPAY_TEST_KEY_SECRET", "")
RZP_LIVE_KEY_ID = os.environ.get("RAZORPAY_LIVE_KEY_ID", "")
RZP_LIVE_KEY_SECRET = os.environ.get("RAZORPAY_LIVE_KEY_SECRET", "")

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")


def razorpay_test_configured():
    return bool(RZP_TEST_KEY_ID and RZP_TEST_KEY_SECRET)


def razorpay_live_configured():
    return bool(RZP_LIVE_KEY_ID and RZP_LIVE_KEY_SECRET)


def razorpay_configured():
    """Legacy single-pair check, used only by the env-fallback path."""
    return bool(RZP_KEY_ID and RZP_KEY_SECRET and not RZP_KEY_ID.startswith("rzp_placeholder"))


def keys_for_mode(rzp_mode):
    """Return (key_id, key_secret) for 'test' or 'live'. Never expose the secret to clients."""
    if rzp_mode == "live":
        return RZP_LIVE_KEY_ID, RZP_LIVE_KEY_SECRET
    if rzp_mode == "test":
        return RZP_TEST_KEY_ID, RZP_TEST_KEY_SECRET
    return RZP_KEY_ID, RZP_KEY_SECRET


def public_key_id(rzp_mode):
    """Razorpay key_id is a public identifier (safe for browser checkout). Secret is never returned."""
    return keys_for_mode(rzp_mode)[0] or None


def stripe_configured():
    return bool(STRIPE_API_KEY)


def active_provider():
    """Legacy env-only resolver, used when no explicit payment_mode is stored yet."""
    if PAYMENT_PROVIDER == "razorpay" and razorpay_configured():
        return "razorpay"
    if PAYMENT_PROVIDER == "stripe" and stripe_configured():
        return "stripe"
    if razorpay_configured():
        return "razorpay"
    if stripe_configured():
        return "stripe"
    return "none"


def _rzp_client(rzp_mode):
    import razorpay
    kid, ksec = keys_for_mode(rzp_mode)
    return razorpay.Client(auth=(kid, ksec))


def razorpay_create_order(amount_inr: float, receipt: str, notes: dict, rzp_mode: str = "test"):
    kid, ksec = keys_for_mode(rzp_mode)
    if not (kid and ksec):
        raise HTTPException(503, "Razorpay keys not configured")
    order = _rzp_client(rzp_mode).order.create({"amount": int(round(amount_inr * 100)), "currency": "INR",
                                                 "receipt": receipt[:40], "payment_capture": 1, "notes": notes})
    return order


def razorpay_verify_signature(order_id: str, payment_id: str, signature: str, rzp_mode: str = "test"):
    _, ksec = keys_for_mode(rzp_mode)
    msg = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(ksec.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def razorpay_verify_webhook(body: bytes, signature: str):
    if not RZP_WEBHOOK_SECRET:
        return False
    expected = hmac.new(RZP_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def razorpay_refund(payment_id: str, amount_inr: float, rzp_mode: str = "test"):
    return _rzp_client(rzp_mode).payment.refund(payment_id, {"amount": int(round(amount_inr * 100))})


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
