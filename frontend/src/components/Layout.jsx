import { useNavigate, useLocation } from "react-router-dom";
import { Home, Compass, CalendarHeart, Heart, User } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthDialog from "@/components/AuthDialog";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Explore", path: "/search" },
  { icon: CalendarHeart, label: "My Event", path: "/my-event" },
  { icon: Heart, label: "Favorites", path: "/favorites" },
  { icon: User, label: "Profile", path: "/profile" },
];

export default function Layout({ children, hideFooter }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setAuthOpen } = useAuth();

  const handleNav = (item) => {
    if ((item.path === "/profile" || item.path === "/my-event" || item.path === "/favorites") && !user) {
      setAuthOpen(true);
      return;
    }
    navigate(item.path === "/profile" ? "/my-event" : item.path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      {!hideFooter && <Footer />}
      <AuthDialog />

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-border px-2 py-1.5 flex items-center justify-around md:hidden">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button key={item.label} data-testid={`bottomnav-${item.label.toLowerCase().replace(" ","-")}`}
              onClick={() => handleNav(item)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${active ? "text-purple-600" : "text-muted-foreground"}`}>
              <item.icon className={`h-5 w-5 ${active ? "fill-purple-100" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
