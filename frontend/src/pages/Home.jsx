import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, TrendingUp, Sparkles, Award, Clock, ShieldCheck, Search, MessageSquare, CreditCard, Star, Store } from "lucide-react";
import Layout from "@/components/Layout";
import CategoryBar from "@/components/CategoryBar";
import HeroCarousel from "@/components/HeroCarousel";
import VendorCard from "@/components/VendorCard";
import EnquiryDialog from "@/components/EnquiryDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategoryTheme } from "@/context/CategoryThemeContext";
import api from "@/lib/api";

function Row({ title, icon: Icon, vendors, onEnquire, testid }) {
  const scroller = useRef(null);
  const navigate = useNavigate();
  if (!vendors?.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-testid={testid}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-xl sm:text-2xl flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-purple-600" />} {title}
        </h2>
        <button onClick={() => navigate("/search")} className="text-sm font-semibold text-purple-600 flex items-center gap-1 hover:gap-1.5 transition-all">
          View all <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div ref={scroller} className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
        {vendors.map((v, i) => (
          <div key={v.id} className="min-w-[280px] max-w-[280px]">
            <VendorCard vendor={v} index={i} onEnquire={onEnquire} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { resetTheme } = useCategoryTheme();
  const [categories, setCategories] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [banners, setBanners] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enquireVendor, setEnquireVendor] = useState(null);
  const area = localStorage.getItem("mmep_area") || "Jubilee Hills";

  useEffect(() => {
    resetTheme();
    (async () => {
      try {
        const [c, e, b, v] = await Promise.all([
          api.get("/categories?include_all=true"),
          api.get("/event-types"),
          api.get("/banners?city=Hyderabad"),
          api.get("/vendors?city=Hyderabad&limit=48"),
        ]);
        setCategories(c.data);
        setEventTypes(e.data);
        setBanners(b.data);
        setVendors(v.data.items);
      } finally { setLoading(false); }
    })();
  }, [resetTheme]);

  const featured = vendors.filter((v) => v.featured);
  const topRated = [...vendors].sort((a, b) => b.rating - a.rating).slice(0, 10);
  const trending = vendors.filter((v) => v.trending);
  const premium = vendors.filter((v) => v.premium);

  return (
    <Layout>
      {!loading && <CategoryBar categories={categories} active="all" />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        {loading ? <Skeleton className="h-[240px] sm:h-[420px] w-full rounded-3xl" />
          : <HeroCarousel banners={banners} area={area} />}
      </div>

      {/* Popular categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="popular-categories">
        <h2 className="font-display font-bold text-xl sm:text-2xl mb-5">Popular Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.filter((c) => !c.is_all).slice(0, 10).map((c, i) => (
            <motion.button key={c.slug} data-testid={`category-tile-${c.slug}`}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/category/${c.slug}`)}
              className="relative rounded-2xl overflow-hidden aspect-[4/3] group card-hover shadow-md">
              <img src={c.banner} alt={c.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${c.theme?.accent}dd, transparent)` }} />
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-left">
                <div className="font-display font-bold text-sm leading-tight">{c.name}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Event types */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" data-testid="event-types">
        <h2 className="font-display font-bold text-xl sm:text-2xl mb-4">Shop by Event</h2>
        <div className="flex gap-2.5 flex-wrap">
          {eventTypes.map((e) => (
            <button key={e.slug} data-testid={`event-type-${e.slug}`}
              onClick={() => navigate(`/search?event_type=${encodeURIComponent(e.name)}`)}
              className="px-4 py-2 rounded-full border border-border bg-card text-sm font-medium hover:border-purple-400 hover:text-purple-600 hover:shadow-sm transition-all">
              {e.name}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="min-w-[280px] h-80 rounded-3xl" />)}
        </div>
      ) : (
        <>
          <Row title="Featured Vendors" icon={Sparkles} vendors={featured} onEnquire={setEnquireVendor} testid="row-featured" />
          <Row title="Trending Near You" icon={TrendingUp} vendors={trending} onEnquire={setEnquireVendor} testid="row-trending" />
          <Row title="Top Rated Vendors" icon={Award} vendors={topRated} onEnquire={setEnquireVendor} testid="row-top-rated" />
          <Row title="Premium Vendors" icon={Star} vendors={premium} onEnquire={setEnquireVendor} testid="row-premium" />
        </>
      )}

      {/* Join as Vendor CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="home-vendor-cta">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white p-8 sm:p-12">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-purple-600/30 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-pink-500/30 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold mb-3"><Store className="h-3.5 w-3.5" /> For event professionals</span>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl leading-tight">Grow your event business with MakeMyEventPro</h2>
              <p className="text-white/75 mt-2 text-sm sm:text-base">Join thousands of customers looking for trusted vendors. List your business, get quality leads and manage bookings in one place.</p>
            </div>
            <button data-testid="home-join-vendor-btn" onClick={() => navigate("/vendor/join")}
              className="shrink-0 inline-flex items-center gap-2 px-7 h-12 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 font-semibold hover:opacity-90 transition-opacity">
              Join as Vendor <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 mt-8" data-testid="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-white">
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-center">How MakeMyEventPro Works</h2>
          <div className="grid sm:grid-cols-4 gap-6 mt-10">
            {[
              { icon: Search, t: "Discover", d: "Find verified vendors near you across 10+ categories." },
              { icon: MessageSquare, t: "Enquire & Compare", d: "Send enquiries, get quotes and compare side-by-side." },
              { icon: ShieldCheck, t: "Book Securely", d: "Confirm bookings with secure payments & clear terms." },
              { icon: CreditCard, t: "Celebrate", d: "Enjoy your event, then share a verified review." },
            ].map((s, i) => (
              <motion.div key={s.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mx-auto mb-4">
                  <s.icon className="h-6 w-6" />
                </div>
                <div className="font-display font-bold text-lg">{s.t}</div>
                <p className="text-white/80 text-sm mt-1.5">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <EnquiryDialog open={!!enquireVendor} onOpenChange={(o) => !o && setEnquireVendor(null)} vendor={enquireVendor} />
    </Layout>
  );
}
