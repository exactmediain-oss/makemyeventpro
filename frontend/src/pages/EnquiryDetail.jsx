import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, CalendarDays, MapPin, Users, Wallet, Package, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import Chat from "@/components/Chat";
import { QuoteCard, QuoteBuilder, StatusBadge } from "@/components/Quote";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { formatINR } from "@/lib/constants";

// Shared by customer (/enquiries/:id) and vendor (/vendor/leads/:id)
export default function EnquiryDetail({ vendorView = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, setAuthOpen } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => api.get(`/enquiries/${id}`).then((r) => setData(r.data)).finally(() => setLoading(false)), [id]);
  useEffect(() => { if (!user) { setAuthOpen(true); setLoading(false); return; } load(); }, [user, load, setAuthOpen]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return <Layout><div className="py-20 text-center text-muted-foreground">Enquiry not found or login required.</div></Layout>;

  const e = data.enquiry; const role = data.viewer_role;
  const activeQuote = data.quotes.find((q) => q.status === "sent");
  const Wrapper = vendorView ? ({ children }) => <div className="min-h-screen bg-muted/30">{children}</div> : Layout;

  return (
    <Wrapper>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => navigate(vendorView ? "/vendor" : "/enquiries")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ChevronLeft className="h-4 w-4" /> Back</button>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="font-display font-extrabold text-2xl">{vendorView ? e.customer_name : e.vendor_name}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {e.event_type} · {e.event_date || "TBD"} {e.event_time || ""}</span>
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {e.location}</span>
              {e.guests && <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {e.guests} guests</span>}
              {e.budget && <span className="flex items-center gap-1"><Wallet className="h-4 w-4" /> {formatINR(e.budget)}</span>}
              {e.package && <span className="flex items-center gap-1"><Package className="h-4 w-4" /> {e.package.name} · {formatINR(e.package.price)}</span>}
            </div>
          </div>
          <StatusBadge status={e.status} />
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          <div className="space-y-4">
            {vendorView && e.customer_phone && <div className="rounded-2xl border border-border bg-card p-4 text-sm"><b>Customer:</b> {e.customer_name} · +91 {e.customer_phone}{e.message && <p className="mt-2 text-muted-foreground">"{e.message}"</p>}</div>}
            <Chat enquiryId={e.id} meRole={role} />
          </div>
          <div className="space-y-4">
            {data.booking && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-4" data-testid="enquiry-booking-card">
                <div className="flex justify-between items-center"><b>Booking {data.booking.code}</b><StatusBadge status={data.booking.status} /></div>
                <div className="text-sm mt-1">Total {formatINR(data.booking.total)} · Paid {formatINR(data.booking.paid_amount)}</div>
                <Button data-testid="view-booking-btn" size="sm" className="mt-3 rounded-xl" onClick={() => navigate(vendorView ? "/vendor/bookings" : `/bookings/${data.booking.id}`)}>View booking</Button>
              </div>
            )}
            {role === "vendor" && !data.booking && !activeQuote && <QuoteBuilder enquiry={e} onCreated={load} />}
            {role === "vendor" && activeQuote && <p className="text-xs text-muted-foreground px-1">Quote pending customer response. Sending a new quote supersedes it.</p>}
            {role === "vendor" && activeQuote && !data.booking && <details><summary className="text-sm text-purple-600 cursor-pointer px-1">Send revised quote</summary><div className="mt-3"><QuoteBuilder enquiry={e} onCreated={load} /></div></details>}
            {data.quotes.map((q) => <QuoteCard key={q.id} quote={q} canAct={role === "customer"} onAction={(r) => { load(); if (r?.booking) navigate(`/bookings/${r.booking.id}`); }} />)}
            {data.quotes.length === 0 && role === "customer" && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Waiting for the vendor's quotation.</div>}
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
