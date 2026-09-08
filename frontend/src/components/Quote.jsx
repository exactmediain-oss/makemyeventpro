import { useState } from "react";
import { Plus, Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import { formatINR } from "@/lib/constants";
import { toast } from "sonner";

export const STATUS_STYLES = {
  new: "bg-blue-100 text-blue-700", responded: "bg-sky-100 text-sky-700", quote_sent: "bg-purple-100 text-purple-700",
  quote_accepted: "bg-violet-100 text-violet-700", payment_pending: "bg-amber-100 text-amber-700", confirmed: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-teal-100 text-teal-700", completed: "bg-green-100 text-green-700", cancelled: "bg-slate-200 text-slate-700",
  refund_requested: "bg-orange-100 text-orange-700", refunded: "bg-slate-100 text-slate-600", disputed: "bg-red-100 text-red-700",
  sent: "bg-purple-100 text-purple-700", accepted: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-600",
  expired: "bg-slate-100 text-slate-500", superseded: "bg-slate-100 text-slate-500", paid: "bg-emerald-100 text-emerald-700", created: "bg-amber-100 text-amber-700",
  draft: "bg-slate-100 text-slate-600", submitted: "bg-amber-100 text-amber-700", under_review: "bg-blue-100 text-blue-700", approved: "bg-emerald-100 text-emerald-700",
  corrections_requested: "bg-orange-100 text-orange-700", suspended: "bg-red-100 text-red-700", pending: "bg-amber-100 text-amber-700",
};
export const StatusBadge = ({ status }) => (
  <span data-testid={`status-${status}`} className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${STATUS_STYLES[status] || "bg-muted"}`}>{(status || "").replace(/_/g, " ")}</span>
);

export function QuoteCard({ quote, canAct, onAction }) {
  const [busy, setBusy] = useState(false);
  const act = async (a) => {
    setBusy(true);
    try { const { data } = await api.post(`/quotes/${quote.id}/${a}`); toast.success(a === "accept" ? "Quote accepted — proceed to payment" : "Quote declined"); onAction?.(data); }
    catch (e) { toast.error(e.response?.data?.detail || "Action failed"); } finally { setBusy(false); }
  };
  const expired = quote.expires_at < new Date().toISOString();
  return (
    <div className="rounded-2xl border border-border bg-card p-5" data-testid={`quote-card-${quote.id}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display font-bold flex items-center gap-2"><FileText className="h-4 w-4 text-purple-600" /> Quotation</h4>
        <StatusBadge status={expired && quote.status === "sent" ? "expired" : quote.status} />
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-muted-foreground text-xs"><th className="text-left pb-2">Item</th><th className="text-right pb-2">Qty</th><th className="text-right pb-2">Price</th><th className="text-right pb-2">Total</th></tr></thead>
        <tbody>{quote.items.map((it, i) => (
          <tr key={i} className="border-t border-border/60"><td className="py-1.5">{it.name}{it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}</td><td className="text-right">{it.qty}</td><td className="text-right">{formatINR(it.unit_price)}</td><td className="text-right font-medium">{formatINR(it.qty * it.unit_price)}</td></tr>
        ))}</tbody>
      </table>
      <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(quote.subtotal)}</span></div>
        {quote.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>- {formatINR(quote.discount)}</span></div>}
        {quote.tax > 0 && <div className="flex justify-between"><span>Tax ({quote.tax_percent}%)</span><span>{formatINR(quote.tax)}</span></div>}
        <div className="flex justify-between font-display font-extrabold text-lg"><span>Total</span><span className="text-purple-600" data-testid="quote-total">{formatINR(quote.total)}</span></div>
        <div className="flex justify-between text-xs text-muted-foreground"><span>Advance {formatINR(quote.advance_amount)}</span><span>Balance {formatINR(quote.balance_amount)}</span></div>
      </div>
      {quote.terms && <p className="text-xs text-muted-foreground mt-3"><b>Terms:</b> {quote.terms}</p>}
      {quote.cancellation_policy && <p className="text-xs text-muted-foreground mt-1"><b>Cancellation:</b> {quote.cancellation_policy}</p>}
      <p className="text-xs text-muted-foreground mt-1">Valid till {new Date(quote.expires_at).toLocaleDateString("en-IN")}</p>
      {canAct && quote.status === "sent" && !expired && (
        <div className="flex gap-2 mt-4">
          <Button data-testid="quote-accept-btn" onClick={() => act("accept")} disabled={busy} className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept & Book"}</Button>
          <Button data-testid="quote-reject-btn" onClick={() => act("reject")} disabled={busy} variant="outline" className="rounded-xl">Decline</Button>
        </div>
      )}
    </div>
  );
}

export function QuoteBuilder({ enquiry, onCreated }) {
  const [items, setItems] = useState([{ name: enquiry.package?.name || "", qty: 1, unit_price: enquiry.package?.price || "" }]);
  const [f, setF] = useState({ discount: 0, tax_percent: 0, advance_percent: 30, terms: "", cancellation_policy: "", valid_days: 7 });
  const [busy, setBusy] = useState(false);
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0);
  const total = (subtotal - Number(f.discount || 0)) * (1 + Number(f.tax_percent || 0) / 100);
  const advance = Math.round(total * Number(f.advance_percent || 0) / 100);
  const setItem = (i, k, v) => setItems(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const send = async () => {
    if (items.some((i) => !i.name || !i.unit_price)) { toast.error("Fill all item names and prices"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/enquiries/${enquiry.id}/quotes`, {
        items: items.map((i) => ({ name: i.name, qty: Number(i.qty), unit_price: Number(i.unit_price), description: i.description || null })),
        discount: Number(f.discount || 0), tax_percent: Number(f.tax_percent || 0), advance_amount: advance,
        terms: f.terms || null, cancellation_policy: f.cancellation_policy || null, valid_days: Number(f.valid_days) });
      toast.success("Quote sent to customer"); onCreated?.(data);
    } catch (e) { toast.error(e.response?.data?.detail || "Could not send quote"); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4" data-testid="quote-builder">
      <h4 className="font-display font-bold">Create Quotation</h4>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_110px_auto] gap-2 items-center">
            <Input data-testid={`quote-item-name-${i}`} placeholder="Service / item" value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} className="rounded-xl" />
            <Input data-testid={`quote-item-qty-${i}`} type="number" min="1" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} className="rounded-xl" />
            <Input data-testid={`quote-item-price-${i}`} type="number" placeholder="₹ Price" value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} className="rounded-xl" />
            <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, idx) => idx !== i))} disabled={items.length === 1}><Trash2 className="h-4 w-4 text-red-400" /></Button>
          </div>
        ))}
        <Button data-testid="quote-add-item-btn" variant="outline" size="sm" className="rounded-xl" onClick={() => setItems([...items, { name: "", qty: 1, unit_price: "" }])}><Plus className="h-4 w-4 mr-1" /> Add item</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><Label className="text-xs">Discount (₹)</Label><Input data-testid="quote-discount" type="number" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} className="rounded-xl" /></div>
        <div><Label className="text-xs">Tax / GST %</Label><Input data-testid="quote-tax" type="number" value={f.tax_percent} onChange={(e) => setF({ ...f, tax_percent: e.target.value })} className="rounded-xl" /></div>
        <div><Label className="text-xs">Advance %</Label><Input data-testid="quote-advance" type="number" value={f.advance_percent} onChange={(e) => setF({ ...f, advance_percent: e.target.value })} className="rounded-xl" /></div>
        <div><Label className="text-xs">Valid (days)</Label><Input data-testid="quote-valid-days" type="number" value={f.valid_days} onChange={(e) => setF({ ...f, valid_days: e.target.value })} className="rounded-xl" /></div>
      </div>
      <Textarea data-testid="quote-terms" placeholder="Terms & conditions" value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} className="rounded-xl" />
      <Textarea data-testid="quote-cancellation" placeholder="Cancellation policy (optional — platform default applies)" value={f.cancellation_policy} onChange={(e) => setF({ ...f, cancellation_policy: e.target.value })} className="rounded-xl" />
      <div className="rounded-xl bg-muted/60 p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
        <span>Subtotal <b>{formatINR(subtotal)}</b></span><span>Total <b className="text-purple-600" data-testid="quote-builder-total">{formatINR(Math.round(total))}</b></span>
        <span>Advance <b>{formatINR(advance)}</b></span><span>Balance <b>{formatINR(Math.round(total) - advance)}</b></span>
      </div>
      <Button data-testid="quote-send-btn" onClick={send} disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 h-11 font-semibold">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Quote"}</Button>
    </div>
  );
}
