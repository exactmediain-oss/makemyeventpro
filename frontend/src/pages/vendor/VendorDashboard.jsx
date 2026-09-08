import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FileText, Star, Eye, Package, Wrench, LogOut, Loader2, BadgeCheck, IndianRupee, CalendarCheck, Pencil, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/Quote";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { BRAND_LOGO, formatINR } from "@/lib/constants";
import { toast } from "sonner";
import AuthDialog from "@/components/AuthDialog";

export default function VendorDashboard() {
  const navigate = useNavigate();
  const { user, logout, setAuthOpen } = useAuth();
  const [stats, setStats] = useState(null); const [profile, setProfile] = useState(null);
  const [leads, setLeads] = useState([]); const [bookings, setBookings] = useState([]); const [payments, setPayments] = useState([]); const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true); const [noProfile, setNoProfile] = useState(false);

  const load = () => Promise.all([api.get("/vendor/stats"), api.get("/vendor/me"), api.get("/vendor/leads"), api.get("/vendor/bookings"), api.get("/vendor/payments"), api.get("/vendor/reviews")])
    .then(([s, p, l, b, pay, r]) => { setStats(s.data); setProfile(p.data); setLeads(l.data); setBookings(b.data); setPayments(pay.data); setReviews(r.data); })
    .catch(() => setNoProfile(true)).finally(() => setLoading(false));
  useEffect(() => { if (!user) { setAuthOpen(true); setLoading(false); return; } load(); }, [user, setAuthOpen]); // eslint-disable-line

  const setStatus = async (b, status) => {
    try { await api.post(`/bookings/${b.id}/status`, { status }); toast.success(`Booking ${status.replace("_", " ")}`); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const respond = async (r, text) => { await api.post(`/reviews/${r.id}/respond`, { response: text }); toast.success("Response posted"); load(); };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user || noProfile) return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center">
      <AuthDialog />
      <div>
        <Building2 className="h-12 w-12 mx-auto text-purple-500 mb-4" />
        <h2 className="font-display font-bold text-xl">{user ? "List your business on MakeMyEventPro" : "Vendor access required"}</h2>
        <p className="text-muted-foreground mt-1">{user ? "Complete the registration wizard and get verified." : "Login with your mobile number."}</p>
        <div className="flex gap-2 justify-center mt-5">
          {user ? <Button data-testid="start-onboarding-btn" onClick={() => navigate("/vendor/onboarding")} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Start registration</Button>
            : <Button onClick={() => setAuthOpen(true)} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Login</Button>}
          <Button variant="outline" onClick={() => navigate("/")} className="rounded-xl">Marketplace</Button>
        </div>
      </div>
    </div>
  );

  const cards = [
    { icon: Users, label: "Total Leads", value: stats.total_leads, color: "from-blue-500 to-indigo-500" },
    { icon: FileText, label: "New Leads", value: stats.new_leads, color: "from-pink-500 to-rose-500" },
    { icon: CalendarCheck, label: "Bookings", value: stats.confirmed_bookings, color: "from-emerald-500 to-teal-500" },
    { icon: IndianRupee, label: "Earnings", value: formatINR(stats.earnings), color: "from-amber-500 to-orange-500" },
    { icon: Star, label: "Rating", value: `${stats.rating || 0} ★`, color: "from-purple-500 to-fuchsia-500" },
    { icon: Eye, label: "Profile Views", value: (stats.profile_views || 0).toLocaleString("en-IN"), color: "from-cyan-500 to-blue-500" },
    { icon: Package, label: "Packages", value: stats.packages, color: "from-violet-500 to-purple-500" },
    { icon: Wrench, label: "Services", value: stats.services, color: "from-slate-600 to-slate-800" },
  ];
  const NEXT = { confirmed: ["in_progress", "cancelled"], in_progress: ["completed"], payment_pending: ["cancelled"] };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-white dark:bg-slate-900 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2"><img src={BRAND_LOGO} className="h-9 w-9 rounded-xl" alt="" /><span className="font-display font-bold">Vendor Portal</span></button>
          <div className="flex items-center gap-2">
            <Button data-testid="edit-listing-btn" variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/vendor/onboarding")}><Pencil className="h-4 w-4 mr-1" /> Edit listing</Button>
            {profile.slug && profile.status === "approved" && <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => navigate(`/vendor/${profile.slug}`)}>View public</Button>}
            <Button variant="outline" size="sm" className="rounded-xl" onClick={logout}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground">{profile.business_name} · {profile.area}, {profile.city}</p>

        <div className="rounded-2xl border border-border bg-card p-5 mt-6 flex flex-col sm:flex-row sm:items-center gap-4" data-testid="vendor-status-card">
          <div className="flex items-center gap-2">
            {profile.verified && profile.status === "approved" ? <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center gap-1"><BadgeCheck className="h-4 w-4" /> Verified Vendor</span> : <StatusBadge status={profile.status} />}
          </div>
          <div className="flex-1"><div className="flex justify-between text-sm mb-1"><span className="font-semibold">Profile completion</span><span className="text-purple-600 font-bold">{stats.profile_completion}%</span></div><Progress value={stats.profile_completion} className="h-2.5" /></div>
          {["draft", "corrections_requested", "rejected"].includes(profile.status) && <Button size="sm" className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500" onClick={() => navigate("/vendor/onboarding")}>{profile.status === "draft" ? "Complete & submit" : "Fix & resubmit"}</Button>}
        </div>
        {profile.admin_note && <div className="rounded-2xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 p-4 text-sm mt-3"><b>Message from verification team:</b> {profile.admin_note}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {cards.map((c) => <div key={c.label} className="rounded-2xl border border-border bg-card p-4"><div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-2`}><c.icon className="h-4 w-4 text-white" /></div><div className="text-xs text-muted-foreground">{c.label}</div><div className="font-display font-extrabold text-lg">{c.value}</div></div>)}
        </div>

        <Tabs defaultValue="leads" className="mt-8">
          <TabsList className="rounded-xl bg-muted flex-wrap h-auto">
            <TabsTrigger value="leads" data-testid="vendor-tab-leads" className="rounded-lg">Leads ({leads.length})</TabsTrigger>
            <TabsTrigger value="bookings" data-testid="vendor-tab-bookings" className="rounded-lg">Bookings ({bookings.length})</TabsTrigger>
            <TabsTrigger value="payments" data-testid="vendor-tab-payments" className="rounded-lg">Payments</TabsTrigger>
            <TabsTrigger value="reviews" data-testid="vendor-tab-reviews" className="rounded-lg">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="pt-5">
            <div className="rounded-2xl border border-border bg-card overflow-x-auto" data-testid="vendor-leads-table">
              {leads.length === 0 ? <div className="text-center py-16 text-muted-foreground">No leads yet. They'll appear here when customers enquire.</div> : (
                <Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Event</TableHead><TableHead>Date</TableHead><TableHead>Guests</TableHead><TableHead>Budget</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>{leads.map((l) => (
                    <TableRow key={l.id} data-testid={`lead-row-${l.id}`}>
                      <TableCell className="font-medium">{l.customer_name || "Customer"}{l.unread_vendor > 0 && <span className="ml-2 h-5 min-w-5 px-1.5 rounded-full bg-pink-500 text-white text-[11px] font-bold inline-flex items-center justify-center">{l.unread_vendor}</span>}</TableCell>
                      <TableCell>{l.event_type}</TableCell><TableCell>{l.event_date || "—"}</TableCell><TableCell>{l.guests || "—"}</TableCell><TableCell>{l.budget ? formatINR(l.budget) : "—"}</TableCell>
                      <TableCell><StatusBadge status={l.status} /></TableCell>
                      <TableCell><Button data-testid={`lead-open-${l.id}`} size="sm" className="rounded-lg h-8" onClick={() => navigate(`/vendor/leads/${l.id}`)}>Open</Button></TableCell>
                    </TableRow>))}</TableBody></Table>)}
            </div>
          </TabsContent>

          <TabsContent value="bookings" className="pt-5">
            <div className="rounded-2xl border border-border bg-card overflow-x-auto" data-testid="vendor-bookings-table">
              {bookings.length === 0 ? <div className="text-center py-16 text-muted-foreground">No bookings yet.</div> : (
                <Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Customer</TableHead><TableHead>Event</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead><TableHead>Update</TableHead></TableRow></TableHeader>
                  <TableBody>{bookings.map((b) => (
                    <TableRow key={b.id} data-testid={`vendor-booking-${b.id}`}>
                      <TableCell className="font-mono text-xs">{b.code}</TableCell><TableCell>{b.customer_name}<div className="text-xs text-muted-foreground">+91 {b.customer_phone}</div></TableCell>
                      <TableCell>{b.event_type}<div className="text-xs text-muted-foreground">{b.event_date}</div></TableCell><TableCell>{formatINR(b.total)}</TableCell><TableCell className="text-emerald-600">{formatINR(b.paid_amount)}</TableCell>
                      <TableCell><StatusBadge status={b.status} /></TableCell>
                      <TableCell><div className="flex gap-1">{(NEXT[b.status] || []).map((s) => <Button key={s} data-testid={`booking-${s}-${b.id}`} size="sm" variant={s === "cancelled" ? "outline" : "default"} className="rounded-lg h-8 text-xs capitalize" onClick={() => setStatus(b, s)}>{s.replace("_", " ")}</Button>)}</div></TableCell>
                    </TableRow>))}</TableBody></Table>)}
            </div>
          </TabsContent>

          <TabsContent value="payments" className="pt-5">
            <div className="rounded-2xl border border-border bg-card overflow-x-auto" data-testid="vendor-payments-table">
              {payments.length === 0 ? <div className="text-center py-16 text-muted-foreground">No payments yet.</div> : (
                <Table><TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Type</TableHead><TableHead>Gross</TableHead><TableHead>Commission</TableHead><TableHead>Your earnings</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                  <TableBody>{payments.map((p) => <TableRow key={p.id}><TableCell className="font-mono text-xs">{p.booking_code}</TableCell><TableCell className="capitalize">{p.type}</TableCell><TableCell>{formatINR(p.gross_amount)}</TableCell><TableCell className="text-red-500">-{formatINR(p.commission)}</TableCell><TableCell className="font-bold text-emerald-600">{formatINR(p.vendor_amount)}</TableCell><TableCell><StatusBadge status={p.status} /></TableCell><TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString("en-IN")}</TableCell></TableRow>)}</TableBody></Table>)}
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="pt-5 space-y-3" data-testid="vendor-reviews">
            {reviews.length === 0 && <div className="text-center py-16 text-muted-foreground rounded-2xl border border-border bg-card">No reviews yet.</div>}
            {reviews.map((r) => <ReviewRow key={r.id} r={r} onRespond={respond} />)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ReviewRow({ r, onRespond }) {
  const [t, setT] = useState("");
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex justify-between items-center"><span className="font-semibold">{r.name} · {r.rating}★</span><StatusBadge status={r.status} /></div>
      <p className="text-sm text-muted-foreground mt-1">{r.text}</p>
      {r.response ? <p className="text-sm mt-2 pl-3 border-l-2 border-purple-300"><b>Your reply:</b> {r.response}</p> : (
        <div className="flex gap-2 mt-3"><Textarea value={t} onChange={(e) => setT(e.target.value)} placeholder="Reply publicly…" className="rounded-xl min-h-10" /><Button size="sm" className="rounded-xl" disabled={!t} onClick={() => onRespond(r, t)}>Reply</Button></div>)}
    </div>
  );
}
