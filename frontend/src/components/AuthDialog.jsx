import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { BRAND_LOGO } from "@/lib/constants";
import { firebaseConfigured, firebaseSendOtp } from "@/lib/firebase";
import { toast } from "sonner";
import { Phone, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

export default function AuthDialog() {
  const { authOpen, setAuthOpen, login } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [step, setStep] = useState("phone");
  const [mode, setMode] = useState("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { if (authOpen && !cfg) api.get("/auth/config").then((r) => setCfg(r.data)).catch(() => setCfg({ provider: "demo" })); }, [authOpen, cfg]);
  useEffect(() => { if (cooldown > 0) { const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); } }, [cooldown]);

  const useFirebase = cfg?.provider === "firebase";
  const reset = () => { setStep("phone"); setCode(""); setDemoOtp(""); setConfirmation(null); };

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) { toast.error("Enter a valid 10-digit mobile number"); return; }
    if (mode === "signup" && name.trim().length < 2) { toast.error("Please enter your name to create an account"); return; }
    setLoading(true);
    try {
      if (useFirebase) {
        if (!firebaseConfigured()) { toast.error("Firebase web config missing (REACT_APP_FIREBASE_*)"); return; }
        const conf = await firebaseSendOtp(phone);
        setConfirmation(conf);
      } else {
        const { data } = await api.post("/auth/send-otp", { phone });
        if (data.demo_otp) { setDemoOtp(data.demo_otp); toast.success("OTP sent (demo)", { description: `Demo OTP: ${data.demo_otp}` }); }
        else toast.success("OTP sent to your mobile");
      }
      setStep("otp"); setCooldown(30);
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || "Could not send OTP");
    } finally { setLoading(false); }
  };

  const verify = async () => {
    if (code.length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
    setLoading(true);
    try {
      let data;
      if (useFirebase) {
        const cred = await confirmation.confirm(code);
        const idToken = await cred.user.getIdToken();
        ({ data } = await api.post("/auth/firebase-verify", { id_token: idToken, name }));
      } else {
        ({ data } = await api.post("/auth/verify-otp", { phone, code, name }));
      }
      login(data.token, data.user);
      toast.success(`Welcome, ${data.user.name}!`);
      reset();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || "Verification failed");
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={authOpen} onOpenChange={(o) => { setAuthOpen(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 rounded-3xl border-none p-0 overflow-hidden" data-testid="auth-dialog">
        <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-6 text-white">
          <img src={BRAND_LOGO} alt="MakeMyEventPro" className="h-12 w-12 rounded-2xl shadow-lg" />
          <DialogHeader className="mt-3 space-y-1">
            <DialogTitle className="text-2xl font-display font-extrabold text-white">{step === "phone" ? (mode === "signup" ? "Create Account" : "Login") : "Verify OTP"}</DialogTitle>
            <p className="text-white/85 text-sm">{step === "phone" ? (mode === "signup" ? "Sign up with your mobile number" : "Welcome back — continue with your mobile") : `OTP sent to +91 ${phone}`}</p>
          </DialogHeader>
        </div>
        <div id="recaptcha-container" />
        <div className="p-6 space-y-4">
          {step === "phone" ? (
            <>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted" data-testid="auth-mode-toggle">
                <button type="button" data-testid="auth-mode-login" onClick={() => setMode("login")} className={`rounded-lg py-2 text-sm font-semibold transition-colors ${mode === "login" ? "bg-white dark:bg-slate-800 shadow text-purple-600" : "text-muted-foreground"}`}>Login</button>
                <button type="button" data-testid="auth-mode-signup" onClick={() => setMode("signup")} className={`rounded-lg py-2 text-sm font-semibold transition-colors ${mode === "signup" ? "bg-white dark:bg-slate-800 shadow text-purple-600" : "text-muted-foreground"}`}>Create Account</button>
              </div>
              <div className="space-y-2">
                <Label>Mobile number</Label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2.5 rounded-xl bg-muted text-sm font-semibold">+91</span>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input data-testid="auth-phone-input" value={phone} inputMode="numeric" maxLength={10}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="9876543210" className="pl-9 rounded-xl" />
                  </div>
                </div>
              </div>
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label>Your name <span className="text-pink-500">*</span></Label>
                  <Input data-testid="auth-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="rounded-xl" />
                </div>
              )}
              <Button data-testid="auth-send-otp-btn" onClick={sendOtp} disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 h-11 text-base font-semibold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === "signup" ? "Create account · Send OTP" : "Send OTP")}
              </Button>
              {cfg?.demo_enabled && (
                <p data-testid="auth-demo-notice" className="text-xs text-center text-amber-600 flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Demo mode: OTP shown on screen · universal 123456
                </p>
              )}
              <p className="text-[11px] text-center text-muted-foreground">By continuing you agree to our Terms & Privacy Policy.</p>
            </>
          ) : (
            <>
              <div className="flex justify-center py-2">
                <InputOTP maxLength={6} value={code} onChange={setCode} data-testid="auth-otp-input">
                  <InputOTPGroup>{[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} className="rounded-xl" />)}</InputOTPGroup>
                </InputOTP>
              </div>
              {demoOtp && (
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl py-2">
                  <ShieldCheck className="h-4 w-4" /> Demo OTP: <b data-testid="auth-demo-otp">{demoOtp}</b>
                </div>
              )}
              <Button data-testid="auth-verify-btn" onClick={verify} disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 h-11 text-base font-semibold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Continue"}
              </Button>
              <div className="flex justify-between text-sm">
                <button data-testid="auth-change-number-btn" onClick={reset} className="text-muted-foreground hover:text-foreground">Change number</button>
                <button data-testid="auth-resend-btn" disabled={cooldown > 0} onClick={sendOtp} className="text-purple-600 font-medium disabled:text-muted-foreground">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
