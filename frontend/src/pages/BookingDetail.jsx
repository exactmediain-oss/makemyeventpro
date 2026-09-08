import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Receipt, Star, Loader2, Printer, Ban } from "lucide-react";
import Layout from "@/components/Layout";
import PayButton from "@/components/PayButton";
import { StatusBadge } from "@/components/Quote";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { formatINR } from "@/lib/constants";
import { toast } from "sonner";

function ReviewForm({ bookingId, onDone }) {
  const [rating, setRating] = useState(5); const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (text.length < 5) { toast.error("Write a few words"); return; }
    setBusy(true);
    try { await api.post("/reviews", { booking_id: bookingId, rating, text }); toast.success("Review submitted for moderation"); onDone(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3" data-testid="review-form">
      <h3 className="font-display font-bold">Rate your experience</h3>
      <div className="flex gap-1">{[1,2,3,4,5].map((n) => <button key={n} data-testid={`rating-star-${n}`} onClick={() => setRating(n)}><Star className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} /></button>)}</div>
      <Textarea data-testid="review-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="How was the vendor?" className="rounded-xl" />
      <Button data-testid="review-submit-btn" onClick={submit} disabled={busy} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Review"}</Button>
    </div>
  );
}

function Invoice({ bookingId }) {
  const [inv, setInv] = useState(null);
  useEffect(() => { api.get(`/bookings/${bookingId}/invoice`).then((r) => setInv(r.data)); }, [bookingId]);
  if (!inv) return <Loader2 className="h-5 w-5 animate-spin mx-auto" />;
  const b = inv.booking;
  return (
    <div className="text-sm space-y-3 print:text-black" data-testid="invoice">
      <div className="flex justify-between"><div><div className="font-display font-extrabold text-lg">MakeMyEventPro</div><div className="text-muted-foreground">{inv.platform.email}</div></div><div className="text-right"><div className="font-bold">{inv.invoice_no}</div><div className="text-muted-foreground">{new Date(inv.issued_at).toLocaleDateString("en-IN")}</div></div></div>
      <div className="grid grid-cols-2 gap-4"><div><div className="text-xs text-muted-foreground">Vendor</div><b>{inv.vendor?.business_name}</b><div>{inv.vendor?.address}</div>{inv.vendor?.gst_number && <div>GSTIN {inv.vendor.gst_number}</div>}</div><div><div className="text-xs text-muted-foreground">Customer</div><b>{inv.customer.name}</b><div>+91 {inv.customer.phone}</div></div></div>
      <table className="w-full"><thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-1">Item</th><th className="text-right">Qty</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{b.items.map((i, k) => <tr key={k} className="border-b border-border/50"><td className="py-1">{i.name}</td><td className="text-right">{i.qty}</td><td className="text-right">{formatINR(i.qty * i.unit_price)}</td></tr>)}</tbody></table>
      <div className="text-right space-y-0.5"><div>Subtotal {formatINR(b.subtotal)}</div>{b.discount > 0 && <div>Discount -{formatINR(b.discount)}</div>}{b.tax > 0 && <div>Tax {formatINR(b.tax)}</div>}<div className="font-bold text-base">Total {formatINR(b.total)}</div><div className="text-emerald-600">Paid {formatINR(inv.paid)}</div><div className="text-amber-600">Due {formatINR(inv.due)}</div></div>
      <div className="text-xs text-muted-foreground">Payments: {inv.payments.map((p) => `${p.type} ${formatINR(p.amount)} via ${p.provider} (${p.provider_payment_id || p.id.slice(0, 8)})`).join("; ") || "—"}</div>
      <Button variant="outline" size="sm" className="rounded-xl print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print / Save PDF</Button>
    </div>
  );
}

export default function BookingDetail() {
  const { id } = useParams(); const navigate = useNavigate();
  const { user, setAuthOpen } = useAuth();
  const [d, setD] = useState(null); const [inv, setInv] = useState(false); const [cancelOpen, setCancelOpen] = useState(false); const [note, setNote] = useState("");
  const load = useCallback(() => api.get(`/bookings/${id}`).then((r) => setD(r.data)).catch(() => setD(false)), [id]);
  useEffect(() => { if (!user) { setAuthOpen(true); return; } load(); }, [user, load, setAuthOpen]);
  if (d === null) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (d === false) return <Layout><div className="py-20 text-center text-muted-foreground">Booking not found.</div></Layout>;
  const b = d.booking; const due = b.total - b.paid_amount;
  const canPay = ["payment_pending", "confirmed", "in_progress"].includes(b.status) && due > 0;
  const canCancel = ["payment_pending", "confirmed"].includes(b.status);
  const cancel = async () => {
    try { const { data } = await api.post(`/bookings/${b.id}/status`, { status: "cancelled", note }); toast.success(data.status === "refund_requested" ? "Cancellation requested — refund under review" : "Booking cancelled"); setCancelOpen(false); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => navigate("/bookings")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ChevronLeft className="h-4 w-4" /> My Bookings</button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="font-display font-extrabold text-2xl">{b.vendor_name}</h1><p className="text-muted-foreground text-sm">{b.code} · {b.event_type} · {b.event_date || "TBD"} · {b.location} {b.guests ? `· ${b.guests} guests` : ""}</p></div>
          <StatusBadge status={b.status} />
        </div>
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 mt-6">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display font-bold mb-3">Order summary</h3>
              {b.items.map((i, k) => <div key={k} className="flex justify-between text-sm py-1 border-b border-border/50"><span>{i.name} × {i.qty}</span><span>{formatINR(i.qty * i.unit_price)}</span></div>)}
              <div className="flex justify-between font-display font-extrabold text-lg mt-3"><span>Total</span><span data-testid="booking-total">{formatINR(b.total)}</span></div>
              <div className="flex justify-between text-sm text-emerald-600"><span>Paid</span><span data-testid="booking-paid">{formatINR(b.paid_amount)}</span></div>
              <div className="flex justify-between text-sm text-amber-600"><span>Balance due</span><span>{formatINR(due)}</span></div>
              {b.cancellation_policy && <p className="text-xs text-muted-foreground mt-3"><b>Cancellation policy:</b> {b.cancellation_policy}</p>}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display font-bold mb-3">Timeline</h3>
              <ol className="space-y-2" data-testid="booking-history">{(b.history || []).map((h, i) => <li key={i} className="flex gap-3 text-sm"><span className="h-2 w-2 mt-1.5 rounded-full bg-purple-500 shrink-0" /><div><span className="font-medium capitalize">{h.status.replace(/_/g, " ")}</span> <span className="text-muted-foreground">· {h.by} · {new Date(h.at).toLocaleString("en-IN")}</span>{h.note && <div className="text-muted-foreground">{h.note}</div>}</div></li>)}</ol>
            </div>
            {d.payments.length > 0 && <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-display font-bold mb-3">Payments</h3>{d.payments.map((p) => <div key={p.id} className="flex justify-between text-sm py-1"><span className="capitalize">{p.type} · {p.provider}</span><span className="flex items-center gap-2">{formatINR(p.amount)} <StatusBadge status={p.status} /></span></div>)}</div>}
            {b.status === "completed" && !d.review && <ReviewForm bookingId={b.id} onDone={load} />}
            {d.review && <div className="rounded-2xl border border-border bg-card p-5 text-sm"><b>Your review</b> · {d.review.rating}★ · <StatusBadge status={d.review.status} /><p className="mt-1 text-muted-foreground">{d.review.text}</p></div>}
          </div>
          <div className="space-y-4">
            {canPay && (d.payment_config?.checkout_available !== false
              ? <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-display font-bold mb-3">{b.paid_amount === 0 ? "Pay advance to confirm" : "Pay balance"}</h3><PayButton booking={b} type={b.paid_amount === 0 ? "advance" : "balance"} config={d.payment_config} demoEnabled={d.demo_payment_enabled} onPaid={load} /></div>
              : <div data-testid="payment-unavailable" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Online payment is temporarily unavailable. Please contact the vendor or our support team to complete your booking.</div>)}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <Button data-testid="invoice-btn" variant="outline" className="w-full rounded-xl" onClick={() => setInv(true)}><Receipt className="h-4 w-4 mr-2" /> Invoice / Receipt</Button>
              {canCancel && <Button data-testid="cancel-booking-btn" variant="outline" className="w-full rounded-xl text-red-500 border-red-200" onClick={() => setCancelOpen(true)}><Ban className="h-4 w-4 mr-2" /> Cancel booking</Button>}
              <Button variant="ghost" className="w-full rounded-xl" onClick={() => navigate(`/enquiries/${b.enquiry_id}`)}>Open chat with vendor</Button>
            </div>
          </div>
        </div>
      </div>
      <Dialog open={inv} onOpenChange={setInv}><DialogContent className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg"><DialogHeader><DialogTitle>Invoice</DialogTitle></DialogHeader><Invoice bookingId={b.id} /></DialogContent></Dialog>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogContent className="bg-white dark:bg-slate-900 rounded-3xl max-w-md"><DialogHeader><DialogTitle>Cancel booking?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{b.cancellation_policy}</p>{b.paid_amount > 0 && <p className="text-sm">You have paid {formatINR(b.paid_amount)}. A refund request will be raised per the policy.</p>}
        <Textarea data-testid="cancel-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className="rounded-xl" />
        <Button data-testid="cancel-confirm-btn" onClick={cancel} className="rounded-xl bg-red-500 hover:bg-red-600">Confirm cancellation</Button></DialogContent></Dialog>
    </Layout>
  );
}
