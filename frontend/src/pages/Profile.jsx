import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Store, LogOut, Shield, MessageSquare, CalendarCheck, Heart, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";

export default function Profile() {
  const navigate = useNavigate();
  const { user, setAuthOpen, logout, refreshUser } = useAuth();
  const [f, setF] = useState({ name: "", email: "", city: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!user) setAuthOpen(true); else setF({ name: user.name || "", email: user.email || "", city: user.city || "" }); }, [user, setAuthOpen]);
  if (!user) return <Layout><div className="py-20 text-center text-muted-foreground">Login to view your profile.</div></Layout>;
  const save = async () => { setBusy(true); try { await api.put("/auth/me", f); await refreshUser(); toast.success("Profile updated"); } catch (e) { toast.error(e.response?.data?.detail || "Failed"); } finally { setBusy(false); } };
  const logoutAll = async () => { await api.post("/auth/logout-all"); logout(); toast.success("Logged out from all devices"); };
  const links = [
    { icon: MessageSquare, label: "My Enquiries", path: "/enquiries" }, { icon: CalendarCheck, label: "My Bookings", path: "/bookings" },
    { icon: Heart, label: "Favorites", path: "/favorites" },
    ...(user.role === "customer" ? [{ icon: Store, label: "Register your business", path: "/vendor/onboarding", accent: true }] : []),
    ...(["vendor", "vendor_staff"].includes(user.role) ? [{ icon: Store, label: "Vendor Dashboard", path: "/vendor", accent: true }] : []),
    ...(["admin", "super_admin", "content_manager", "support_manager", "finance_manager"].includes(user.role) ? [{ icon: Shield, label: "Admin Console", path: "/admin", accent: true }] : []),
  ];
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" data-testid="profile-page">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl flex items-center gap-2"><User className="h-6 w-6 text-purple-600" /> My Profile</h1>
        <p className="text-muted-foreground">+91 {user.phone} · <span className="capitalize">{user.role.replace("_", " ")}</span></p>
        <div className="grid sm:grid-cols-[1fr_260px] gap-6 mt-6">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input data-testid="profile-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input data-testid="profile-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label>City</Label><Input data-testid="profile-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="rounded-xl" /></div>
            <Button data-testid="profile-save-btn" onClick={save} disabled={busy} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button>
          </div>
          <div className="space-y-2">
            {links.map((l) => <button key={l.path} data-testid={`profile-link-${l.path.replace(/\//g, "-").slice(1)}`} onClick={() => navigate(l.path)} className={`w-full flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium hover:border-purple-300 ${l.accent ? "border-purple-300 bg-purple-50 dark:bg-purple-950/30 text-purple-700" : "border-border bg-card"}`}><l.icon className="h-4 w-4" /> {l.label}</button>)}
            <button data-testid="profile-logout-btn" onClick={logout} className="w-full flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-red-500"><LogOut className="h-4 w-4" /> Logout</button>
            <button data-testid="profile-logout-all-btn" onClick={logoutAll} className="w-full text-xs text-muted-foreground hover:text-foreground">Logout from all devices</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
