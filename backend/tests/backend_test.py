"""Backend integration tests for MakeMyEventPro Phase 1 (mocked OTP)."""
import os
import random
import time
import pytest
import requests
from pathlib import Path

# Load REACT_APP_BACKEND_URL from frontend .env
FRONTEND_ENV = Path("/app/frontend/.env")
BASE_URL = None
if FRONTEND_ENV.exists():
    for line in FRONTEND_ENV.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip()
if not BASE_URL:
    BASE_URL = os.environ["REACT_APP_BACKEND_URL"]
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PHONE = "9999900001"
VENDOR_PHONE = "9999900002"
UNIVERSAL_OTP = "123456"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, phone, code=UNIVERSAL_OTP):
    r = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": code})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def admin_token(session):
    return _login(session, ADMIN_PHONE)["token"]


@pytest.fixture(scope="session")
def vendor_token(session):
    return _login(session, VENDOR_PHONE)["token"]


@pytest.fixture(scope="session")
def customer_token(session):
    # random 10-digit phone
    phone = "9" + "".join(str(random.randint(0, 9)) for _ in range(9))
    return _login(session, phone)["token"], phone


# ---------------- Auth ----------------
class TestAuth:
    def test_send_otp_valid(self, session):
        r = session.post(f"{API}/auth/send-otp", json={"phone": "9000000001"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("sent") is True
        assert "demo_otp" in data and len(data["demo_otp"]) == 6

    def test_send_otp_invalid_phone(self, session):
        r = session.post(f"{API}/auth/send-otp", json={"phone": "abc"})
        assert r.status_code == 400

    def test_send_otp_rate_limit(self, session):
        phone = "9" + "".join(str(random.randint(0, 9)) for _ in range(9))
        codes = []
        for _ in range(5):
            r = session.post(f"{API}/auth/send-otp", json={"phone": phone})
            assert r.status_code == 200
            codes.append(r.json()["demo_otp"])
        # 6th within 10 min should be 429
        r = session.post(f"{API}/auth/send-otp", json={"phone": phone})
        assert r.status_code == 429

    def test_verify_with_demo_otp(self, session):
        phone = "9" + "".join(str(random.randint(0, 9)) for _ in range(9))
        r = session.post(f"{API}/auth/send-otp", json={"phone": phone})
        demo = r.json()["demo_otp"]
        r2 = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": demo})
        assert r2.status_code == 200
        data = r2.json()
        assert "token" in data and "user" in data
        assert data["user"]["role"] == "customer"

    def test_verify_with_universal_code(self, session):
        phone = "9" + "".join(str(random.randint(0, 9)) for _ in range(9))
        r = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": UNIVERSAL_OTP})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "customer"

    def test_verify_incorrect_code(self, session):
        phone = "9" + "".join(str(random.randint(0, 9)) for _ in range(9))
        session.post(f"{API}/auth/send-otp", json={"phone": phone})
        r = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": "000000"})
        assert r.status_code == 400

    def test_seeded_admin_role(self, session):
        data = _login(session, ADMIN_PHONE)
        assert data["user"]["role"] == "super_admin"

    def test_seeded_vendor_role(self, session):
        data = _login(session, VENDOR_PHONE)
        assert data["user"]["role"] == "vendor"

    def test_me_requires_token(self, session):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, session, admin_token):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert r.json()["role"] == "super_admin"


# ---------------- Public marketplace ----------------
class TestMarketplace:
    def test_categories(self):
        r = requests.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 10
        assert all("theme" in c and isinstance(c["theme"], dict) for c in cats)

    def test_event_types(self):
        r = requests.get(f"{API}/event-types")
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_cities_hyderabad(self):
        r = requests.get(f"{API}/cities")
        assert r.status_code == 200
        cities = r.json()
        hyd = next((c for c in cities if c["name"] == "Hyderabad"), None)
        assert hyd is not None
        assert "areas" in hyd and len(hyd["areas"]) > 0

    def test_banners_hyderabad(self):
        r = requests.get(f"{API}/banners", params={"city": "Hyderabad"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_vendors_list(self):
        r = requests.get(f"{API}/vendors")
        assert r.status_code == 200
        data = r.json()
        assert set(["total", "page", "limit", "items"]).issubset(data.keys())
        assert data["total"] >= 10

    def test_vendors_filter_verified(self):
        r = requests.get(f"{API}/vendors", params={"verified": "true"})
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item.get("verified") is True

    def test_vendors_search(self):
        r = requests.get(f"{API}/vendors", params={"q": "Grand"})
        assert r.status_code == 200
        assert r.json()["total"] >= 0

    def test_vendors_sort_price_low(self):
        r = requests.get(f"{API}/vendors", params={"sort": "price_low", "limit": 50})
        assert r.status_code == 200
        prices = [i.get("starting_price", 0) for i in r.json()["items"]]
        assert prices == sorted(prices)

    def test_vendor_detail_known_slug(self):
        r = requests.get(f"{API}/vendors/vendor-hub-787")
        # this slug may or may not exist depending on seed
        if r.status_code == 404:
            pytest.skip("vendor-hub-787 slug not seeded; test unknown 404 instead")
        assert r.status_code == 200
        d = r.json()
        assert set(["vendor", "reviews", "similar"]).issubset(d.keys())

    def test_vendor_detail_unknown(self):
        r = requests.get(f"{API}/vendors/does-not-exist-xyz")
        assert r.status_code == 404


# ---------------- Customer flows ----------------
class TestCustomer:
    def test_favorites_toggle(self, customer_token):
        token, _ = customer_token
        h = {"Authorization": f"Bearer {token}"}
        v = requests.get(f"{API}/vendors").json()["items"][0]
        vid = v["id"]
        r1 = requests.post(f"{API}/favorites/toggle", json={"vendor_id": vid}, headers=h)
        assert r1.status_code == 200
        assert r1.json()["favorited"] is True
        r2 = requests.get(f"{API}/favorites", headers=h)
        assert r2.status_code == 200
        assert vid in r2.json()["vendor_ids"]
        r3 = requests.post(f"{API}/favorites/toggle", json={"vendor_id": vid}, headers=h)
        assert r3.json()["favorited"] is False

    def test_favorites_requires_auth(self):
        r = requests.get(f"{API}/favorites")
        assert r.status_code == 401

    def test_enquiries_create_and_list(self, customer_token):
        token, _ = customer_token
        h = {"Authorization": f"Bearer {token}"}
        v = requests.get(f"{API}/vendors").json()["items"][0]
        r = requests.post(f"{API}/enquiries", json={
            "vendor_ids": [v["id"]], "event_type": "Wedding",
            "event_date": "2026-03-01", "guests": 200, "budget": 500000,
            "message": "TEST enquiry"
        }, headers=h)
        assert r.status_code == 200
        assert r.json()["created"] == 1
        r2 = requests.get(f"{API}/enquiries", headers=h)
        assert r2.status_code == 200
        assert len(r2.json()) >= 1
        # notification created
        r3 = requests.get(f"{API}/notifications", headers=h)
        assert r3.status_code == 200
        assert len(r3.json()) >= 1

    def test_event_create_and_checklist(self, customer_token):
        token, _ = customer_token
        h = {"Authorization": f"Bearer {token}"}
        r = requests.post(f"{API}/events", json={
            "title": "TEST My Wedding", "event_type": "Wedding",
            "date": "2026-06-01", "guests": 300, "budget": 1000000
        }, headers=h)
        assert r.status_code == 200
        ev = r.json()
        assert len(ev["checklist"]) == 10
        # update checklist -> mark first completed with allocation
        cl = ev["checklist"]
        cl[0]["status"] = "completed"
        cl[0]["allocated"] = 250000
        cl[1]["status"] = "completed"
        cl[1]["allocated"] = 100000
        r2 = requests.put(f"{API}/events/{ev['id']}/checklist", json={"checklist": cl}, headers=h)
        assert r2.status_code == 200
        assert r2.json()["spent"] == 350000
        r3 = requests.get(f"{API}/events", headers=h)
        assert r3.status_code == 200
        assert any(e["id"] == ev["id"] for e in r3.json())


# ---------------- Vendor RBAC ----------------
class TestVendorRBAC:
    def test_vendor_me(self, vendor_token):
        r = requests.get(f"{API}/vendor/me", headers={"Authorization": f"Bearer {vendor_token}"})
        assert r.status_code == 200
        assert "business_name" in r.json()

    def test_vendor_stats(self, vendor_token):
        r = requests.get(f"{API}/vendor/stats", headers={"Authorization": f"Bearer {vendor_token}"})
        assert r.status_code == 200
        for k in ["total_leads", "new_leads", "profile_completion"]:
            assert k in r.json()

    def test_vendor_leads(self, vendor_token):
        r = requests.get(f"{API}/vendor/leads", headers={"Authorization": f"Bearer {vendor_token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_customer_forbidden_vendor_routes(self, customer_token):
        token, _ = customer_token
        h = {"Authorization": f"Bearer {token}"}
        for path in ["/vendor/me", "/vendor/stats", "/vendor/leads"]:
            r = requests.get(f"{API}{path}", headers=h)
            assert r.status_code == 403, f"{path} expected 403, got {r.status_code}"


# ---------------- Admin RBAC ----------------
class TestAdminRBAC:
    def test_admin_stats(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert r.json()["categories"] == 10

    def test_admin_vendors_list(self, admin_token):
        r = requests.get(f"{API}/admin/vendors", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_customer_forbidden_admin_routes(self, customer_token):
        token, _ = customer_token
        h = {"Authorization": f"Bearer {token}"}
        for path in ["/admin/stats", "/admin/vendors"]:
            r = requests.get(f"{API}{path}", headers=h)
            assert r.status_code == 403

    def test_admin_approve_pending_vendor(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{API}/admin/vendors", params={"status": "submitted"}, headers=h)
        assert r.status_code == 200
        pending = r.json()
        if not pending:
            pytest.skip("No pending vendor to approve (already approved from previous run)")
        vid = pending[0]["id"]
        r2 = requests.post(f"{API}/admin/vendors/{vid}/approve", headers=h)
        assert r2.status_code == 200
        # verify
        r3 = requests.get(f"{API}/admin/vendors", headers=h)
        v = next(x for x in r3.json() if x["id"] == vid)
        assert v["status"] == "approved" and v["verified"] is True

    def test_admin_feature_unfeature(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        vlist = requests.get(f"{API}/admin/vendors", headers=h).json()
        vid = vlist[0]["id"]
        r = requests.post(f"{API}/admin/vendors/{vid}/feature", headers=h)
        assert r.status_code == 200
        r2 = requests.post(f"{API}/admin/vendors/{vid}/unfeature", headers=h)
        assert r2.status_code == 200
