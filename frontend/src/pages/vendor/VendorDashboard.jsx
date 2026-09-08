import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, CalendarCheck, Star, TrendingUp, Eye,
  Package, Wrench, LogOut, Loader2, BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { BRAND_LOGO, formatINR } from "@/lib/constants";

export default function VendorDashboard() {
  const navigate = useNavigate();
  const { user, logout, setAuthOpen } = useAuth();
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!user) { setAuthOpen(true); setLoading(false); return; }
    Promise.all([api.get("/vendor/stats"), api.get("/vendor/me"), api.get("/vendor/leads")])
      .then(([s, p, l]) => { setStats(s.data); setProfile(p.data); setLeads(l.data); })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [user, setAuthOpen]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user || err) return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center">
      <div>
        <LayoutDashboard className="h-12 w-12 mx-auto text-purple-500 mb-4" />
        <h2 className="font-display font-bold text-xl">Vendor access required</h2>
        <p className="text-muted-foreground mt-1">Login with a vendor account (demo: 9999900002 · OTP 123456).</p>
        <div className="flex gap-2 justify-center mt-5">
          <Button onClick={() => setAuthOpen(true)} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Login</Button>
          <Button variant="outline" onClick={() => navigate("/")} className="rounded-xl">Back to Marketplace</Button>
        </div>
      </div>
    </div>
  );

  const cards = [
    { icon: Users, label: "Total Leads", value: stats.total_leads, color: "from-blue-500 to-indigo-500" },
    { icon: FileText, label: "New Leads", value: stats.new_leads, color: "from-pink-500 to-rose-500" },
    { icon: Star, label: "Rating", value: `${stats.rating} ★`, color: "from-amber-500 to-orange-500" },
    { icon: Eye, label: "Profile Views", value: stats.profile_views?.toLocaleString("en-IN"), color: "from-emerald-500 to-teal-500" },
    { icon: Package, label: "Packages", value: stats.packages, color: "from-purple-500 to-fuchsia-500" },
    { icon: Wrench, label: "Services", value: stats.services, color: "from-cyan-500 to-blue-500" },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-white dark:bg-slate-900 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={BRAND_LOGO} className="h-9 w-9 rounded-xl" alt="" />
            <span className="font-display font-bold">Vendor Portal</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium hidden sm:block">{profile?.business_name}</span>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={logout}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl">Welcome back, {user.name.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground">{profile?.business_name} · {profile?.area}, Hyderabad</p>

        <div className="rounded-2xl border border-border bg-card p-5 mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            {profile?.verified ? (
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center gap-1"><BadgeCheck className="h-4 w-4" /> Verified Vendor</span>
            ) : <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-bold">Under Review</span>}
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1"><span className="font-semibold">Profile completion</span><span className="text-purple-600 font-bold">{stats.profile_completion}%</span></div>
            <Progress value={stats.profile_completion} className="h-2.5" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mt-6">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
              <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-2`}><c.icon className="h-4.5 w-4.5 text-white" /></div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="font-display font-extrabold text-lg">{c.value}</div>
            </div>
          ))}
        </div>

        <h2 className="font-display font-bold text-xl mt-10 mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-purple-600" /> Lead Pipeline</h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden" data-testid="vendor-leads-table">
          {leads.length === 0 ? (
            <div className="text-center py-16"><div className="text-4xl mb-3">📭</div><p className="text-muted-foreground">No leads yet. They'll appear here when customers enquire.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead><TableHead>Event</TableHead><TableHead>Date</TableHead>
                    <TableHead>Guests</TableHead><TableHead>Budget</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.customer_name || "Customer"}</TableCell>
                      <TableCell>{l.event_type}</TableCell>
                      <TableCell>{l.event_date || "—"}</TableCell>
                      <TableCell>{l.guests || "—"}</TableCell>
                      <TableCell>{l.budget ? formatINR(l.budget) : "—"}</TableCell>
                      <TableCell><span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold capitalize">{l.status}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
