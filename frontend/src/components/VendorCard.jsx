import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, MapPin, Heart, BadgeCheck, GitCompare, Sparkles, Video, Images, CalendarCheck, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/constants";
import { fileUrl } from "@/lib/api";

export default function VendorCard({ vendor, index = 0, onCompare, compared, onEnquire }) {
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useAuth();
  const fav = favorites.includes(vendor.id);

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: (index % 8) * 0.05 }}
      className="group card-hover rounded-3xl bg-card border border-border overflow-hidden hover:shadow-xl hover:border-purple-200" data-testid={`vendor-card-${vendor.slug}`}>
      <div className="relative aspect-[4/3] overflow-hidden cursor-pointer" onClick={() => navigate(`/vendor/${vendor.slug}`)}>
        <img src={fileUrl(vendor.cover || vendor.gallery?.[0])} alt={vendor.business_name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 scrim opacity-90" />
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          {vendor.featured && <span className="px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold flex items-center gap-1"><Sparkles className="h-3 w-3" /> FEATURED</span>}
          {vendor.premium && <span className="px-2 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] font-bold">PREMIUM</span>}
        </div>
        <button data-testid={`favorite-btn-${vendor.slug}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(vendor.id); }}
          className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform">
          <Heart className={`h-4 w-4 ${fav ? "fill-pink-500 text-pink-500" : "text-slate-700"}`} />
        </button>
        <div className="absolute bottom-3 left-3 right-3 text-white flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs opacity-90"><MapPin className="h-3 w-3" /> {vendor.area}{vendor.distance_km != null && <span className="opacity-80" data-testid="vendor-distance">· {vendor.distance_km} km</span>}</div>
          <div className="flex gap-1">
            {vendor.videos?.length > 0 && <span className="px-1.5 py-0.5 rounded bg-black/50 text-[10px] flex items-center gap-0.5"><Video className="h-3 w-3" /> {vendor.videos.length}</span>}
            {vendor.gallery?.length > 0 && <span className="px-1.5 py-0.5 rounded bg-black/50 text-[10px] flex items-center gap-0.5"><Images className="h-3 w-3" /> {vendor.gallery.length}</span>}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-base sm:text-lg truncate flex items-center gap-1.5">{vendor.business_name}{vendor.verified && <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />}</h3>
            <p className="text-xs text-muted-foreground truncate">{vendor.category_name} · {vendor.capacity_note}</p>
          </div>
          {vendor.rating > 0 && <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-xs font-bold shrink-0"><Star className="h-3 w-3 fill-emerald-500 text-emerald-500" /> {vendor.rating}</div>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-[10px] font-semibold flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> Available</span>
          {vendor.packages?.length > 0 && <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-semibold">{vendor.packages.length} packages</span>}
          {vendor.offer && <span className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 text-[10px] font-semibold flex items-center gap-1"><Tag className="h-3 w-3" /> {vendor.offer}</span>}
          {vendor.serves_area && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[10px] font-semibold">Serves your area</span>}
          {(vendor.amenities || []).slice(0, 2).map((a) => <span key={a} className="px-2 py-0.5 rounded-full bg-muted text-[10px]">{a}</span>)}
        </div>
        <div className="flex items-end justify-between">
          <div><div className="text-[11px] text-muted-foreground">Starting from</div>
            <div className="font-display font-extrabold text-lg">{formatINR(vendor.starting_price)}<span className="text-xs font-medium text-muted-foreground"> / {(vendor.price_unit || "per event").replace("per ", "")}</span></div></div>
          <div className="text-[11px] text-muted-foreground">{vendor.review_count} reviews</div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button data-testid={`enquire-btn-${vendor.slug}`} size="sm" onClick={() => onEnquire ? onEnquire(vendor) : navigate(`/vendor/${vendor.slug}`)} className="flex-1 rounded-xl cat-btn hover:opacity-90 font-semibold">Enquire</Button>
          <Button data-testid={`book-btn-${vendor.slug}`} size="sm" variant="outline" onClick={() => navigate(`/vendor/${vendor.slug}?book=1`)} className="rounded-xl" style={{ borderColor: "var(--cat-accent)", color: "var(--cat-accent)" }}>Book</Button>
          {onCompare && <Button data-testid={`compare-btn-${vendor.slug}`} size="icon" variant="outline" onClick={() => onCompare(vendor)} className={`rounded-xl shrink-0 ${compared ? "bg-purple-100 dark:bg-purple-950 border-purple-400 text-purple-600" : ""}`}><GitCompare className="h-4 w-4" /></Button>}
        </div>
      </div>
    </motion.div>
  );
}
