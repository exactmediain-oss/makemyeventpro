import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

export default function PaymentSuccess() {
  const [sp] = useSearchParams(); const navigate = useNavigate();
  const pid = sp.get("payment_id");
  const [st, setSt] = useState(null); const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!pid) return;
    const t = setTimeout(() => api.get(`/payments/status/${pid}`).then((r) => { setSt(r.data); if (r.data.status !== "paid" && tries < 6) setTries(tries + 1); }).catch(() => setSt({ status: "error" })), tries ? 2000 : 0);
    return () => clearTimeout(t);
  }, [pid, tries]);
  const paid = st?.status === "paid";
  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-20 text-center" data-testid="payment-result">
        {!st || (!paid && tries < 6) ? <Loader2 className="h-10 w-10 animate-spin mx-auto text-purple-600" /> : paid ? <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" /> : <XCircle className="h-14 w-14 text-red-500 mx-auto" />}
        <h1 className="font-display font-extrabold text-2xl mt-4">{paid ? "Payment successful" : st && tries >= 6 ? "Payment not confirmed yet" : "Confirming payment…"}</h1>
        <p className="text-muted-foreground mt-1">{paid ? "Your booking is confirmed." : "If you were charged, it will reflect shortly."}</p>
        {st?.booking_id && <Button className="mt-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500" onClick={() => navigate(`/bookings/${st.booking_id}`)}>View booking</Button>}
      </div>
    </Layout>
  );
}
