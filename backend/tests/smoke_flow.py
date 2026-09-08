"""Quick e2e smoke: customer enquiry -> vendor quote -> accept -> demo pay -> complete -> review -> admin moderation."""
import requests, sys, os
API = os.environ.get("API", "http://localhost:8001/api")

def login(phone):
    requests.post(f"{API}/auth/send-otp", json={"phone": phone})
    r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": "123456", "name": "Smoke Customer"})
    r.raise_for_status(); return {"Authorization": f"Bearer {r.json()['token']}"}

cust, vend, adm = login("9888800001"), login("9999900002"), login("9999900001")
v = requests.get(f"{API}/vendors/falaknuma-grand-convention").json()["vendor"]
e = requests.post(f"{API}/enquiries", headers=cust, json={"vendor_ids": [v["id"]], "event_type": "Wedding", "event_date": "2026-12-12", "guests": 500, "message": "Need hall", "package_id": v["packages"][0]["id"]}).json()["enquiries"][0]
print("enquiry", e["status"])
requests.post(f"{API}/enquiries/{e['id']}/messages", headers=vend, json={"text": "Hi, sharing quote"}).raise_for_status()
q = requests.post(f"{API}/enquiries/{e['id']}/quotes", headers=vend, json={"items": [{"name": "Hall", "qty": 1, "unit_price": 100000}, {"name": "Decor", "qty": 2, "unit_price": 10000}], "discount": 5000, "tax_percent": 18, "advance_amount": 30000, "terms": "50% refund", "valid_days": 7})
print("quote", q.status_code, q.json().get("total"))
acc = requests.post(f"{API}/quotes/{q.json()['id']}/accept", headers=cust).json()
b = acc["booking"]; print("booking", b["status"], b["code"])
p = requests.post(f"{API}/payments/create", headers=cust, json={"booking_id": b["id"], "type": "advance", "coupon_code": "WELCOME10"}).json()
print("payment", p)
print("demo-confirm", requests.post(f"{API}/payments/{p['payment_id']}/demo-confirm", headers=cust).json())
print("status->", requests.get(f"{API}/bookings/{b['id']}", headers=cust).json()["booking"]["status"])
for s in ("in_progress", "completed"):
    print(s, requests.post(f"{API}/bookings/{b['id']}/status", headers=vend, json={"status": s}).json())
rv = requests.post(f"{API}/reviews", headers=cust, json={"booking_id": b["id"], "rating": 5, "text": "Great!"}); print("review", rv.status_code)
print("moderate", requests.post(f"{API}/admin/reviews/{rv.json()['id']}/approve", headers=adm).json())
print("invoice due", requests.get(f"{API}/bookings/{b['id']}/invoice", headers=cust).json()["due"])
print("ledger vendors", len(requests.get(f"{API}/admin/ledger", headers=adm).json()["vendors"]))
print("forbidden check", requests.get(f"{API}/bookings/{b['id']}", headers=login("9777700001")).status_code)
# onboarding
nv = login("9666600001")
d = requests.put(f"{API}/vendor/onboarding", headers=nv, json={"business_name": "Smoke Decor Co", "owner_name": "Ravi", "business_type": "Proprietorship", "category_slug": "decoration", "description": "Decor", "address": "Road 1", "city": "Hyderabad", "area": "Malkajgiri", "business_phone": "9666600001", "geo": {"lat": 17.45, "lng": 78.52}, "kyc_documents": [{"type": "aadhaar", "file_id": "x"}], "terms_accepted": True, "declaration_accepted": True})
print("draft", d.status_code, d.json().get("status"), d.json().get("profile_completion"))
s = requests.post(f"{API}/vendor/onboarding/submit", headers=nv); print("submit", s.status_code, s.json())
vid = d.json()["id"]
print("corrections", requests.post(f"{API}/admin/vendors/{vid}/request_corrections", headers=adm, json={"note": "Add GST"}).json())
print("approve", requests.post(f"{API}/admin/vendors/{vid}/approve", headers=adm).json())
print("near malkajgiri", [ (x["business_name"], x.get("distance_km"), x["serves_area"]) for x in requests.get(f"{API}/vendors?area=Malkajgiri&limit=3").json()["items"]])
print("field filter", requests.get(f"{API}/vendors?category=venues&f_alcohol_permitted=true&f_maximum_capacity_min=800").json()["total"])
print("logout", requests.post(f"{API}/auth/logout", headers=cust).json(), requests.get(f"{API}/auth/me", headers=cust).status_code)
