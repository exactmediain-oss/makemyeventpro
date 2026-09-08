import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, ArrowRight, TrendingUp, ShieldCheck, CreditCard, LayoutDashboard, Users, BadgeCheck, CalendarCheck, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthDialog from "@/components/AuthDialog";
import { useAuth } from "@/context/AuthContext";
import { BRAND_LOGO } from "@/lib/constants";

const HERO_IMG = "https://images.unsplash.com/photo-1529327158926-6f892ed3ab73?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";

const BENEFITS = [
  { icon: Users, t: "Quality leads", d: "Get matched with customers actively looking for your services in your area." },
  { icon: BadgeCheck, t: "Verified badge", d: "Stand out with a trusted, admin-verified business profile." },
  { icon: CreditCard, t: "Secure payments", d: "Receive advance & balance payments securely with transparent commissions." },
  { icon: LayoutDashboard, t: "Powerful dashboard", d: "Manage leads, quotes, bookings, calendar, earnings and reviews in one place." },
];

const STEPS = [
  { icon: Store, t: "Register", d: "Create your business profile with photos, services, pricing and locations." },
  { icon: ShieldCheck, t: "Get verified", d: "Submit KYC documents. Our team reviews and approves your listing." },
  { icon: Bell, t: "Receive leads", d: "Customers enquire, you send quotes and confirm bookings." },
  { icon: CalendarCheck, t: "Grow & get paid", d: "Deliver great events, earn payouts and collect verified reviews." },
];

export default function VendorLanding() {
  const navigate = useNavigate();
  const { user, setAuthOpen } = useAuth();
  const isVendor = user && ["vendor", "vendor_staff"].includes(user.role);

  const startRegistration = () => navigate("/vendor/onboarding");
  const vendorLogin = () => {
    if (isVendor) navigate("/vendor");
    else if (user) navigate("/vendor/onboarding");
    else setAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950" data-testid="vendor-landing">
      {/* Vendor-branded top bar (separate from customer marketplace header) */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button data-testid="vendor-landing-logo" onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <img src={BRAND_LOGO} alt="MakeMyEventPro" className="h-10 w-10 rounded-xl shadow-md" />
            <span className="font-display font-extrabold text-lg leading-none">MakeMy<span className="brand-gradient-text">Event</span>Pro <span className="text-muted-foreground font-semibold text-sm">· Vendors</span></span>
          </button>
          <div className="flex items-center gap-2">
            <Button data-testid="vendor-landing-marketplace-btn" variant="ghost" className="rounded-xl hidden sm:flex" onClick={() => navigate("/")}>Marketplace</Button>
            <Button data-testid="vendor-landing-login-btn" variant="outline" className="rounded-xl font-semibold" onClick={vendorLogin}>{isVendor ? "Vendor Dashboard" : "Already a Vendor? Login"}</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0"><img src={HERO_IMG} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-purple-950/80 to-pink-900/70" /></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-white">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-sm font-semibold mb-5"><TrendingUp className="h-4 w-4" /> For event professionals</span>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-tight">Grow Your Event Business with MakeMyEventPro</h1>
            <p className="text-white/85 text-base sm:text-lg mt-5 max-w-xl">Join thousands of customers looking for trusted event professionals. List your business, receive quality leads and manage bookings — all in one place.</p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Button data-testid="start-vendor-registration-btn" onClick={startRegistration} className="rounded-xl h-12 px-7 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90">Start Your Vendor Registration <ArrowRight className="h-4 w-4 ml-2" /></Button>
              <Button data-testid="hero-vendor-login-btn" onClick={vendorLogin} variant="outline" className="rounded-xl h-12 px-7 text-base font-semibold bg-white/10 border-white/40 text-white hover:bg-white/20">{isVendor ? "Go to Dashboard" : "Already a Vendor? Login"}</Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-center">Why sell on MakeMyEventPro</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
          {BENEFITS.map((b, i) => (
            <motion.div key={b.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-card p-6" data-testid={`vendor-benefit-${i}`}>
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center mb-4"><b.icon className="h-6 w-6 text-white" /></div>
              <div className="font-display font-bold text-lg">{b.t}</div>
              <p className="text-sm text-muted-foreground mt-1.5">{b.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works for vendors */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500" data-testid="vendor-how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-white">
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-center">How it works</h2>
          <div className="grid sm:grid-cols-4 gap-6 mt-10">
            {STEPS.map((s, i) => (
              <motion.div key={s.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mx-auto mb-4"><s.icon className="h-6 w-6" /></div>
                <div className="font-display font-bold text-lg">{i + 1}. {s.t}</div>
                <p className="text-white/80 text-sm mt-1.5">{s.d}</p>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-white/80 text-sm mt-10">Your listing goes live in the marketplace only after admin approval.</p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl">Ready to grow your business?</h2>
        <p className="text-muted-foreground mt-2">Set up your profile in minutes. It's free to list.</p>
        <Button data-testid="bottom-vendor-registration-btn" onClick={startRegistration} className="rounded-xl h-12 px-8 mt-6 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90">Start Your Vendor Registration <ArrowRight className="h-4 w-4 ml-2" /></Button>
      </section>

      <AuthDialog />
    </div>
  );
}
