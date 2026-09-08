import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import { StatusBadge } from "@/components/Quote";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function MyEnquiries() {
  const navigate = useNavigate();
  const { user, setAuthOpen } = useAuth();
  const [list, setList] = useState([]);
  useEffect(() => { if (!user) { setAuthOpen(true); return; } api.get("/enquiries").then((r) => setList(r.data)); }, [user, setAuthOpen]);
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl flex items-center gap-2"><MessageSquare className="h-6 w-6 text-purple-600" /> My Enquiries</h1>
        <p className="text-muted-foreground mb-6">Chat with vendors, receive quotes and book.</p>
        {list.length === 0 && <div className="text-center py-16 text-muted-foreground" data-testid="enquiries-empty">No enquiries yet. Discover vendors and send an enquiry.</div>}
        <div className="space-y-3" data-testid="enquiries-list">
          {list.map((e) => (
            <button key={e.id} data-testid={`enquiry-row-${e.id}`} onClick={() => navigate(`/enquiries/${e.id}`)}
              className="w-full text-left rounded-2xl border border-border bg-card p-4 flex items-center gap-4 hover:border-purple-300 transition-colors">
              <img src={e.vendor_cover} alt="" className="h-14 w-14 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold truncate">{e.vendor_name}</div>
                <div className="text-sm text-muted-foreground">{e.event_type} · {e.event_date || "Date TBD"} · {e.guests ? `${e.guests} guests` : ""}</div>
              </div>
              {e.unread_customer > 0 && <span className="h-5 min-w-5 px-1.5 rounded-full bg-pink-500 text-white text-[11px] font-bold flex items-center justify-center">{e.unread_customer}</span>}
              <StatusBadge status={e.status} />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
