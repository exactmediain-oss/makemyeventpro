import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Store, Clock, BadgeCheck, MessageSquare, Star, LayoutGrid, MapPin, LogOut, Loader2, CalendarCheck, IndianRupee, Percent, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { BRAND_LOGO, formatINR } from "@/lib/constants";
import VendorsTab from "./VendorsTab";
import FieldBuilderTab from "./FieldBuilderTab";
import LocationsTab from "./LocationsTab";
import CategoryManagerTab from "./CategoryManagerTab";
import { BannersTab, CustomersTab, BookingsTab, PaymentsTab, CouponsTab, ReviewsTab, PlansTab, PagesTab, SettingsTab, PaymentSettingsTab, NotifyTab, AuditTab } from "./tabs";
import AuthDialog from "@/components/AuthDialog";

const TABS = [["kyc", "KYC Queue"], ["vendors", "Vendors"], ["fields", "Field Builder"], ["categories", "Categories"], ["locations", "Locations"], ["customers", "Customers"],
  ["bookings", "Bookings"], ["payments", "Payments & Payouts"], ["paysettings", "Payment Settings"], ["coupons", "Coupons & Offers"], ["reviews", "Reviews"], ["banners", "Banners & Ads"], ["plans", "Vendor Plans"], ["pages", "CMS Pages"], ["notify", "Notifications"], ["settings", "Settings"], ["audit", "Audit Logs"]];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout, setAuthOpen } = useAuth();
  const [stats, setStats] = useState(null); const [vendors, setVendors] = useState([]); const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState(false); const [allCats, setAllCats] = useState([]);
  const isAdmin = user && ["admin", "super_admin", "content_manager", "support_manager", "finance_manager"].includes(user.role);

  const loadAll = () => Promise.all([api.get("/admin/stats"), api.get("/admin/vendors"), api.get("/categories?include_all=true&include_inactive=true")])
    .then(([s, v, c]) => { setStats(s.data); setVendors(v.data); setCategories(c.data.filter((x) => !x.is_all && x.active)); setAllCats(c.data); }).catch(() => setErr(true)).finally(() => setLoading(false));
  useEffect(() => { if (!user) { setAuthOpen(true); setLoading(false); return; } if (!isAdmin) { setErr(true); setLoading(false); return; } loadAll(); }, [user]); // eslint-disable-line

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user || err) return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center"><AuthDialog /><div>
      <Shield className="h-12 w-12 mx-auto text-purple-500 mb-4" /><h2 className="font-display font-bold text-xl">Admin access required</h2>
      <div className="flex gap-2 justify-center mt-5"><Button onClick={() => setAuthOpen(true)} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Login</Button><Button variant="outline" onClick={() => navigate("/")} className="rounded-xl">Marketplace</Button></div>
    </div></div>);

  if (!stats) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const pending = vendors.filter((v) => ["submitted", "under_review", "corrections_requested"].includes(v.status)).length;
  const cards = [
    { icon: Users, label: "Customers", value: stats.total_customers, color: "from-blue-500 to-indigo-500" },
    { icon: Store, label: "Vendors", value: stats.total_vendors, color: "from-purple-500 to-fuchsia-500" },
    { icon: Clock, label: "Pending KYC", value: stats.pending_vendors, color: "from-amber-500 to-orange-500" },
    { icon: BadgeCheck, label: "Verified", value: stats.verified_vendors, color: "from-emerald-500 to-teal-500" },
    { icon: MessageSquare, label: "Enquiries", value: stats.total_enquiries, color: "from-pink-500 to-rose-500" },
    { icon: CalendarCheck, label: "Bookings", value: stats.total_bookings, color: "from-teal-500 to-cyan-500" },
    { icon: IndianRupee, label: "GMV", value: formatINR(stats.gmv), color: "from-green-500 to-emerald-600" },
    { icon: Percent, label: "Commission", value: formatINR(stats.commission_earned), color: "from-violet-500 to-purple-600" },
    { icon: Undo2, label: "Refund requests", value: stats.refund_requests, color: "from-orange-500 to-red-500" },
    { icon: Star, label: "Pending reviews", value: stats.pending_reviews, color: "from-yellow-500 to-amber-500" },
    { icon: LayoutGrid, label: "Categories / Fields", value: `${stats.categories} / ${stats.fields}`, color: "from-slate-600 to-slate-800" },
    { icon: MapPin, label: "Cities", value: stats.cities, color: "from-cyan-600 to-blue-600" },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-slate-950 text-white sticky top-0 z-40"><div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2"><img src={BRAND_LOGO} className="h-9 w-9 rounded-xl" alt="" /><span className="font-display font-bold">Super Admin Console</span></button>
        <div className="flex items-center gap-3"><span className="text-sm hidden sm:block">{user.email || user.name}</span><Button variant="secondary" size="sm" className="rounded-xl" onClick={logout}><LogOut className="h-4 w-4" /></Button></div></div></header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl">Platform Overview</h1><p className="text-muted-foreground">MakeMyEventPro · full marketplace control</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-6">{cards.map((c) => <div key={c.label} className="rounded-2xl border border-border bg-card p-4"><div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-2`}><c.icon className="h-4 w-4 text-white" /></div><div className="text-xs text-muted-foreground">{c.label}</div><div className="font-display font-extrabold text-xl">{c.value}</div></div>)}</div>
        <Tabs defaultValue="kyc" className="mt-8">
          <TabsList className="rounded-xl bg-muted flex-wrap h-auto justify-start">{TABS.map(([k, l]) => <TabsTrigger key={k} value={k} data-testid={`admin-tab-${k}`} className="rounded-lg">{l}{k === "kyc" && pending > 0 ? ` (${pending})` : ""}</TabsTrigger>)}</TabsList>
          <TabsContent value="kyc" className="pt-5"><VendorsTab vendors={vendors} reload={loadAll} queueOnly /></TabsContent>
          <TabsContent value="vendors" className="pt-5"><VendorsTab vendors={vendors} reload={loadAll} /></TabsContent>
          <TabsContent value="fields" className="pt-5"><FieldBuilderTab categories={categories} /></TabsContent>
          <TabsContent value="categories" className="pt-5"><CategoryManagerTab categories={allCats} reload={loadAll} /></TabsContent>
          <TabsContent value="locations" className="pt-5"><LocationsTab /></TabsContent>
          <TabsContent value="customers" className="pt-5"><CustomersTab /></TabsContent>
          <TabsContent value="bookings" className="pt-5"><BookingsTab /></TabsContent>
          <TabsContent value="payments" className="pt-5"><PaymentsTab /></TabsContent>
          <TabsContent value="paysettings" className="pt-5"><PaymentSettingsTab /></TabsContent>
          <TabsContent value="coupons" className="pt-5"><CouponsTab categories={categories} /></TabsContent>
          <TabsContent value="reviews" className="pt-5"><ReviewsTab /></TabsContent>
          <TabsContent value="banners" className="pt-5"><BannersTab categories={categories} /></TabsContent>
          <TabsContent value="plans" className="pt-5"><PlansTab /></TabsContent>
          <TabsContent value="pages" className="pt-5"><PagesTab /></TabsContent>
          <TabsContent value="notify" className="pt-5"><NotifyTab /></TabsContent>
          <TabsContent value="settings" className="pt-5"><SettingsTab /></TabsContent>
          <TabsContent value="audit" className="pt-5"><AuditTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
