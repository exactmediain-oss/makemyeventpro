"""Idempotent Hyderabad-first seed data for MakeMyEventPro. Marked is_demo where applicable."""
import uuid
import re
from datetime import datetime, timezone


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def nid():
    return str(uuid.uuid4())


def slugify(t):
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')


# ---- category themes (from design guidelines) ----
CATEGORIES = [
    {"name": "Venues & Banquets", "slug": "venues", "icon": "Building2", "order": 1,
     "description": "Banquet halls, lawns, resorts, convention centres & palaces.",
     "theme": {"gradient": "from-amber-600 via-rose-600 to-purple-700", "accent": "#D97706",
               "bg_soft": "rgba(217,119,6,0.08)", "glow": "rgba(217,119,6,0.3)"},
     "subcategories": ["Banquet Hall", "Marriage Garden / Lawn", "Convention Centre", "Resort", "Rooftop", "Farmhouse"],
     "amenities": ["AC", "Parking", "Rooms", "Bridal Room", "Outside Catering", "Alcohol Allowed", "Power Backup", "Stage", "Valet"]},
    {"name": "Photography & Video", "slug": "photography", "icon": "Camera", "order": 2,
     "description": "Candid, cinematic, pre-wedding, drone & same-day edits.",
     "theme": {"gradient": "from-blue-600 via-indigo-600 to-cyan-500", "accent": "#2563EB",
               "bg_soft": "rgba(37,99,235,0.08)", "glow": "rgba(37,99,235,0.3)"},
     "subcategories": ["Candid Photography", "Cinematic Video", "Pre-Wedding", "Drone", "Photo Booth"],
     "amenities": ["Drone", "Same-day Edit", "Album", "4K Video", "Live Streaming"]},
    {"name": "Catering & Food", "slug": "catering", "icon": "UtensilsCrossed", "order": 3,
     "description": "Multi-cuisine buffets, live counters & Hyderabadi feasts.",
     "theme": {"gradient": "from-emerald-600 via-teal-600 to-amber-500", "accent": "#059669",
               "bg_soft": "rgba(5,150,105,0.08)", "glow": "rgba(5,150,105,0.28)"},
     "subcategories": ["Veg", "Non-Veg", "Hyderabadi", "South Indian", "North Indian", "Live Counters"],
     "amenities": ["Buffet", "Live Counters", "Service Staff", "Crockery", "Desserts", "Tasting"]},
    {"name": "Decoration & Florals", "slug": "decoration", "icon": "Flower2", "order": 4,
     "description": "Mandap, stage, floral, balloon & theme décor.",
     "theme": {"gradient": "from-pink-500 via-rose-500 to-orange-400", "accent": "#EC4899",
               "bg_soft": "rgba(236,72,153,0.08)", "glow": "rgba(236,72,153,0.3)"},
     "subcategories": ["Stage Decor", "Mandap", "Floral", "Balloon", "Theme Decor", "Entrance"],
     "amenities": ["Fresh Flowers", "Lighting", "Flower Walls", "Car Decoration"]},
    {"name": "Entertainment", "slug": "entertainment", "icon": "Music", "order": 5,
     "description": "DJs, live bands, anchors, dancers & artists.",
     "theme": {"gradient": "from-purple-600 via-fuchsia-600 to-indigo-600", "accent": "#9333EA",
               "bg_soft": "rgba(147,51,234,0.08)", "glow": "rgba(147,51,234,0.3)"},
     "subcategories": ["DJ", "Live Band", "Anchor / Emcee", "Dance Group", "Singer", "Magician"],
     "amenities": ["Equipment Included", "Travel Available"]},
    {"name": "Beauty & Makeup", "slug": "beauty", "icon": "Sparkles", "order": 6,
     "description": "Bridal makeup, HD, airbrush, hair & mehendi.",
     "theme": {"gradient": "from-rose-500 via-pink-600 to-purple-500", "accent": "#E11D48",
               "bg_soft": "rgba(225,29,72,0.08)", "glow": "rgba(225,29,72,0.3)"},
     "subcategories": ["Bridal Makeup", "HD Makeup", "Airbrush", "Hair Styling", "Mehendi"],
     "amenities": ["Trial Available", "Travel to Venue", "Team of Artists"]},
    {"name": "Fashion & Jewellery", "slug": "fashion", "icon": "Gem", "order": 7,
     "description": "Bridal & groom wear, lehengas, sherwanis & jewellery.",
     "theme": {"gradient": "from-fuchsia-600 via-purple-600 to-blue-600", "accent": "#C026D3",
               "bg_soft": "rgba(192,38,211,0.08)", "glow": "rgba(192,38,211,0.3)"},
     "subcategories": ["Bridal Wear", "Groom Wear", "Lehengas", "Sherwanis", "Jewellery", "Rentals"],
     "amenities": ["Rentals", "Custom Stitching"]},
    {"name": "Event Planning", "slug": "planning", "icon": "ClipboardList", "order": 8,
     "description": "Full wedding & corporate event management.",
     "theme": {"gradient": "from-blue-600 via-purple-600 to-pink-500", "accent": "#7C3AED",
               "bg_soft": "rgba(124,58,237,0.08)", "glow": "rgba(124,58,237,0.25)"},
     "subcategories": ["Wedding Planner", "Corporate Planner", "Birthday Planner", "Destination Wedding"],
     "amenities": ["End-to-end", "On-day Coordination"]},
    {"name": "Sound, Lighting & AV", "slug": "sound-av", "icon": "Speaker", "order": 9,
     "description": "Sound systems, LED walls, lighting & production.",
     "theme": {"gradient": "from-slate-800 via-indigo-900 to-blue-800", "accent": "#3B82F6",
               "bg_soft": "rgba(59,130,246,0.08)", "glow": "rgba(59,130,246,0.25)"},
     "subcategories": ["DJ Sound", "Stage Lighting", "LED Walls", "Projectors", "Generators"],
     "amenities": ["Technician Included", "Power Backup"]},
    {"name": "Transportation", "slug": "transportation", "icon": "Car", "order": 10,
     "description": "Wedding cars, luxury cars, buses & guest transport.",
     "theme": {"gradient": "from-cyan-600 via-blue-600 to-indigo-600", "accent": "#0891B2",
               "bg_soft": "rgba(8,145,178,0.08)", "glow": "rgba(8,145,178,0.28)"},
     "subcategories": ["Wedding Cars", "Luxury Cars", "Vintage Cars", "Buses", "Tempo Traveller"],
     "amenities": ["Chauffeur", "Decoration Included", "AC"]},
]

EVENT_TYPES = ["Wedding", "Engagement", "Reception", "Birthday", "Anniversary", "Baby Shower",
               "Haldi", "Mehendi", "Sangeet", "Corporate Event", "Conference", "Product Launch",
               "Exhibition", "College Fest", "Religious Event", "Party", "Concert"]

HYD_AREAS = ["Banjara Hills", "Jubilee Hills", "Gachibowli", "Madhapur", "Hitec City", "Kondapur",
             "Kukatpally", "Secunderabad", "Begumpet", "Malkajgiri", "Miyapur", "Financial District"]

IMG = {
    "venues": ["https://images.unsplash.com/photo-1587271407850-8d438ca9fdf2?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
               "https://images.unsplash.com/photo-1587271636175-90d58cdad458?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
               "https://images.unsplash.com/photo-1630526720753-aa4e71acf67d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
    "photography": ["https://images.unsplash.com/photo-1633104502699-b2ecf0fee294?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                    "https://images.unsplash.com/photo-1519741497674-611481863552?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
    "catering": ["https://images.unsplash.com/photo-1680342630889-b475e612a058?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                 "https://images.unsplash.com/photo-1719786625035-71f46082e385?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                 "https://images.unsplash.com/photo-1660120447916-123439b05c40?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
    "decoration": ["https://images.unsplash.com/photo-1601482441062-b9f13131f33a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                   "https://images.unsplash.com/photo-1772127822552-ce9ef537bdcf?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
    "entertainment": ["https://images.unsplash.com/photo-1654134192252-eb9d5c43f7c5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                      "https://images.unsplash.com/photo-1574154808186-c3b1303a4b4c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
    "beauty": ["https://images.unsplash.com/photo-1600685890506-593fdf55949b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
               "https://images.unsplash.com/photo-1610173827043-9db50e0d8ef9?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
               "https://images.unsplash.com/photo-1606216794079-73f85bbd57d5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
    "fashion": ["https://images.unsplash.com/photo-1610173827043-9db50e0d8ef9?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
    "planning": ["https://images.unsplash.com/photo-1587271636175-90d58cdad458?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
    "sound-av": ["https://images.unsplash.com/photo-1670028514318-0ac718c0590d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                 "https://images.unsplash.com/photo-1730134322176-862f1cf9bc9f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
    "transportation": ["https://images.unsplash.com/photo-1592514313074-794923c98162?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                       "https://images.unsplash.com/photo-1729022508881-866e115a51d8?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"],
}

# (business_name, category_slug, area, starting_price, price_unit, capacity_note, rating, reviews, featured, premium, trending)
VENDORS = [
    ("Falaknuma Grand Convention", "venues", "Banjara Hills", 90000, "per event", "500–1000 Guests", 4.9, 214, True, True, True),
    ("Rock Heights Banquet", "venues", "Jubilee Hills", 65000, "per event", "300–600 Guests", 4.7, 158, True, False, False),
    ("Lakeview Lawns & Resort", "venues", "Gachibowli", 120000, "per event", "800–1500 Guests", 4.8, 96, False, True, True),
    ("Pixel Stories Photography", "photography", "Madhapur", 45000, "per event", "Candid + Cinematic", 4.9, 302, True, True, True),
    ("Frame & Focus Studios", "photography", "Kondapur", 35000, "per event", "Pre-wedding specialists", 4.6, 121, False, False, False),
    ("Paradise Royal Caterers", "catering", "Secunderabad", 850, "per plate", "Veg & Non-Veg", 4.8, 275, True, False, True),
    ("Nizami Dawat Catering", "catering", "Malkajgiri", 1100, "per plate", "Authentic Hyderabadi", 4.7, 189, False, True, False),
    ("Blossom Decor Studio", "decoration", "Hitec City", 40000, "per event", "Floral & Theme", 4.8, 143, True, False, True),
    ("Mandap Magic Events", "decoration", "Kukatpally", 55000, "per event", "Grand Mandap Setups", 4.6, 88, False, False, False),
    ("BeatBox DJ & Sound", "entertainment", "Gachibowli", 30000, "per event", "DJ + Live Effects", 4.7, 167, True, False, True),
    ("Sangeet Nights Live Band", "entertainment", "Begumpet", 60000, "per event", "8-piece Live Band", 4.9, 74, False, True, False),
    ("Glam by Aisha", "beauty", "Jubilee Hills", 25000, "per event", "HD & Airbrush Bridal", 4.9, 231, True, True, True),
    ("Blush Bridal Studio", "beauty", "Banjara Hills", 18000, "per event", "Bridal + Mehendi", 4.7, 142, False, False, False),
    ("Elite Wedding Planners", "planning", "Financial District", 150000, "per event", "Full-service Planning", 4.8, 59, True, True, False),
    ("StageCraft AV Production", "sound-av", "Miyapur", 45000, "per event", "LED Walls + Lighting", 4.6, 63, False, False, False),
    ("Royal Ride Luxury Cars", "transportation", "Secunderabad", 15000, "per day", "Audi / BMW / Vintage", 4.8, 97, True, False, True),
]

PACKAGES_BY_CAT = {
    "venues": [("Silver Hall Package", 90000, ["Hall rental (6 hrs)", "Basic stage", "Parking", "Power backup"]),
               ("Gold Wedding Package", 175000, ["Hall + Lawn", "Bridal room", "Valet parking", "Basic décor", "500 pax dining"]),
               ("Platinum Grand Package", 350000, ["Full venue", "Premium décor", "AC banquet", "Rooms x4", "Unlimited hours"])],
    "photography": [("Candid Essentials", 45000, ["1 photographer", "1 videographer", "300 edited photos", "Highlight reel"]),
                    ("Signature Wedding", 95000, ["2 photographers", "2 videographers", "Candid + cinematic", "Drone", "Album"]),
                    ("Platinum Cinematic", 165000, ["3 photographers", "3 videographers", "Same-day edit", "Drone", "Premium album", "Reels"])],
    "catering": [("Veg Buffet", 850, ["Welcome drinks", "3 starters", "8 main course", "3 desserts"]),
                 ("Royal Non-Veg", 1250, ["5 starters", "Live counters x2", "10 main course", "Biryani", "Desserts"]),
                 ("Hyderabadi Dawat", 1600, ["Haleem", "Dum Biryani", "Live counters x4", "Qubani ka Meetha"])],
}

DEFAULT_PACKAGES = [("Basic Package", 30000, ["Standard service", "On-time delivery"]),
                    ("Premium Package", 60000, ["Enhanced service", "Priority support", "Add-ons included"])]

REVIEW_TEXTS = [
    ("Rohan & Priya", 5, "Absolutely stunning work. Made our wedding unforgettable!"),
    ("Sneha Reddy", 5, "Professional, punctual and super creative. Highly recommend."),
    ("Arjun Verma", 4, "Great experience overall, delivered exactly as promised."),
    ("Kavya Sharma", 5, "Exceeded our expectations. Worth every rupee."),
]


async def seed_database(db):
    if await db.categories.count_documents({}) == 0:
        for c in CATEGORIES:
            await db.categories.insert_one({"id": nid(), "active": True, "banner": IMG[c["slug"]][0], **c})

    if await db.event_types.count_documents({}) == 0:
        for e in EVENT_TYPES:
            await db.event_types.insert_one({"id": nid(), "name": e, "slug": slugify(e), "active": True})

    if await db.cities.count_documents({}) == 0:
        await db.cities.insert_one({
            "id": nid(), "name": "Hyderabad", "state": "Telangana", "country": "India",
            "active": True, "areas": [{"name": a, "pincode": "5000" + str(10 + i)} for i, a in enumerate(HYD_AREAS)],
        })

    # owner / super admin
    if not await db.users.find_one({"email": "exactmedia.in@gmail.com"}):
        await db.users.insert_one({
            "id": nid(), "phone": "9999900001", "name": "MakeMyEventPro Owner",
            "email": "exactmedia.in@gmail.com", "role": "super_admin", "city": "Hyderabad",
            "avatar": None, "status": "active", "created_at": now_iso(),
        })

    # demo vendor login account
    vendor_user = await db.users.find_one({"phone": "9999900002"})
    if not vendor_user:
        vendor_user = {
            "id": nid(), "phone": "9999900002", "name": "Vikram (Vendor Demo)",
            "email": "vendor.demo@makemyeventpro.com", "role": "vendor", "city": "Hyderabad",
            "avatar": None, "status": "active", "created_at": now_iso(),
        }
        await db.users.insert_one({**vendor_user})

    if await db.vendors.count_documents({}) == 0:
        for i, (name, cat, area, price, unit, cap, rating, reviews, feat, prem, trend) in enumerate(VENDORS):
            catdoc = next(c for c in CATEGORIES if c["slug"] == cat)
            imgs = IMG[cat]
            gallery = (imgs * 3)[:5]
            pkgs = PACKAGES_BY_CAT.get(cat, DEFAULT_PACKAGES)
            packages = [{"id": nid(), "name": p[0], "price": p[1], "includes": p[2]} for p in pkgs]
            services = [{"id": nid(), "name": s, "price_unit": unit} for s in catdoc["subcategories"][:4]]
            vid = nid()
            # link first vendor to the demo vendor account
            linked_user = vendor_user["id"] if i == 0 else None
            await db.vendors.insert_one({
                "id": vid, "user_id": linked_user, "business_name": name, "slug": slugify(name),
                "category_slug": cat, "category_name": catdoc["name"],
                "subcategories": catdoc["subcategories"][:3], "city": "Hyderabad", "area": area,
                "address": f"{area}, Hyderabad, Telangana", "geo": {"type": "Point", "coordinates": [78.45 + i * 0.01, 17.42 + i * 0.01]},
                "description": f"{name} is a premium {catdoc['name'].lower()} provider in {area}, Hyderabad. {cap}. Trusted by hundreds of families for weddings, receptions and corporate events.",
                "logo": imgs[0], "cover": imgs[0], "gallery": gallery,
                "rating": rating, "review_count": reviews, "starting_price": price, "price_unit": unit,
                "capacity_note": cap, "verified": True, "featured": feat, "premium": prem, "trending": trend,
                "amenities": catdoc.get("amenities", []), "services": services, "packages": packages,
                "event_types": ["Wedding", "Reception", "Engagement", "Corporate Event"],
                "social": {"instagram": "https://instagram.com", "facebook": "https://facebook.com",
                           "youtube": "https://youtube.com", "website": "https://makemyeventpro.com",
                           "whatsapp": "919999900002"},
                "response_rate": 95, "response_time": "within 2 hrs", "years": 6 + (i % 8),
                "profile_completion": 90, "profile_views": 1200 + i * 137, "revenue": 0,
                "status": "approved", "is_demo": True, "created_at": now_iso(),
            })
            for rn, (rname, rr, rtext) in enumerate(REVIEW_TEXTS[: (3 if feat else 2)]):
                await db.reviews.insert_one({
                    "id": nid(), "vendor_id": vid, "user_id": None, "name": rname,
                    "rating": rr, "quality": rr, "service": rr, "value": min(rr, 5),
                    "text": rtext, "photos": [], "status": "approved",
                    "response": None, "created_at": now_iso(), "is_demo": True,
                })

    # a pending vendor for admin approval demo
    if await db.vendors.count_documents({"status": "submitted"}) == 0:
        catdoc = CATEGORIES[0]
        await db.vendors.insert_one({
            "id": nid(), "user_id": None, "business_name": "New Horizon Gardens (Pending)",
            "slug": "new-horizon-gardens", "category_slug": "venues", "category_name": catdoc["name"],
            "subcategories": ["Marriage Garden / Lawn"], "city": "Hyderabad", "area": "Miyapur",
            "address": "Miyapur, Hyderabad", "geo": {"type": "Point", "coordinates": [78.36, 17.49]},
            "description": "A newly listed open-air garden venue awaiting verification.",
            "logo": IMG["venues"][1], "cover": IMG["venues"][1], "gallery": IMG["venues"][:2],
            "rating": 0, "review_count": 0, "starting_price": 50000, "price_unit": "per event",
            "capacity_note": "200–400 Guests", "verified": False, "featured": False, "premium": False,
            "trending": False, "amenities": ["Parking", "Power Backup"], "services": [], "packages": [],
            "event_types": ["Wedding"], "social": {}, "response_rate": 0, "response_time": "-",
            "years": 1, "profile_completion": 55, "profile_views": 0, "revenue": 0,
            "status": "submitted", "is_demo": True, "created_at": now_iso(),
        })

    if await db.banners.count_documents({}) == 0:
        banners = [
            ("Top Wedding Venues Near You", "Banjara Hills • Jubilee Hills • Gachibowli", "Explore Venues",
             IMG["venues"][0], "venues", 1),
            ("20% Off Bridal Makeup Packages", "Book Hyderabad's finest artists this season", "Grab Offer",
             IMG["beauty"][0], "beauty", 2),
            ("Hyderabadi Dawat Caterers", "Authentic Biryani & live counters for 500+ guests", "Taste Now",
             IMG["catering"][2], "catering", 3),
            ("Capture Your Big Day", "Candid & cinematic wedding photographers", "Find Photographers",
             IMG["photography"][0], "photography", 4),
        ]
        for t, s, cta, img, cat, pri in banners:
            await db.banners.insert_one({
                "id": nid(), "title": t, "subtitle": s, "cta": cta, "image": img,
                "category_slug": cat, "city": "Hyderabad", "area": None, "link": f"/category/{cat}",
                "priority": pri, "status": "active", "target_platform": "all", "created_at": now_iso(),
            })
