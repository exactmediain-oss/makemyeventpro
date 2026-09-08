import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Star, MapPin, BadgeCheck, Heart, Share2, Phone, MessageCircle, Clock, ShieldCheck,
  Award, ChevronLeft, Instagram, Facebook, Youtube, Globe, Check,
} from "lucide-react";
import Layout from "@/components/Layout";
import VendorCard from "@/components/VendorCard";
import EnquiryDialog from "@/components/EnquiryDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { formatINR } from "@/lib/constants";
import { toast } from "sonner";

export default function VendorProfile() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [enquire, setEnquire] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    api.get(`/vendors/${slug}`).then((r) => { setData(r.data); setActiveImg(0); }).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Layout><div className="max-w-7xl mx-auto px-4 py-8 space-y-4"><Skeleton className="h-96 w-full rounded-3xl" /><Skeleton className="h-40 w-full rounded-3xl" /></div></Layout>;
  if (!data) return null;

  const v = data.vendor;
  const fav = favorites.includes(v.id);
  const social = v.social || {};

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {/* Gallery */}
        <div className="grid md:grid-cols-[1.6fr_1fr] gap-3" data-testid="vendor-gallery">
          <div className="relative rounded-3xl overflow-hidden aspect-[16/10] md:aspect-auto">
            <img src={v.gallery?.[activeImg] || v.cover} alt={v.business_name} className="w-full h-full object-cover" />
            <div className="absolute top-4 left-4 flex gap-2">
              {v.featured && <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold">FEATURED</span>}
              {v.verified && <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> VERIFIED</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(v.gallery || []).slice(0, 4).map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)}
                className={`rounded-2xl overflow-hidden aspect-square ${activeImg === i ? "ring-2 ring-purple-500" : ""}`}>
                <img src={img} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mt-6">
          <div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl flex items-center gap-2">
              {v.business_name} {v.verified && <BadgeCheck className="h-6 w-6 text-blue-500" />}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1 text-emerald-600 font-bold"><Star className="h-4 w-4 fill-emerald-500 text-emerald-500" /> {v.rating} ({v.review_count})</span>
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {v.area}, Hyderabad</span>
              <span className="flex items-center gap-1"><Award className="h-4 w-4" /> {v.years} yrs experience</span>
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> Responds {v.response_time}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="profile-favorite-btn" variant="outline" size="icon" className="rounded-xl" onClick={() => toggleFavorite(v.id)}>
              <Heart className={`h-5 w-5 ${fav ? "fill-pink-500 text-pink-500" : ""}`} />
            </Button>
            <Button data-testid="profile-share-btn" variant="outline" size="icon" className="rounded-xl"
              onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copied"); }}>
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 mt-6">
          {/* Left content */}
          <div>
            <Tabs defaultValue="about">
              <TabsList className="rounded-xl bg-muted flex-wrap h-auto">
                <TabsTrigger value="about" data-testid="tab-about" className="rounded-lg">About</TabsTrigger>
                <TabsTrigger value="packages" data-testid="tab-packages" className="rounded-lg">Packages</TabsTrigger>
                <TabsTrigger value="services" data-testid="tab-services" className="rounded-lg">Services</TabsTrigger>
                <TabsTrigger value="amenities" data-testid="tab-amenities" className="rounded-lg">Amenities</TabsTrigger>
                <TabsTrigger value="reviews" data-testid="tab-reviews" className="rounded-lg">Reviews</TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="pt-5">
                <p className="text-muted-foreground leading-relaxed">{v.description}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {v.subcategories?.map((s) => <span key={s} className="px-3 py-1 rounded-full bg-muted text-sm font-medium">{s}</span>)}
                </div>
                <div className="flex gap-3 mt-5">
                  {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="h-10 w-10 rounded-full bg-muted flex items-center justify-center hover:bg-pink-100 hover:text-pink-600"><Instagram className="h-5 w-5" /></a>}
                  {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer" className="h-10 w-10 rounded-full bg-muted flex items-center justify-center hover:bg-blue-100 hover:text-blue-600"><Facebook className="h-5 w-5" /></a>}
                  {social.youtube && <a href={social.youtube} target="_blank" rel="noreferrer" className="h-10 w-10 rounded-full bg-muted flex items-center justify-center hover:bg-red-100 hover:text-red-600"><Youtube className="h-5 w-5" /></a>}
                  {social.website && <a href={social.website} target="_blank" rel="noreferrer" className="h-10 w-10 rounded-full bg-muted flex items-center justify-center hover:bg-purple-100 hover:text-purple-600"><Globe className="h-5 w-5" /></a>}
                </div>
              </TabsContent>

              <TabsContent value="packages" className="pt-5 space-y-4">
                {v.packages?.length ? v.packages.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border p-5 hover:border-purple-300 transition-colors" data-testid={`package-${p.id}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-display font-bold text-lg">{p.name}</h4>
                      <span className="font-display font-extrabold text-xl text-purple-600">{formatINR(p.price)}</span>
                    </div>
                    <ul className="mt-3 grid sm:grid-cols-2 gap-2">
                      {p.includes.map((inc) => <li key={inc} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> {inc}</li>)}
                    </ul>
                  </div>
                )) : <p className="text-muted-foreground">No packages listed yet.</p>}
              </TabsContent>

              <TabsContent value="services" className="pt-5">
                <div className="grid sm:grid-cols-2 gap-3">
                  {v.services?.length ? v.services.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-border p-4 flex items-center justify-between">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.price_unit}</span>
                    </div>
                  )) : <p className="text-muted-foreground">No services listed yet.</p>}
                </div>
              </TabsContent>

              <TabsContent value="amenities" className="pt-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {v.amenities?.map((a) => (
                    <div key={a} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-emerald-500" /> {a}</div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="reviews" className="pt-5 space-y-4" data-testid="reviews-list">
                {data.reviews.length ? data.reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{r.name}</span>
                      <span className="flex items-center gap-1 text-emerald-600 text-sm font-bold"><Star className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" /> {r.rating}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5">{r.text}</p>
                  </div>
                )) : <p className="text-muted-foreground">No reviews yet.</p>}
              </TabsContent>
            </Tabs>

            {data.similar?.length > 0 && (
              <div className="mt-10">
                <h3 className="font-display font-bold text-xl mb-4">Similar Vendors</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.similar.slice(0, 3).map((s, i) => <VendorCard key={s.id} vendor={s} index={i} />)}
                </div>
              </div>
            )}
          </div>

          {/* Sticky booking card */}
          <aside>
            <div className="lg:sticky lg:top-28 rounded-3xl border border-border bg-card p-5 shadow-lg">
              <div className="text-sm text-muted-foreground">Starting from</div>
              <div className="font-display font-extrabold text-3xl">{formatINR(v.starting_price)}
                <span className="text-sm font-medium text-muted-foreground"> / {v.price_unit.replace("per ", "")}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600"><ShieldCheck className="h-4 w-4" /> {v.response_rate}% response rate</div>
              <Button data-testid="profile-enquire-btn" onClick={() => setEnquire(true)}
                className="w-full mt-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 h-12 text-base font-semibold">
                Send Enquiry
              </Button>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button data-testid="profile-call-btn" variant="outline" className="rounded-xl" onClick={() => toast.info("Contact unlocked after enquiry")}>
                  <Phone className="h-4 w-4 mr-1.5" /> Call
                </Button>
                <a href={social.whatsapp ? `https://wa.me/${social.whatsapp}` : "#"} target="_blank" rel="noreferrer">
                  <Button data-testid="profile-whatsapp-btn" variant="outline" className="w-full rounded-xl">
                    <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
                  </Button>
                </a>
              </div>
              <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                Your contact details stay private until you choose to share them.
              </div>
            </div>
          </aside>
        </div>
      </div>

      <EnquiryDialog open={enquire} onOpenChange={setEnquire} vendor={v} />
    </Layout>
  );
}
