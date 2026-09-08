import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, Users, Store, Clock, BadgeCheck, MessageSquare, Star, LayoutGrid,
  Image as ImageIcon, MapPin, LogOut, Loader2, Check, X, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { BRAND_LOGO } from "@/lib/constants";
import { toast } from "sonner";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout, setAuthOpen } = useAuth();
  const [stats, setStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const isAdmin = user && ["admin", "super_admin", "content_manager", "support_manager", "finance_manager"].includes(user.role);

  const loadAll = () => Promise.all([
    api.get("/admin/stats"), api.get("/admin/vendors"), api.get("/categories"), api.get("/banners"),
  ]).then(([s, v, c, b]) => { setStats(s.data); setVendors(v.data); setCategories(c.data); setBanners(b.data); })
    .catch(() => setErr(true)).finally(() => setLoading(false));

  useEffect(() => {
    if (!user) { setAuthOpen(true); setLoading(false); return; }
    if (!isAdmin) { setErr(true); setLoading(false); return; }
    loadAll();
  }, [user]); // eslint-disable-line

  const act = async (id, action) => {
    await api.post(`/admin/vendors/${id}/${action}`);
    toast.success(`Vendor ${action}d`);
    const v = await api.get("/admin/vendors"); setVendors(v.data);
    const s = await api.get("/admin/stats"); setStats(s.data);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user || err) return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center">
      <div>
        <Shield className="h-12 w-12 mx-auto text-purple-500 mb-4" />
        <h2 className="font-display font-bold text-xl">Admin access required</h2>
        <p className="text-muted-foreground mt-1">Login as admin (demo: 9999900001 · OTP 123456).</p>
        <div className="flex gap-2 justify-center mt-5">
          <Button onClick={() => setAuthOpen(true)} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Login</Button>
          <Button variant="outline" onClick={() => navigate("/")} className="rounded-xl">Marketplace</Button>
        </div>
      </div>
    </div>
  );

  const pending = vendors.filter((v) => v.status === "submitted");
  const cards = [
    { icon: Users, label: "Customers", value: stats.total_customers, color: "from-blue-500 to-indigo-500" },
    { icon: Store, label: "Total Vendors", value: stats.total_vendors, color: "from-purple-500 to-fuchsia-500" },
    { icon: Clock, label: "Pending KYC", value: stats.pending_vendors, color: "from-amber-500 to-orange-500" },
    { icon: BadgeCheck, label: "Verified", value: stats.verified_vendors, color: "from-emerald-500 to-teal-500" },
    { icon: MessageSquare, label: "Enquiries", value: stats.total_enquiries, color: "from-pink-500 to-rose-500" },
    { icon: Star, label: "Reviews", value: stats.total_reviews, color: "from-cyan-500 to-blue-500" },
    { icon: LayoutGrid, label: "Categories", value: stats.categories, color: "from-violet-500 to-purple-500" },
    { icon: MapPin, label: "Cities", value: stats.cities, color: "from-slate-600 to-slate-800" },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-slate-950 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={BRAND_LOGO} className="h-9 w-9 rounded-xl" alt="" />
            <span className="font-display font-bold">Super Admin Console</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:block">{user.email || user.name}</span>
            <Button variant="secondary" size="sm" className="rounded-xl" onClick={logout}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl">Platform Overview</h1>
        <p className="text-muted-foreground">MakeMyEventPro · Hyderabad</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
              <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-2`}><c.icon className="h-4.5 w-4.5 text-white" /></div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="font-display font-extrabold text-2xl">{c.value}</div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="kyc" className="mt-8">
          <TabsList className="rounded-xl bg-muted flex-wrap h-auto">
            <TabsTrigger value="kyc" data-testid="admin-tab-kyc" className="rounded-lg">KYC Queue ({pending.length})</TabsTrigger>
            <TabsTrigger value="vendors" data-testid="admin-tab-vendors" className="rounded-lg">All Vendors</TabsTrigger>
            <TabsTrigger value="categories" data-testid="admin-tab-categories" className="rounded-lg">Categories & Themes</TabsTrigger>
            <TabsTrigger value="banners" data-testid="admin-tab-banners" className="rounded-lg">Banners</TabsTrigger>
          </TabsList>

          <TabsContent value="kyc" className="pt-5">
            {pending.length === 0 ? <p className="text-muted-foreground py-8 text-center">No vendors awaiting verification.</p> : (
              <div className="space-y-3" data-testid="kyc-queue">
                {pending.map((v) => (
                  <div key={v.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
                    <img src={v.cover} className="h-16 w-16 rounded-xl object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold">{v.business_name}</div>
                      <div className="text-sm text-muted-foreground">{v.category_name} · {v.area} · Completion {v.profile_completion}%</div>
                    </div>
                    <div className="flex gap-2">
                      <Button data-testid={`approve-${v.id}`} size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600" onClick={() => act(v.id, "approve")}><Check className="h-4 w-4 mr-1" /> Approve</Button>
                      <Button data-testid={`reject-${v.id}`} size="sm" variant="outline" className="rounded-xl text-red-500 border-red-200" onClick={() => act(v.id, "reject")}><X className="h-4 w-4 mr-1" /> Reject</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="vendors" className="pt-5">
            <div className="rounded-2xl border border-border bg-card overflow-x-auto" data-testid="admin-vendors-table">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Business</TableHead><TableHead>Category</TableHead><TableHead>Area</TableHead>
                  <TableHead>Status</TableHead><TableHead>Featured</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {vendors.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.business_name}</TableCell>
                      <TableCell>{v.category_name}</TableCell>
                      <TableCell>{v.area}</TableCell>
                      <TableCell><span className="px-2 py-1 rounded-full bg-muted text-xs font-semibold capitalize">{v.status}</span></TableCell>
                      <TableCell>{v.featured ? <Sparkles className="h-4 w-4 text-amber-500" /> : "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="rounded-lg text-xs h-8"
                          onClick={() => act(v.id, v.featured ? "unfeature" : "feature")}>
                          {v.featured ? "Unfeature" : "Feature"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="pt-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="admin-categories">
              {categories.map((c) => (
                <div key={c.slug} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="h-3" style={{ background: `linear-gradient(to right, ${c.theme?.accent}, #EC4899)` }} />
                  <div className="p-4">
                    <div className="font-display font-bold">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.subcategories?.length} subcategories · {c.amenities?.length} amenities</div>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="h-6 w-6 rounded-full border" style={{ background: c.theme?.accent }} />
                      <code className="text-xs text-muted-foreground">{c.theme?.accent}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="banners" className="pt-5">
            <div className="grid sm:grid-cols-2 gap-4" data-testid="admin-banners">
              {banners.map((b) => (
                <div key={b.id} className="rounded-2xl border border-border overflow-hidden relative h-32">
                  <img src={b.image} className="w-full h-full object-cover" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent p-4 flex flex-col justify-center">
                    <div className="text-white font-display font-bold text-sm">{b.title}</div>
                    <div className="text-white/80 text-xs mt-0.5">{b.city} · priority {b.priority}</div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
