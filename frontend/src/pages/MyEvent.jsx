import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarHeart, Plus, Check, Circle, Clock, Wallet, Users, MapPin, Loader2, TrendingUp } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { formatINR } from "@/lib/constants";
import { toast } from "sonner";

const EVENT_TYPES = ["Wedding", "Engagement", "Reception", "Birthday", "Anniversary", "Corporate Event"];
const STATUS = { not_started: "Not Started", in_progress: "In Progress", completed: "Completed" };

export default function MyEvent() {
  const navigate = useNavigate();
  const { user, setAuthOpen } = useAuth();
  const [events, setEvents] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", event_type: "Wedding", date: "", guests: "", budget: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/events");
    setEvents(data);
    setActive(data[0] || null);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); else setLoading(false); }, [user]);

  if (!user) return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <CalendarHeart className="h-14 w-14 mx-auto text-purple-500 mb-4" />
        <h2 className="font-display font-bold text-2xl">Plan your perfect event</h2>
        <p className="text-muted-foreground mt-2">Login to create your event, set a budget & track your checklist.</p>
        <Button onClick={() => setAuthOpen(true)} className="mt-5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Login</Button>
      </div>
    </Layout>
  );

  const create = async () => {
    if (!form.title) { toast.error("Give your event a name"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/events", { ...form, guests: form.guests ? Number(form.guests) : null, budget: form.budget ? Number(form.budget) : null });
      setEvents((p) => [data, ...p]); setActive(data); setCreateOpen(false);
      setForm({ title: "", event_type: "Wedding", date: "", guests: "", budget: "" });
      toast.success("Event created!");
    } finally { setSaving(false); }
  };

  const updateItem = async (itemId, patch) => {
    const checklist = active.checklist.map((i) => i.id === itemId ? { ...i, ...patch } : i);
    const { data } = await api.put(`/events/${active.id}/checklist`, { checklist });
    setActive(data);
    setEvents((p) => p.map((e) => e.id === data.id ? data : e));
  };

  const done = active ? active.checklist.filter((i) => i.status === "completed").length : 0;
  const pct = active ? Math.round((done / active.checklist.length) * 100) : 0;
  const remaining = active ? (active.budget || 0) - (active.spent || 0) : 0;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl flex items-center gap-2">
            <CalendarHeart className="h-7 w-7 text-purple-600" /> My Event Planner
          </h1>
          <Button data-testid="create-event-btn" onClick={() => setCreateOpen(true)} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">
            <Plus className="h-4 w-4 mr-1.5" /> New Event
          </Button>
        </div>

        {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto mt-20" /> : !active ? (
          <div className="text-center py-20" data-testid="empty-events">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="font-display font-bold text-xl">No events yet</h3>
            <p className="text-muted-foreground mt-1">Create your first event to start planning.</p>
          </div>
        ) : (
          <>
            {events.length > 1 && (
              <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
                {events.map((e) => (
                  <button key={e.id} onClick={() => setActive(e)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${active.id === e.id ? "bg-purple-600 text-white" : "bg-muted"}`}>
                    {e.title}
                  </button>
                ))}
              </div>
            )}

            {/* summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { icon: Wallet, label: "Total Budget", value: formatINR(active.budget), color: "from-blue-500 to-indigo-500" },
                { icon: TrendingUp, label: "Spent", value: formatINR(active.spent), color: "from-pink-500 to-rose-500" },
                { icon: Wallet, label: "Remaining", value: formatINR(remaining), color: "from-emerald-500 to-teal-500" },
                { icon: Check, label: "Tasks Done", value: `${done}/${active.checklist.length}`, color: "from-purple-500 to-fuchsia-500" },
              ].map((s) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-card p-4">
                  <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}><s.icon className="h-4.5 w-4.5 text-white" /></div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="font-display font-extrabold text-lg">{s.value}</div>
                </motion.div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 mb-6">
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><CalendarHeart className="h-4 w-4" /> {active.event_type}</span>
                {active.date && <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {active.date}</span>}
                {active.guests && <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {active.guests} guests</span>}
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {active.location}</span>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1.5"><span className="font-semibold">Planning progress</span><span className="text-purple-600 font-bold">{pct}%</span></div>
                <Progress value={pct} className="h-2.5" />
              </div>
            </div>

            {/* checklist */}
            <h3 className="font-display font-bold text-lg mb-3">Checklist</h3>
            <div className="space-y-3" data-testid="checklist">
              {active.checklist.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid={`checklist-item-${item.id}`}>
                  <button onClick={() => updateItem(item.id, { status: item.status === "completed" ? "not_started" : "completed" })}
                    className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${item.status === "completed" ? "bg-emerald-500 text-white" : "border-2 border-muted-foreground/30"}`}>
                    {item.status === "completed" ? <Check className="h-4 w-4" /> : <Circle className="h-0 w-0" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{item.task}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                      <Input type="number" value={item.allocated || ""} placeholder="Budget"
                        onChange={(e) => updateItem(item.id, { allocated: Number(e.target.value) })}
                        className="w-28 h-9 rounded-xl pl-5 text-sm" />
                    </div>
                    <Select value={item.status} onValueChange={(val) => updateItem(item.id, { status: val })}>
                      <SelectTrigger className="w-32 h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 rounded-xl">
                        {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="rounded-xl h-9 text-xs shrink-0"
                      onClick={() => navigate(`/category/${item.category_slug}`)}>Find Vendors</Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 rounded-3xl" data-testid="create-event-dialog">
          <DialogHeader><DialogTitle className="font-display text-xl">Create New Event</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Event name</Label>
              <Input data-testid="event-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Priya's Wedding" className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 rounded-xl">{EVENT_TYPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-xl" /></div>
              <div className="space-y-1.5"><Label>Guests</Label><Input type="number" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} placeholder="500" className="rounded-xl" /></div>
              <div className="space-y-1.5"><Label>Budget (₹)</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="1000000" className="rounded-xl" /></div>
            </div>
            <Button data-testid="event-create-submit" onClick={create} disabled={saving} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 h-11 font-semibold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
