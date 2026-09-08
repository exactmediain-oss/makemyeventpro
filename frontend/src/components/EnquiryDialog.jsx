import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { Loader2, PartyPopper } from "lucide-react";

const EVENT_TYPES = ["Wedding", "Engagement", "Reception", "Birthday", "Anniversary", "Haldi", "Mehendi", "Sangeet", "Corporate Event", "Party"];

export default function EnquiryDialog({ open, onOpenChange, vendor, packageId }) {
  const { user, setAuthOpen } = useAuth();
  const [form, setForm] = useState({ event_type: "Wedding", event_date: "", event_time: "", location: "", guests: "", budget: "", message: "", package_id: packageId || "" });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!user) { onOpenChange(false); setAuthOpen(true); return; }
    setLoading(true);
    try {
      await api.post("/enquiries", {
        vendor_ids: [vendor.id],
        event_type: form.event_type,
        event_date: form.event_date || null,
        guests: form.guests ? Number(form.guests) : null,
        budget: form.budget ? Number(form.budget) : null,
        message: form.message,
        event_time: form.event_time || null,
        location: form.location || null,
        package_id: form.package_id || null,
        services: [],
      });
      toast.success("Enquiry sent!", { description: `${vendor.business_name} will respond shortly.` });
      onOpenChange(false);
      setForm({ event_type: "Wedding", event_date: "", event_time: "", location: "", guests: "", budget: "", message: "", package_id: "" });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not send enquiry");
    } finally { setLoading(false); }
  };

  if (!vendor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 rounded-3xl" data-testid="enquiry-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-pink-500" /> Enquire · {vendor.business_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Event type</Label>
              <Select value={form.event_type} onValueChange={(v) => set("event_type", v)}>
                <SelectTrigger data-testid="enquiry-event-type" className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 rounded-xl">
                  {EVENT_TYPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Event date</Label>
              <Input data-testid="enquiry-date" type="date" value={form.event_date} onChange={(e) => set("event_date", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Guests</Label>
              <Input data-testid="enquiry-guests" type="number" value={form.guests} onChange={(e) => set("guests", e.target.value)} placeholder="500" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Budget (₹)</Label>
              <Input data-testid="enquiry-budget" type="number" value={form.budget} onChange={(e) => set("budget", e.target.value)} placeholder="1000000" className="rounded-xl" />
            </div>
          </div>
          {vendor.packages?.length > 0 && <div className="space-y-1.5">
            <Label>Service / package</Label>
            <Select value={form.package_id || "none"} onValueChange={(v) => set("package_id", v === "none" ? "" : v)}>
              <SelectTrigger data-testid="enquiry-package" className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 rounded-xl"><SelectItem value="none">Custom requirement</SelectItem>{vendor.packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · ₹{Number(p.price).toLocaleString("en-IN")}</SelectItem>)}</SelectContent>
            </Select>
          </div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Event time</Label><Input data-testid="enquiry-time" type="time" value={form.event_time} onChange={(e) => set("event_time", e.target.value)} className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Event location</Label><Input data-testid="enquiry-location" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Area / venue" className="rounded-xl" /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea data-testid="enquiry-message" value={form.message} onChange={(e) => set("message", e.target.value)}
              placeholder="Tell the vendor about your requirements..." className="rounded-xl min-h-24" />
          </div>
          <Button data-testid="enquiry-submit-btn" onClick={submit} disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 h-11 font-semibold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Enquiry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
