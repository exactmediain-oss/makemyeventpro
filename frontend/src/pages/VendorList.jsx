import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X, GitCompare } from "lucide-react";
import Layout from "@/components/Layout";
import CategoryBar from "@/components/CategoryBar";
import VendorCard from "@/components/VendorCard";
import EnquiryDialog from "@/components/EnquiryDialog";
import CompareDrawer from "@/components/CompareDrawer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCategoryTheme } from "@/context/CategoryThemeContext";
import api from "@/lib/api";
import { formatINR } from "@/lib/constants";

function Filters({ maxPrice, setMaxPrice, minRating, setMinRating, verifiedOnly, setVerifiedOnly, featuredOnly, setFeaturedOnly }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between text-sm font-semibold mb-2"><span>Max Price</span><span className="text-purple-600">{formatINR(maxPrice)}</span></div>
        <Slider data-testid="filter-price-slider" value={[maxPrice]} min={10000} max={500000} step={10000} onValueChange={(v) => setMaxPrice(v[0])} />
      </div>
      <div>
        <div className="text-sm font-semibold mb-2">Minimum Rating</div>
        <div className="flex gap-2">
          {[0, 4, 4.5, 4.8].map((r) => (
            <button key={r} data-testid={`filter-rating-${r}`} onClick={() => setMinRating(r)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${minRating === r ? "bg-purple-600 text-white border-purple-600" : "border-border hover:border-purple-300"}`}>
              {r === 0 ? "Any" : `${r}+`}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <Checkbox data-testid="filter-verified" checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
        <span className="text-sm font-medium">Verified vendors only</span>
      </label>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <Checkbox data-testid="filter-featured" checked={featuredOnly} onCheckedChange={setFeaturedOnly} />
        <span className="text-sm font-medium">Featured only</span>
      </label>
    </div>
  );
}

export default function VendorList() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const q = sp.get("q") || "";
  const eventType = sp.get("event_type") || "";
  const { applyTheme, resetTheme } = useCategoryTheme();

  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("relevance");
  const [maxPrice, setMaxPrice] = useState(500000);
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [enquireVendor, setEnquireVendor] = useState(null);
  const [compare, setCompare] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const activeCat = categories.find((c) => c.slug === slug);

  useEffect(() => { api.get("/categories").then((r) => setCategories(r.data)); }, []);
  useEffect(() => {
    if (activeCat) applyTheme(activeCat.theme, activeCat.slug); else resetTheme();
  }, [activeCat, applyTheme, resetTheme]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ city: "Hyderabad", sort, limit: "48" });
      if (slug) params.set("category", slug);
      if (q) params.set("q", q);
      if (eventType) params.set("event_type", eventType);
      if (maxPrice < 500000) params.set("max_price", maxPrice);
      if (minRating) params.set("min_rating", minRating);
      if (verifiedOnly) params.set("verified", "true");
      if (featuredOnly) params.set("featured", "true");
      const { data } = await api.get(`/vendors?${params.toString()}`);
      setVendors(data.items);
    } finally { setLoading(false); }
  }, [slug, q, eventType, sort, maxPrice, minRating, verifiedOnly, featuredOnly]);

  useEffect(() => { load(); }, [load]);

  const toggleCompare = (v) => {
    setCompare((prev) => prev.find((x) => x.id === v.id)
      ? prev.filter((x) => x.id !== v.id)
      : prev.length >= 3 ? prev : [...prev, v]);
  };

  const title = activeCat ? activeCat.name : eventType ? `${eventType} Vendors` : q ? `Results for "${q}"` : "All Vendors";

  return (
    <Layout>
      <CategoryBar categories={categories} active={slug || "all"} />

      {activeCat && (
        <div className="relative h-40 sm:h-52 overflow-hidden" data-testid="category-hero">
          <img src={activeCat.banner} alt={activeCat.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${activeCat.theme?.accent}ee, ${activeCat.theme?.accent}55)` }} />
          <div className="absolute inset-0 flex items-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-white">
              <h1 className="font-display font-extrabold text-2xl sm:text-4xl">{activeCat.name} in Hyderabad</h1>
              <p className="text-white/85 mt-1 text-sm sm:text-base max-w-lg">{activeCat.description}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display font-bold text-lg sm:text-xl">{title}</h2>
            <p className="text-sm text-muted-foreground">{loading ? "Loading..." : `${vendors.length} vendors found`}</p>
          </div>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="rounded-xl lg:hidden" data-testid="mobile-filters-btn">
                  <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-white dark:bg-slate-900 w-80">
                <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                <div className="mt-6"><Filters {...{ maxPrice, setMaxPrice, minRating, setMinRating, verifiedOnly, setVerifiedOnly, featuredOnly, setFeaturedOnly }} /></div>
              </SheetContent>
            </Sheet>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger data-testid="sort-select" className="w-[150px] rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 rounded-xl">
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-40 rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display font-bold mb-5 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Filters</h3>
              <Filters {...{ maxPrice, setMaxPrice, minRating, setMinRating, verifiedOnly, setVerifiedOnly, featuredOnly, setFeaturedOnly }} />
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-80 rounded-3xl" />)}
              </div>
            ) : vendors.length === 0 ? (
              <div className="text-center py-20" data-testid="empty-state">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="font-display font-bold text-xl">No vendors found in this area</h3>
                <p className="text-muted-foreground mt-1">Try adjusting filters or exploring another category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {vendors.map((v, i) => (
                  <VendorCard key={v.id} vendor={v} index={i} onEnquire={setEnquireVendor}
                    onCompare={toggleCompare} compared={!!compare.find((x) => x.id === v.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {compare.length > 0 && (
        <button data-testid="open-compare-btn" onClick={() => setCompareOpen(true)}
          className="fixed bottom-24 md:bottom-8 right-5 z-40 px-5 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold shadow-xl flex items-center gap-2 hover:scale-105 transition-transform">
          <GitCompare className="h-5 w-5" /> Compare ({compare.length})
        </button>
      )}

      <CompareDrawer open={compareOpen} onOpenChange={setCompareOpen} vendors={compare} onRemove={toggleCompare} />
      <EnquiryDialog open={!!enquireVendor} onOpenChange={(o) => !o && setEnquireVendor(null)} vendor={enquireVendor} />
    </Layout>
  );
}
