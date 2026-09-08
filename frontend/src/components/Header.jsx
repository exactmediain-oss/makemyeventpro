import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Bell, Heart, ChevronDown, Menu, LogOut, LayoutDashboard, Shield, CalendarHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { BRAND_LOGO, HYD_AREAS } from "@/lib/constants";

export default function Header() {
  const navigate = useNavigate();
  const { user, favorites, setAuthOpen, logout } = useAuth();
  const [area, setArea] = useState(localStorage.getItem("mmep_area") || "Jubilee Hills");
  const [q, setQ] = useState("");
  const [locOpen, setLocOpen] = useState(false);

  useEffect(() => { localStorage.setItem("mmep_area", area); }, [area]);

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const initials = (user?.name || "G").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 sm:h-20 flex items-center gap-3 sm:gap-5">
          <button data-testid="brand-logo" onClick={() => navigate("/")} className="flex items-center gap-2.5 shrink-0">
            <img src={BRAND_LOGO} alt="MakeMyEventPro" className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl shadow-md" />
            <span className="hidden sm:block font-display font-extrabold text-lg leading-none">
              MakeMy<span className="brand-gradient-text">Event</span>Pro
            </span>
          </button>

          <Popover open={locOpen} onOpenChange={setLocOpen}>
            <PopoverTrigger asChild>
              <button data-testid="location-selector" className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl hover:bg-muted transition-colors shrink-0">
                <MapPin className="h-4 w-4 text-pink-500" />
                <div className="text-left hidden xs:block">
                  <div className="text-[10px] text-muted-foreground leading-none">Hyderabad</div>
                  <div className="text-xs font-semibold leading-tight max-w-[90px] truncate">{area}</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 bg-white dark:bg-slate-900 rounded-2xl" align="start">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select area · Hyderabad</div>
              <div className="max-h-72 overflow-y-auto no-scrollbar">
                {HYD_AREAS.map((a) => (
                  <button key={a} data-testid={`area-option-${a.toLowerCase().replace(/\s+/g,"-")}`}
                    onClick={() => { setArea(a); setLocOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-muted transition-colors ${area === a ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 font-semibold" : ""}`}>
                    {a}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <form onSubmit={submitSearch} className="flex-1 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input data-testid="header-search-input" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search venues, photographers, caterers & more"
                className="pl-10 rounded-2xl bg-muted/60 border-transparent focus-visible:bg-white h-11" />
            </div>
          </form>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto md:ml-0">
            <Button data-testid="nav-favorites-btn" variant="ghost" size="icon" className="rounded-xl relative" onClick={() => navigate("/favorites")}>
              <Heart className="h-5 w-5" />
              {favorites.length > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center font-bold">{favorites.length}</span>}
            </Button>
            <Button data-testid="nav-notifications-btn" variant="ghost" size="icon" className="rounded-xl hidden sm:flex" onClick={() => navigate("/notifications")}>
              <Bell className="h-5 w-5" />
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="user-menu-btn" className="ml-1">
                    <Avatar className="h-9 w-9 border-2 border-purple-200">
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-500 text-white text-xs font-bold">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 rounded-2xl">
                  <div className="px-3 py-2">
                    <div className="font-semibold text-sm">{user.name}</div>
                    <div className="text-xs text-muted-foreground">+91 {user.phone} · {user.role}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-my-event" onClick={() => navigate("/my-event")} className="rounded-lg cursor-pointer">
                    <CalendarHeart className="h-4 w-4 mr-2" /> My Event Planner
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="menu-favorites" onClick={() => navigate("/favorites")} className="rounded-lg cursor-pointer">
                    <Heart className="h-4 w-4 mr-2" /> My Favorites
                  </DropdownMenuItem>
                  {(user.role === "vendor" || user.role === "vendor_staff") && (
                    <DropdownMenuItem data-testid="menu-vendor-dashboard" onClick={() => navigate("/vendor")} className="rounded-lg cursor-pointer">
                      <LayoutDashboard className="h-4 w-4 mr-2" /> Vendor Dashboard
                    </DropdownMenuItem>
                  )}
                  {["admin","super_admin","content_manager","support_manager","finance_manager"].includes(user.role) && (
                    <DropdownMenuItem data-testid="menu-admin-dashboard" onClick={() => navigate("/admin")} className="rounded-lg cursor-pointer">
                      <Shield className="h-4 w-4 mr-2" /> Admin Console
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-logout" onClick={logout} className="rounded-lg cursor-pointer text-red-500">
                    <LogOut className="h-4 w-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button data-testid="header-login-btn" onClick={() => setAuthOpen(true)}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 font-semibold">
                Login
              </Button>
            )}
          </div>
        </div>

        <form onSubmit={submitSearch} className="md:hidden pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input data-testid="header-search-input-mobile" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search venues, photographers & more"
              className="pl-10 rounded-2xl bg-muted/60 border-transparent h-11" />
          </div>
        </form>
      </div>
    </header>
  );
}
