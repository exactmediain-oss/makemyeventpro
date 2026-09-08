import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { BRAND_LOGO } from "@/lib/constants";
import { toast } from "sonner";
import { Phone, ShieldCheck, Loader2 } from "lucide-react";

export default function AuthDialog() {
  const { authOpen, setAuthOpen, login } = useAuth();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => { setStep("phone"); setCode(""); setDemoOtp(""); };

  const sendOtp = async () => {
    if (!/^\d{10,13}$/.test(phone)) { toast.error("Enter a valid mobile number"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/send-otp", { phone });
      setDemoOtp(data.demo_otp);
      setStep("otp");
      toast.success("OTP sent", { description: `Demo OTP: ${data.demo_otp} (or 123456)` });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not send OTP");
    } finally { setLoading(false); }
  };

  const verify = async () => {
    if (code.length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { phone, code, name });
      login(data.token, data.user);
      toast.success(`Welcome, ${data.user.name}!`);
      reset();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Verification failed");
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={authOpen} onOpenChange={(o) => { setAuthOpen(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 rounded-3xl border-none p-0 overflow-hidden" data-testid="auth-dialog">
        <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-6 text-white">
          <img src={BRAND_LOGO} alt="MakeMyEventPro" className="h-12 w-12 rounded-2xl shadow-lg" />
          <DialogHeader className="mt-3 space-y-1">
            <DialogTitle className="text-2xl font-display font-extrabold text-white">
              {step === "phone" ? "Login / Sign up" : "Verify OTP"}
            </DialogTitle>
            <p className="text-white/85 text-sm">
              {step === "phone" ? "Continue with your mobile number" : `OTP sent to +91 ${phone}`}
            </p>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          {step === "phone" ? (
            <>
              <div className="space-y-2">
                <Label>Mobile number</Label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2.5 rounded-xl bg-muted text-sm font-semibold">+91</span>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input data-testid="auth-phone-input" value={phone} inputMode="numeric" maxLength={10}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder="9876543210" className="pl-9 rounded-xl" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Name <span className="text-muted-foreground">(optional)</span></Label>
                <Input data-testid="auth-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-xl" />
              </div>
              <Button data-testid="auth-send-otp-btn" onClick={sendOtp} disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 h-11 text-base font-semibold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Admin: 9999900001 · Vendor: 9999900002 · OTP 123456
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center py-2">
                <InputOTP maxLength={6} value={code} onChange={setCode} data-testid="auth-otp-input">
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} className="rounded-xl" />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {demoOtp && (
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl py-2">
                  <ShieldCheck className="h-4 w-4" /> Demo OTP: <b>{demoOtp}</b>
                </div>
              )}
              <Button data-testid="auth-verify-btn" onClick={verify} disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 h-11 text-base font-semibold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Continue"}
              </Button>
              <button data-testid="auth-change-number-btn" onClick={reset} className="w-full text-sm text-muted-foreground hover:text-foreground">
                Change number
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
