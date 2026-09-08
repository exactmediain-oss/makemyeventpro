import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import { StatusBadge } from "@/components/Quote";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { formatINR } from "@/lib/constants";

export default function MyBookings() {
  const navigate = useNavigate();
  const { user, setAuthOpen } = useAuth();
  const [list, setList] = useState([]);
  useEffect(() => { if (!user) { setAuthOpen(true); return; } api.get("/bookings").then((r) => setList(r.data)); }, [user, setAuthOpen]);
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl flex items-center gap-2"><CalendarCheck className="h-6 w-6 text-purple-600" /> My Bookings</h1>
        <p className="text-muted-foreground mb-6">Track payments, status and invoices.</p>
        {list.length === 0 && <div className="text-center py-16 text-muted-foreground" data-testid="bookings-empty">No bookings yet. Accept a vendor quote to create one.</div>}
        <div className="space-y-3" data-testid="bookings-list">
          {list.map((b) => (
            <button key={b.id} data-testid={`booking-row-${b.id}`} onClick={() => navigate(`/bookings/${b.id}`)}
              className="w-full text-left rounded-2xl border border-border bg-card p-4 flex items-center gap-4 hover:border-purple-300 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold truncate">{b.vendor_name} <span className="text-xs text-muted-foreground font-normal">· {b.code}</span></div>
                <div className="text-sm text-muted-foreground">{b.event_type} · {b.event_date || "TBD"} · Total {formatINR(b.total)} · Paid {formatINR(b.paid_amount)}</div>
              </div>
              <StatusBadge status={b.status} /><ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
