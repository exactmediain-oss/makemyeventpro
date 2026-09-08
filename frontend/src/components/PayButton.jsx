import { useState } from "react";
import { Loader2, CreditCard, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { formatINR } from "@/lib/constants";
import { toast } from "sonner";

const loadRazorpay = () => new Promise((res) => {
  if (window.Razorpay) return res(true);
  const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => res(true); s.onerror = () => res(false); document.body.appendChild(s);
});

export default function PayButton({ booking, type = "advance", config, demoEnabled, onPaid }) {
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState(null);
  const due = booking.total - booking.paid_amount;
  const amount = type === "advance" && booking.paid_amount === 0 ? Math.min(booking.advance_amount, due) : due;

  const applyCoupon = async () => {
    try { const { data } = await api.get(`/coupons/validate?code=${coupon}&amount=${amount}&category=${booking.category_slug || ""}`); setApplied(data); toast.success(`Coupon applied: -${formatINR(data.discount)}`); }
    catch (e) { setApplied(null); toast.error(e.response?.data?.detail || "Invalid coupon"); }
  };

  const pay = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/payments/create", { booking_id: booking.id, type, origin_url: window.location.origin, coupon_code: applied ? coupon : null });
      if (data.provider === "razorpay") {
        if (!(await loadRazorpay())) throw new Error("Razorpay SDK failed to load");
        new window.Razorpay({ ...data.razorpay, theme: { color: "#7C3AED" },
          handler: async (r) => {
            try { await api.post("/payments/razorpay/verify", { payment_id: data.payment_id, ...r }); toast.success("Payment successful!"); onPaid?.(); }
            catch (e) { toast.error(e.response?.data?.detail || "Verification failed"); }
          } }).open();
      } else if (data.provider === "stripe") {
        window.location.href = data.checkout_url;
      } else if (data.provider === "demo" && demoEnabled) {
        await api.post(`/payments/${data.payment_id}/demo-confirm`);
        toast.success("Demo payment recorded (no real gateway configured)"); onPaid?.();
      } else {
        toast.error("Payment gateway not configured");
      }
    } catch (e) { toast.error(e.response?.data?.detail || e.message || "Payment failed"); } finally { setBusy(false); }
  };

  const charge = amount - (applied?.discount || 0);
  return (
    <div className="space-y-3" data-testid="pay-section">
      <div className="flex gap-2">
        <div className="relative flex-1"><Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="coupon-input" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" className="pl-9 rounded-xl" /></div>
        <Button data-testid="coupon-apply-btn" variant="outline" className="rounded-xl" onClick={applyCoupon} disabled={!coupon}>Apply</Button>
      </div>
      <Button data-testid="pay-btn" onClick={pay} disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 h-12 text-base font-semibold">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-2" /> Pay {type === "advance" && booking.paid_amount === 0 ? "Advance" : "Balance"} {formatINR(Math.round(charge))}</>}
      </Button>
      <p className="text-[11px] text-center text-muted-foreground">
        {config?.provider === "razorpay" ? "Secured by Razorpay · UPI, Cards, Net Banking, Wallets" : config?.provider === "stripe" ? "Secured by Stripe" : demoEnabled ? "DEMO payments (no gateway keys configured)" : "Payment gateway pending configuration"}
      </p>
    </div>
  );
}
