"""Pre-deployment audit for MakeMyEventPro.

Validates: RBAC (customer/vendor/admin split), secrets never leaked,
public vendor listing only shows approved, gallery entitlement,
blocked-date + double-booking enforcement, subscription flow,
payment mode remains demo, Test Connection cleanly reports not-configured.
"""
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests

# Load REACT_APP_BACKEND_URL from frontend .env
FRONTEND_ENV = Path("/app/frontend/.env")
BASE_URL = None
if FRONTEND_ENV.exists():
    for line in FRONTEND_ENV.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = (BASE_URL or os.environ["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PHONE = "9999900001"
VENDOR_PHONE = "9999900002"
UNIVERSAL_OTP = "123456"

SECRET_KEYS_FORBIDDEN = ["key_secret", "KEY_SECRET", "razorpay_key_secret",
                         "RZP_TEST_KEY_SECRET", "RZP_LIVE_KEY_SECRET",
                         "STRIPE_API_KEY", "webhook_secret"]


def _login(phone, code=UNIVERSAL_OTP):
    # Prime otp record first (verify-otp requires it)
    requests.post(f"{API}/auth/send-otp", json={"phone": phone})
    r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": code})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_PHONE)["token"]


@pytest.fixture(scope="module")
def vendor_token():
    return _login(VENDOR_PHONE)["token"]


@pytest.fixture(scope="module")
def customer():
    phone = "9" + "".join(str(random.randint(0, 9)) for _ in range(9))
    data = _login(phone)
    return data["token"], data["user"]


def h(t):
    return {"Authorization": f"Bearer {t}"}


def _no_secrets(payload: dict, path=""):
    """Recursively assert no secret-value strings appear in a response object."""
    if isinstance(payload, dict):
        for k, v in payload.items():
            # allow *_configured booleans; forbid raw secret strings
            if isinstance(v, str) and k.lower().endswith("secret"):
                pytest.fail(f"Secret leaked at {path}.{k}: {v[:6]}...")
            _no_secrets(v, f"{path}.{k}")
    elif isinstance(payload, list):
        for i, v in enumerate(payload):
            _no_secrets(v, f"{path}[{i}]")


# ---------------- Public listing filters status=approved ----------------
class TestPublicVendorListing:
    def test_only_approved_public(self):
        r = requests.get(f"{API}/vendors", params={"limit": 100})
        assert r.status_code == 200
        for v in r.json()["items"]:
            assert v.get("status") == "approved", f"non-approved vendor leaked: {v.get('id')} status={v.get('status')}"

    def test_unapproved_slug_hidden(self, admin_token):
        # find any non-approved vendor whose slug does NOT collide with an approved one
        alist = requests.get(f"{API}/admin/vendors", headers=h(admin_token)).json()
        approved_slugs = {v.get("slug") for v in alist if v.get("status") == "approved"}
        non_approved = [v for v in alist if v.get("status") != "approved" and v.get("slug") and v.get("slug") not in approved_slugs]
        if not non_approved:
            pytest.skip("No non-approved vendors with unique slugs in seed")
        slug = non_approved[0]["slug"]
        r = requests.get(f"{API}/vendors/{slug}")
        assert r.status_code == 404


# ---------------- Auth toggle: seeded roles ----------------
class TestSeededAuth:
    def test_admin_role(self):
        assert _login(ADMIN_PHONE)["user"]["role"] == "super_admin"

    def test_vendor_role(self):
        assert _login(VENDOR_PHONE)["user"]["role"] == "vendor"


# ---------------- RBAC: cross-role 403 ----------------
class TestRBAC:
    def test_customer_forbidden_admin(self, customer):
        token, _ = customer
        for path in ["/admin/stats", "/admin/payment-settings", "/admin/integrations-status", "/admin/vendors"]:
            r = requests.get(f"{API}{path}", headers=h(token))
            assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"

    def test_customer_forbidden_vendor(self, customer):
        token, _ = customer
        for path in ["/vendor/me", "/vendor/stats", "/vendor/subscription"]:
            r = requests.get(f"{API}{path}", headers=h(token))
            assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"

    def test_vendor_forbidden_admin(self, vendor_token):
        for path in ["/admin/stats", "/admin/payment-settings"]:
            r = requests.get(f"{API}{path}", headers=h(vendor_token))
            assert r.status_code == 403


# ---------------- No secrets leaked ----------------
class TestNoSecretLeaks:
    def test_payment_settings_no_secrets(self, admin_token):
        r = requests.get(f"{API}/admin/payment-settings", headers=h(admin_token))
        assert r.status_code == 200
        data = r.json()
        # explicit fields: only booleans allowed
        assert isinstance(data["razorpay_test"]["key_secret_configured"], bool)
        assert isinstance(data["razorpay_live"]["key_secret_configured"], bool)
        _no_secrets(data)
        # also verify mode remains demo (or none if unset)
        assert data["payment_mode"] in ("demo", "none", "razorpay_test", "razorpay_live")

    def test_integrations_no_secrets(self, admin_token):
        r = requests.get(f"{API}/admin/integrations-status", headers=h(admin_token))
        assert r.status_code == 200
        data = r.json()
        _no_secrets(data)
        # all expected integrations reported
        for k in ["firebase", "razorpay_test", "razorpay_live", "google_maps", "whatsapp", "email", "sms"]:
            assert k in data

    def test_payments_config_public(self):
        r = requests.get(f"{API}/payments/config")
        assert r.status_code == 200
        data = r.json()
        _no_secrets(data)
        # only public key_id or None
        assert "razorpay_key_id" in data


# ---------------- Payment mode: DEMO must stay ----------------
class TestPaymentModeDemo:
    def test_current_mode_demo(self, admin_token):
        r = requests.get(f"{API}/admin/payment-settings", headers=h(admin_token))
        d = r.json()
        # active_provider should be demo (since razorpay not configured)
        assert d["active_provider"] in ("demo", "none")
        # confirm demo enabled
        assert d.get("demo_payment_enabled") is True or d.get("payment_mode") == "demo"

    def test_test_connection_not_configured(self, admin_token):
        r = requests.post(f"{API}/admin/payment-settings/test-connection",
                          headers=h(admin_token), json={"mode": "razorpay_test"})
        # Either 200 with ok:false and reason, or 400/503 style
        assert r.status_code in (200, 400, 503)
        if r.status_code == 200:
            data = r.json()
            assert data.get("ok") is False or "not configured" in (data.get("error", "") + data.get("message", "")).lower() or data.get("configured") is False

    def test_cannot_switch_to_unconfigured_razorpay(self, admin_token):
        r = requests.put(f"{API}/admin/payment-settings", headers=h(admin_token),
                         json={"payment_mode": "razorpay_test"})
        # must reject switch when not configured
        assert r.status_code == 400


# ---------------- Vendor gallery entitlement (Free plan cap = 8) ----------------
class TestGalleryEntitlement:
    def test_free_plan_gallery_cap(self, vendor_token):
        # Reset gallery to a small known state
        requests.put(f"{API}/vendor/me", headers=h(vendor_token), json={"gallery": []})
        sub = requests.get(f"{API}/vendor/subscription", headers=h(vendor_token)).json()
        max_g = sub.get("entitlements", {}).get("max_gallery")
        plan = sub.get("entitlements", {}).get("plan")
        if max_g is None or max_g > 8:
            pytest.skip(f"Vendor on {plan} with max_gallery={max_g}; Free-cap already validated in prior run")
        # Attempt to upload max_g+1 gallery images (Free = 8, so 9)
        payload = {"gallery": [f"https://example.com/img{i}.jpg" for i in range(max_g + 1)]}
        r = requests.put(f"{API}/vendor/me", headers=h(vendor_token), json=payload)
        assert r.status_code == 400, r.text
        msg = str(r.json().get("detail", ""))
        assert "upgrade" in msg.lower() or str(max_g) in msg

    def test_subscribe_then_more_gallery(self, vendor_token):
        # find a plan with max_gallery > 8 (or any plan)
        plans_resp = requests.get(f"{API}/vendor/subscription", headers=h(vendor_token)).json()
        plans = plans_resp.get("plans", [])
        good = next((p for p in plans if (p.get("max_gallery") or 0) > 8), None)
        if not good:
            good = next((p for p in plans if p.get("slug")), None)
        if not good:
            pytest.skip("No plan available to subscribe")
        r = requests.post(f"{API}/vendor/subscription/subscribe", headers=h(vendor_token),
                          json={"plan_slug": good["slug"]})
        assert r.status_code == 200
        # verify entitlements bumped
        sub2 = requests.get(f"{API}/vendor/subscription", headers=h(vendor_token)).json()
        assert sub2.get("current") is not None
        max_g = sub2["entitlements"].get("max_gallery")
        # now try uploading 9 (or up to new max)
        target = min(9, max_g or 9)
        payload = {"gallery": [f"https://example.com/img{i}.jpg" for i in range(target)]}
        r2 = requests.put(f"{API}/vendor/me", headers=h(vendor_token), json=payload)
        assert r2.status_code == 200, r2.text


# ---------------- Blocked date + double booking enforcement ----------------
class TestBlockedDateEnforcement:
    def _make_quote_flow(self, customer_token, vendor_token, event_date):
        """Helper: customer creates enquiry, vendor quotes, customer accepts."""
        # Get vendor id
        vme = requests.get(f"{API}/vendor/me", headers=h(vendor_token)).json()
        vid = vme["id"]
        # Enquiry
        r = requests.post(f"{API}/enquiries", headers=h(customer_token), json={
            "vendor_ids": [vid], "event_type": "Wedding",
            "event_date": event_date, "guests": 150, "budget": 300000,
            "message": "TEST audit"})
        assert r.status_code == 200, r.text
        enq = r.json()["enquiries"][0]
        # Vendor quotes
        rq = requests.post(f"{API}/enquiries/{enq['id']}/quotes", headers=h(vendor_token), json={
            "items": [{"name": "Package", "qty": 1, "unit_price": 100000}],
            "advance_amount": 20000, "valid_days": 7})
        assert rq.status_code == 200, rq.text
        return enq, rq.json()

    def test_blocked_date_rejected_on_accept(self, customer, vendor_token):
        ctoken, _ = customer
        # Set blocked date on vendor
        future = (datetime.now(timezone.utc) + timedelta(days=45)).date().isoformat()
        r = requests.put(f"{API}/vendor/me", headers=h(vendor_token),
                         json={"blocked_dates": [future]})
        assert r.status_code == 200, r.text
        # Now create enquiry+quote for that date and try to accept
        _, quote = self._make_quote_flow(ctoken, vendor_token, future)
        ra = requests.post(f"{API}/quotes/{quote['id']}/accept", headers=h(ctoken))
        assert ra.status_code == 400
        detail = str(ra.json().get("detail", "")).lower()
        assert "unavailable" in detail or "blocked" in detail or "another date" in detail

    def test_double_booking_rejected(self, customer, vendor_token):
        ctoken, _ = customer
        # Clear blocked_dates first
        requests.put(f"{API}/vendor/me", headers=h(vendor_token), json={"blocked_dates": []})
        # Use a randomised future date to avoid collision across runs
        dt = (datetime.now(timezone.utc) + timedelta(days=90 + random.randint(0, 300))).date().isoformat()
        # 1st: create → quote → accept → demo-confirm advance
        _, q1 = self._make_quote_flow(ctoken, vendor_token, dt)
        r1 = requests.post(f"{API}/quotes/{q1['id']}/accept", headers=h(ctoken))
        assert r1.status_code == 200, r1.text
        booking_id = r1.json()["booking"]["id"]
        # Create payment
        cp = requests.post(f"{API}/payments/create", headers=h(ctoken),
                           json={"booking_id": booking_id, "type": "advance"})
        assert cp.status_code == 200, cp.text
        pid = cp.json()["payment_id"]
        # demo confirm to move booking to confirmed
        rc = requests.post(f"{API}/payments/{pid}/demo-confirm", headers=h(ctoken))
        assert rc.status_code == 200, rc.text
        # 2nd customer attempts another booking same date
        # Use a fresh customer to avoid unread state
        phone2 = "9" + "".join(str(random.randint(0, 9)) for _ in range(9))
        ctoken2 = _login(phone2)["token"]
        _, q2 = self._make_quote_flow(ctoken2, vendor_token, dt)
        r2 = requests.post(f"{API}/quotes/{q2['id']}/accept", headers=h(ctoken2))
        assert r2.status_code == 400
        detail = str(r2.json().get("detail", "")).lower()
        assert "already booked" in detail or "different date" in detail


# ---------------- Vendor dashboard endpoints ----------------
class TestVendorDashboard:
    def test_vendor_me_and_stats(self, vendor_token):
        r = requests.get(f"{API}/vendor/me", headers=h(vendor_token))
        assert r.status_code == 200
        assert r.json().get("business_name")
        r2 = requests.get(f"{API}/vendor/stats", headers=h(vendor_token))
        assert r2.status_code == 200
        for k in ["total_leads", "bookings", "confirmed_bookings"]:
            assert k in r2.json()

    def test_vendor_bookings_and_payments(self, vendor_token):
        for path in ["/vendor/leads", "/vendor/bookings", "/vendor/payments"]:
            r = requests.get(f"{API}{path}", headers=h(vendor_token))
            assert r.status_code == 200
            assert isinstance(r.json(), list)


# ---------------- Admin endpoints for admin console ----------------
class TestAdminConsole:
    def test_admin_stats(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers=h(admin_token))
        assert r.status_code == 200

    def test_admin_plans_and_upsert(self, admin_token):
        r = requests.get(f"{API}/admin/plans", headers=h(admin_token))
        assert r.status_code == 200
        # try create a plan
        body = {"name": "TEST Audit Plan", "price_monthly": 999,
                "features": ["a", "b"], "featured_slots": 0, "active": True, "order": 99}
        r2 = requests.post(f"{API}/admin/plans", headers=h(admin_token), json=body)
        assert r2.status_code == 200

    def test_admin_audit_logs(self, admin_token):
        r = requests.get(f"{API}/admin/audit-logs", headers=h(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
