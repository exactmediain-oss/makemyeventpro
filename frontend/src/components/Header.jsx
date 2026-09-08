import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Bell, Heart, ChevronDown, LogOut, LayoutDashboard, Shield, CalendarHeart, Crosshair, Loader2, MessageSquare, CalendarCheck, Store, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { useLocationCtx } from "@/context/LocationContext";
import { useCategoryTheme } from "@/context/CategoryThemeContext";
import { BRAND_LOGO } from "@/lib/constants";
import api from "@/lib/api";
import { toast } from "sonner";

const ADMIN = ["admin", "super_admin", "content_manager", "support_manager", "finance_manager"];

export default function Header() {
  const navigate = useNavigate();
  const { user, favorites, setAuthOpen, logout } = useAuth();
  const { loc, areas, selectArea, locateMe, gpsLoading } = useLocationCtx();
  const { theme, themed } = useCategoryTheme();
  const onDark = themed;
  const txt = onDark ? "text-white" : "";
  const hoverBg = onDark ? "hover:bg-white/15" : "hover:bg-muted";
  const [q, setQ] = useState("");
  const [locQ, setLocQ] = useState("");
  const [locResults, setLocResults] = useState([]);
  const [locOpen, setLocOpen] = useState(false);

  useEffect(() => {
    if (locQ.length < 2) { setLocResults([]); return; }
    const t = setTimeout(() => api.get(`/locations/search?q=${encodeURIComponent(locQ)}`).then((r) => setLocResults(r.data)), 250);
    return () => clearTimeout(t);
  }, [locQ]);

  const pickResult = (r) => {
    if (r.type === "area") selectArea(r.name, r.parent_name);
    else if (r.type === "pincode") selectArea(r.parent_name);
    else if (r.type === "city") selectArea(areas[0]?.name || "", r.name);
    setLocOpen(false); setLocQ("");
  };
  const gps = async () => { try { const d = await locateMe(); toast.success(`Location set to ${d.area.name}`); setLocOpen(false); } catch (e) { toast.error("Could not get GPS location"); } };
  const submitSearch = (e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); };
  const initials = (user?.name || "G").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const Item = ({ id, icon: Icon, label, path, cls = "" }) => <DropdownMenuItem data-testid={id} onClick={() => navigate(path)} className={`rounded-lg cursor-pointer ${cls}`}><Icon className="h-4 w-4 mr-2" /> {label}</DropdownMenuItem>;

  return (
    <header data-testid="main-header" data-themed={onDark} className={`sticky top-0 z-50 backdrop-blur-xl border-b shadow-sm transition-colors duration-300 ${onDark ? "border-white/10 text-white" : "bg-white/85 dark:bg-slate-900/85 border-border"}`} style={onDark ? { background: theme.header_color } : {}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 sm:h-20 flex items-center gap-3 sm:gap-5">
          <button data-testid="brand-logo" onClick={() => navigate("/")} className="flex items-center gap-2.5 shrink-0">
            <img src={BRAND_LOGO} alt="MakeMyEventPro" className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl shadow-md" />
            <span className={`hidden sm:block font-display font-extrabold text-lg leading-none ${txt}`}>MakeMy<span className={onDark ? "text-white/80" : "brand-gradient-text"}>Event</span>Pro</span>
          </button>

          <Popover open={locOpen} onOpenChange={setLocOpen}>
            <PopoverTrigger asChild>
              <button data-testid="location-selector" className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl ${hoverBg} transition-colors shrink-0 ${txt}`}>
                <MapPin className={`h-4 w-4 ${onDark ? "text-white" : "text-pink-500"}`} />
                <div className="text-left hidden xs:block">
                  <div className={`text-[10px] leading-none ${onDark ? "text-white/75" : "text-muted-foreground"}`}>{loc.city}</div>
                  <div className="text-xs font-semibold leading-tight max-w-[90px] truncate">{loc.area}</div>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 ${onDark ? "text-white/75" : "text-muted-foreground"}`} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2 bg-white dark:bg-slate-900 rounded-2xl" align="start">
              <button data-testid="use-gps-btn" onClick={gps} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40">
                {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Use my current location
              </button>
              <Input data-testid="location-search-input" value={locQ} onChange={(e) => setLocQ(e.target.value)} placeholder="Search area, city or pincode" className="rounded-xl h-9 my-1.5" />
              {locResults.length > 0 && <div className="border-b border-border pb-1 mb-1">{locResults.map((r) => (
                <button key={r.id} data-testid={`loc-result-${r.slug}`} onClick={() => pickResult(r)} className="w-full text-left px-3 py-1.5 rounded-xl text-sm hover:bg-muted">{r.name} <span className="text-xs text-muted-foreground">· {r.type}{r.parent_name ? ` · ${r.parent_name}` : ""}</span></button>))}</div>}
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Areas · {loc.city}</div>
              <div className="max-h-56 overflow-y-auto no-scrollbar">
                {areas.map((a) => (
                  <button key={a.id} data-testid={`area-option-${a.slug}`} onClick={() => { selectArea(a.name); setLocOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-muted transition-colors ${loc.area === a.name ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 font-semibold" : ""}`}>
                    {a.name} <span className="text-[10px] text-muted-foreground">{a.pincode}</span>
                  </button>))}
              </div>
            </PopoverContent>
          </Popover>

          <form onSubmit={submitSearch} className="flex-1 hidden md:block">
            <div className="relative">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${onDark ? "text-white/80" : "text-muted-foreground"}`} />
              <Input data-testid="header-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search venues, photographers, caterers & more" className={`pl-10 rounded-2xl h-11 border-transparent ${onDark ? "bg-white/15 text-white placeholder:text-white/70 focus-visible:bg-white/25" : "bg-muted/60 focus-visible:bg-white"}`} />
            </div>
          </form>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto md:ml-0">
            <Button data-testid="nav-favorites-btn" variant="ghost" size="icon" className={`rounded-xl relative ${txt} ${hoverBg}`} onClick={() => navigate("/favorites")}>
              <Heart className="h-5 w-5" />
              {favorites.length > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center font-bold">{favorites.length}</span>}
            </Button>
            <Button data-testid="nav-notifications-btn" variant="ghost" size="icon" className={`rounded-xl hidden sm:flex ${txt} ${hoverBg}`} onClick={() => navigate("/notifications")}><Bell className="h-5 w-5" /></Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="user-menu-btn" className="ml-1"><Avatar className={`h-9 w-9 border-2 ${onDark ? "border-white/70" : "border-purple-200"}`}><AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-500 text-white text-xs font-bold">{initials}</AvatarFallback></Avatar></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 rounded-2xl">
                  <div className="px-3 py-2"><div className="font-semibold text-sm">{user.name}</div><div className="text-xs text-muted-foreground">+91 {user.phone} · {user.role}</div></div>
                  <DropdownMenuSeparator />
                  <Item id="menu-profile" icon={User} label="My Profile" path="/profile" />
                  <Item id="menu-enquiries" icon={MessageSquare} label="My Enquiries" path="/enquiries" />
                  <Item id="menu-bookings" icon={CalendarCheck} label="My Bookings" path="/bookings" />
                  <Item id="menu-my-event" icon={CalendarHeart} label="My Event Planner" path="/my-event" />
                  <Item id="menu-favorites" icon={Heart} label="My Favorites" path="/favorites" />
                  {user.role === "customer" && <Item id="menu-become-vendor" icon={Store} label="Join as Vendor" path="/vendor/join" cls="text-purple-600" />}
                  {["vendor", "vendor_staff"].includes(user.role) && <Item id="menu-vendor-dashboard" icon={LayoutDashboard} label="Vendor Dashboard" path="/vendor" />}
                  {ADMIN.includes(user.role) && <Item id="menu-admin-dashboard" icon={Shield} label="Admin Console" path="/admin" />}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-logout" onClick={logout} className="rounded-lg cursor-pointer text-red-500"><LogOut className="h-4 w-4 mr-2" /> Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button data-testid="header-vendor-cta" variant="ghost" className={`rounded-xl font-semibold px-2 sm:px-3 ${onDark ? "text-white " + hoverBg : "text-purple-600"}`} onClick={() => navigate("/vendor/join")}><Store className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Join as Vendor</span></Button>
                <Button data-testid="header-login-btn" onClick={() => setAuthOpen(true)} className={`rounded-xl font-semibold hover:opacity-90 ${onDark ? "bg-white hover:bg-white" : "bg-gradient-to-r from-purple-600 to-pink-500"}`} style={onDark ? { color: theme.accent } : {}}>Login</Button>
              </>
            )}
          </div>
        </div>

        <form onSubmit={submitSearch} className="md:hidden pb-3">
          <div className="relative">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${onDark ? "text-white/80" : "text-muted-foreground"}`} />
            <Input data-testid="header-search-input-mobile" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search venues, photographers & more" className={`pl-10 rounded-2xl h-11 border-transparent ${onDark ? "bg-white/15 text-white placeholder:text-white/70" : "bg-muted/60"}`} />
          </div>
        </form>
      </div>
    </header>
  );
}
