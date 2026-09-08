import { useState } from "react";
import { Check, X, AlertCircle, Ban, RotateCcw, Sparkles, Eye, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/Quote";
import { DynamicFieldsDisplay } from "@/components/DynamicFields";
import api, { fileUrl } from "@/lib/api";
import { formatINR } from "@/lib/constants";
import { toast } from "sonner";

export default function VendorsTab({ vendors, reload, queueOnly = false }) {
  const [detail, setDetail] = useState(null); const [note, setNote] = useState(""); const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const list = (queueOnly ? vendors.filter((v) => ["submitted", "under_review", "corrections_requested"].includes(v.status)) : vendors).filter((v) => !q || v.business_name.toLowerCase().includes(q.toLowerCase()));

  const act = async (v, action) => {
    if (["reject", "request_corrections", "suspend"].includes(action) && !note) { toast.error("Add a note for the vendor"); return; }
    setBusy(true);
    try { await api.post(`/admin/vendors/${v.id}/${action}`, { note: note || null }); toast.success(`Vendor: ${action.replace("_", " ")}`); setDetail(null); setNote(""); reload(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  const open = async (v) => { const { data } = await api.get(`/admin/vendors/${v.id}`); setDetail(data); };
  const d = detail?.vendor;

  return (
    <div data-testid={queueOnly ? "kyc-queue" : "admin-vendors-table"}>
      {!queueOnly && <Input data-testid="vendor-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors…" className="rounded-xl max-w-xs mb-4" />}
      {list.length === 0 ? <p className="text-muted-foreground py-8 text-center">{queueOnly ? "No vendors awaiting verification." : "No vendors."}</p> : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Business</TableHead><TableHead>Category</TableHead><TableHead>Area</TableHead><TableHead>Completion</TableHead><TableHead>Status</TableHead><TableHead>Flags</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>{list.map((v) => (
            <TableRow key={v.id} data-testid={`vendor-row-${v.id}`}>
              <TableCell className="font-medium">{v.business_name}<div className="text-xs text-muted-foreground">{v.owner_name} · {v.business_phone}</div></TableCell>
              <TableCell>{v.category_name}</TableCell><TableCell>{v.area}</TableCell><TableCell>{v.profile_completion}%</TableCell>
              <TableCell><StatusBadge status={v.status} /></TableCell>
              <TableCell className="text-xs">{v.featured && <Sparkles className="inline h-4 w-4 text-amber-500" />} {v.premium && "PREMIUM"}</TableCell>
              <TableCell><div className="flex gap-1 flex-wrap">
                <Button data-testid={`review-${v.id}`} size="sm" variant="outline" className="rounded-lg h-8" onClick={() => open(v)}><Eye className="h-3.5 w-3.5 mr-1" /> Review</Button>
                {["submitted", "under_review"].includes(v.status) && <Button data-testid={`approve-${v.id}`} size="sm" className="rounded-lg h-8 bg-emerald-500 hover:bg-emerald-600" onClick={() => act(v, "approve")}><Check className="h-3.5 w-3.5" /></Button>}
                {v.status === "approved" && <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs" onClick={() => act(v, v.featured ? "unfeature" : "feature")}>{v.featured ? "Unfeature" : "Feature"}</Button>}
                {v.status === "approved" && <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs" onClick={() => act(v, v.premium ? "unpremium" : "premium")}>{v.premium ? "Unpremium" : "Premium"}</Button>}
              </div></TableCell>
            </TableRow>))}</TableBody></Table></div>)}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl max-h-[92vh] overflow-y-auto" data-testid="vendor-review-dialog">
          {d && <>
            <DialogHeader><DialogTitle className="flex items-center gap-2">{d.business_name} <StatusBadge status={d.status} /></DialogTitle></DialogHeader>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Info label="Owner" v={`${d.owner_name || "—"} · ${detail.owner?.phone || d.business_phone || ""}`} /><Info label="Business type" v={d.business_type} />
              <Info label="Category" v={`${d.category_name} · ${(d.subcategories || []).join(", ")}`} /><Info label="Address" v={`${d.address || ""}, ${d.area || ""}, ${d.city || ""} ${d.pincode || ""}`} />
              <Info label="Email / Website" v={`${d.email || "—"} · ${d.website || "—"}`} /><Info label="Service areas" v={(d.service_areas || []).join(", ") || "—"} />
              <Info label="GST" v={d.gst_number || "—"} /><Info label="PAN" v={d.pan_number || "—"} /><Info label="Registration" v={`${d.registration_type || "—"} ${d.registration_number || ""}`} />
              <Info label="Bank" v={d.bank ? `${d.bank.account_name} · ${d.bank.bank_name} · ****${(d.bank.account_number || "").slice(-4)} · ${d.bank.ifsc}` : "—"} />
              <Info label="Starting price" v={d.starting_price ? `${formatINR(d.starting_price)} ${d.price_unit}` : "—"} /><Info label="Social" v={Object.entries(d.social || {}).filter(([, x]) => x).map(([k]) => k).join(", ") || "—"} />
              <div className="sm:col-span-2"><div className="text-xs text-muted-foreground">Description</div><p>{d.description}</p></div>
            </div>
            <div><div className="text-xs font-bold uppercase text-muted-foreground mb-2">KYC documents</div>
              <div className="flex flex-wrap gap-2">{(d.kyc_documents || []).map((k, i) => k.file_id ? <a key={i} href={fileUrl(k.file_id, true)} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border text-sm hover:border-purple-300" data-testid={`kyc-doc-${i}`}><FileText className="h-4 w-4 text-purple-500" /> {k.type}</a> : <span key={i} className="px-3 py-1.5 rounded-xl bg-muted text-sm">{k.type} (missing file)</span>)}{!d.kyc_documents?.length && <span className="text-sm text-muted-foreground">None uploaded</span>}</div></div>
            {d.gallery?.length > 0 && <div className="flex gap-2 overflow-x-auto">{d.gallery.slice(0, 8).map((g, i) => <img key={i} src={fileUrl(g)} alt="" className="h-20 w-20 rounded-xl object-cover shrink-0" />)}</div>}
            {detail.fields?.length > 0 && <DynamicFieldsDisplay fields={detail.fields} values={d.custom_fields || {}} />}
            <Textarea data-testid="admin-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to vendor (required for reject / corrections / suspend)" className="rounded-xl" />
            <div className="flex flex-wrap gap-2">
              {["submitted"].includes(d.status) && <Button data-testid="act-review" variant="outline" className="rounded-xl" disabled={busy} onClick={() => act(d, "review")}>Mark under review</Button>}
              {["submitted", "under_review", "corrections_requested", "rejected"].includes(d.status) && <Button data-testid="act-approve" className="rounded-xl bg-emerald-500 hover:bg-emerald-600" disabled={busy} onClick={() => act(d, "approve")}><Check className="h-4 w-4 mr-1" /> Approve</Button>}
              {["submitted", "under_review"].includes(d.status) && <Button data-testid="act-corrections" variant="outline" className="rounded-xl text-orange-600 border-orange-200" disabled={busy} onClick={() => act(d, "request_corrections")}><AlertCircle className="h-4 w-4 mr-1" /> Request corrections</Button>}
              {["submitted", "under_review"].includes(d.status) && <Button data-testid="act-reject" variant="outline" className="rounded-xl text-red-500 border-red-200" disabled={busy} onClick={() => act(d, "reject")}><X className="h-4 w-4 mr-1" /> Reject</Button>}
              {d.status === "approved" && <Button data-testid="act-suspend" variant="outline" className="rounded-xl text-red-500 border-red-200" disabled={busy} onClick={() => act(d, "suspend")}><Ban className="h-4 w-4 mr-1" /> Suspend</Button>}
              {d.status === "suspended" && <Button data-testid="act-reactivate" className="rounded-xl" disabled={busy} onClick={() => act(d, "reactivate")}><RotateCcw className="h-4 w-4 mr-1" /> Reactivate</Button>}
              {busy && <Loader2 className="h-5 w-5 animate-spin self-center" />}
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
const Info = ({ label, v }) => <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{v}</div></div>;
