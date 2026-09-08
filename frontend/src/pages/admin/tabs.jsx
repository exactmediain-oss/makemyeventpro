import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/Quote";
import FileUpload from "@/components/FileUpload";
import api, { fileUrl } from "@/lib/api";
import { formatINR } from "@/lib/constants";
import { toast } from "sonner";

const useList = (url) => { const [d, setD] = useState([]); const load = () => api.get(url).then((r) => setD(r.data)).catch(() => {}); useEffect(() => { load(); }, [url]); return [d, load]; }; // eslint-disable-line
const Card = ({ children, className = "" }) => <div className={`rounded-2xl border border-border bg-card p-4 ${className}`}>{children}</div>;

// ---------- Categories (CRUD + theme) ----------
export function CategoriesTab({ categories, reload }) {
  const [f, setF] = useState({ name: "", description: "", icon: "Sparkles", subcategories: "", amenities: "", accent: "#7C3AED" });
  const save = async () => {
    try { await api.post("/admin/categories", { name: f.name, description: f.description, icon: f.icon, subcategories: f.subcategories.split(",").map((s) => s.trim()).filter(Boolean), amenities: f.amenities.split(",").map((s) => s.trim()).filter(Boolean), theme: { accent: f.accent, gradient: "from-blue-600 via-purple-600 to-pink-500", bg_soft: f.accent + "14", glow: f.accent + "40" }, order: categories.length + 1 }); toast.success("Category saved"); setF({ ...f, name: "" }); reload(); } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const upd = async (slug, body) => { await api.put(`/admin/categories/${slug}`, body); reload(); };
  return (
    <div className="space-y-4" data-testid="admin-categories">
      <Card className="grid sm:grid-cols-3 gap-3">
        <Input data-testid="cat-name" placeholder="Category name" className="rounded-xl" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input placeholder="Description" className="rounded-xl" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="flex gap-2"><Input type="color" className="rounded-xl w-14 p-1" value={f.accent} onChange={(e) => setF({ ...f, accent: e.target.value })} /><Input placeholder="Icon (lucide name)" className="rounded-xl" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} /></div>
        <Input placeholder="Subcategories, comma separated" className="rounded-xl" value={f.subcategories} onChange={(e) => setF({ ...f, subcategories: e.target.value })} />
        <Input placeholder="Amenities, comma separated" className="rounded-xl" value={f.amenities} onChange={(e) => setF({ ...f, amenities: e.target.value })} />
        <Button data-testid="cat-save-btn" onClick={save} disabled={!f.name} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500"><Plus className="h-4 w-4 mr-1" /> Add / update category</Button>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c) => (
          <Card key={c.slug} className="p-0 overflow-hidden">
            <div className="h-3" style={{ background: `linear-gradient(to right, ${c.theme?.accent}, #EC4899)` }} />
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center"><div className="font-display font-bold">{c.name}</div><Switch checked={c.active} onCheckedChange={(v) => upd(c.slug, { active: v })} /></div>
              <div className="text-xs text-muted-foreground">{c.subcategories?.length} subcategories · {c.amenities?.length} amenities · order {c.order}</div>
              <div className="flex items-center gap-2"><input type="color" data-testid={`theme-${c.slug}`} value={c.theme?.accent || "#7C3AED"} onChange={(e) => upd(c.slug, { theme: { ...c.theme, accent: e.target.value, bg_soft: e.target.value + "14", glow: e.target.value + "40" } })} className="h-7 w-10 rounded" /><code className="text-xs">{c.theme?.accent}</code></div>
              <Textarea className="rounded-xl text-xs min-h-8" defaultValue={c.subcategories?.join(", ")} onBlur={(e) => upd(c.slug, { subcategories: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Subcategories" />
              <Textarea className="rounded-xl text-xs min-h-8" defaultValue={c.amenities?.join(", ")} onBlur={(e) => upd(c.slug, { amenities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Amenities" />
            </div>
          </Card>))}
      </div>
    </div>
  );
}

// ---------- Banners / Ads ----------
export function BannersTab({ categories }) {
  const [list, load] = useList("/admin/banners");
  const [f, setF] = useState({ title: "", subtitle: "", cta: "Explore", image: [], category_slug: "", city: "Hyderabad", area: "", link: "", priority: 1, kind: "banner", starts_at: "", ends_at: "" });
  const save = async () => {
    if (!f.image[0]) { toast.error("Upload an image"); return; }
    try { await api.post("/admin/banners", { ...f, image: `/api/files/${f.image[0]}`, category_slug: f.category_slug || null, area: f.area || null, link: f.link || "#", starts_at: f.starts_at || null, ends_at: f.ends_at || null }); toast.success("Banner created"); load(); } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  return (
    <div className="space-y-4" data-testid="admin-banners">
      <Card className="grid sm:grid-cols-3 gap-3">
        <Input data-testid="banner-title" placeholder="Title" className="rounded-xl" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Input placeholder="Subtitle" className="rounded-xl" value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} />
        <Input placeholder="CTA text" className="rounded-xl" value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} />
        <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={f.category_slug} onChange={(e) => setF({ ...f, category_slug: e.target.value })}><option value="">All categories</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        <Input placeholder="Target area (optional)" className="rounded-xl" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} />
        <Input placeholder="Link (/category/venues)" className="rounded-xl" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
        <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="banner">Banner</option><option value="ad">Advertisement</option></select>
        <Input type="date" className="rounded-xl" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /><Input type="date" className="rounded-xl" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
        <div className="sm:col-span-2"><FileUpload value={f.image} onChange={(v) => setF({ ...f, image: v })} max={1} purpose="banner" testId="banner-upload" /></div>
        <Button data-testid="banner-save-btn" onClick={save} disabled={!f.title} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 self-end">Create</Button>
      </Card>
      <div className="grid sm:grid-cols-2 gap-4">{list.map((b) => (
        <div key={b.id} className="rounded-2xl border border-border overflow-hidden relative h-32 group">
          <img src={fileUrl(b.image)} className="w-full h-full object-cover" alt="" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent p-4 flex flex-col justify-center text-white"><div className="font-display font-bold text-sm">{b.title} <span className="text-[10px] uppercase opacity-70">{b.kind}</span></div><div className="text-xs opacity-80">{b.city}{b.area ? ` · ${b.area}` : ""} · {b.category_slug || "all"} · p{b.priority} · {b.impressions || 0} views · {b.clicks || 0} clicks</div></div>
          <button onClick={async () => { await api.delete(`/admin/banners/${b.id}`); load(); }} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 text-red-500 hidden group-hover:flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>))}</div>
    </div>
  );
}

// ---------- Customers ----------
export function CustomersTab() {
  const [list, load] = useList("/admin/customers");
  const [q, setQ] = useState("");
  const act = async (u, a) => { await api.post(`/admin/customers/${u.id}/${a}`, {}); toast.success(a); load(); };
  const rows = list.filter((u) => !q || (u.name || "").toLowerCase().includes(q.toLowerCase()) || (u.phone || "").includes(q));
  return (
    <div data-testid="admin-customers">
      <Input data-testid="customer-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / phone" className="rounded-xl max-w-xs mb-4" />
      <Card className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((u) => <TableRow key={u.id}><TableCell className="font-medium">{u.name}</TableCell><TableCell>{u.phone}</TableCell><TableCell>{u.email || "—"}</TableCell><TableCell className="capitalize">{u.role.replace("_", " ")}</TableCell><TableCell><StatusBadge status={u.status === "active" ? "approved" : "suspended"} /></TableCell><TableCell className="text-xs">{new Date(u.created_at).toLocaleDateString("en-IN")}</TableCell>
          <TableCell>{u.role !== "super_admin" && <div className="flex gap-1">{u.status === "active" ? <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-red-500" onClick={() => act(u, "suspend")}>Suspend</Button> : <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => act(u, "activate")}>Activate</Button>}{u.role === "customer" && <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={() => act(u, "make_admin")}>Make admin</Button>}{u.role === "admin" && <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={() => act(u, "make_customer")}>Remove admin</Button>}</div>}</TableCell></TableRow>)}</TableBody></Table></Card>
    </div>
  );
}

// ---------- Bookings & Refunds ----------
export function BookingsTab() {
  const [list, load] = useList("/admin/bookings");
  const refund = async (b, a) => { const note = a === "reject" ? window.prompt("Reason") : null; try { await api.post(`/bookings/${b.id}/refund/${a}`, { note }); toast.success(`Refund ${a}d`); load(); } catch (e) { toast.error(e.response?.data?.detail || "Failed"); } };
  return (
    <Card className="p-0 overflow-x-auto" data-testid="admin-bookings"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Customer</TableHead><TableHead>Vendor</TableHead><TableHead>Event</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead><TableHead>Refund</TableHead></TableRow></TableHeader>
      <TableBody>{list.map((b) => <TableRow key={b.id} data-testid={`admin-booking-${b.id}`}><TableCell className="font-mono text-xs">{b.code}</TableCell><TableCell>{b.customer_name}</TableCell><TableCell>{b.vendor_name}</TableCell><TableCell>{b.event_type}<div className="text-xs text-muted-foreground">{b.event_date}</div></TableCell><TableCell>{formatINR(b.total)}</TableCell><TableCell>{formatINR(b.paid_amount)}</TableCell><TableCell><StatusBadge status={b.status} /></TableCell>
        <TableCell>{["refund_requested", "disputed"].includes(b.status) && <div className="flex gap-1"><Button size="sm" className="h-7 text-xs rounded-lg bg-emerald-500" onClick={() => refund(b, "approve")}>Approve refund</Button><Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => refund(b, "reject")}>Reject</Button></div>}</TableCell></TableRow>)}</TableBody></Table>
      {list.length === 0 && <p className="p-8 text-center text-muted-foreground">No bookings yet.</p>}</Card>
  );
}

// ---------- Payments, commissions & payouts ----------
export function PaymentsTab() {
  const [d, setD] = useState({ entries: [], vendors: [] });
  const load = () => api.get("/admin/ledger").then((r) => setD(r.data));
  useEffect(() => { load(); }, []);
  const payout = async (v) => { await api.post(`/admin/ledger/payout/${v.vendor_id}`, {}); toast.success("Payout marked as settled"); load(); };
  return (
    <div className="space-y-4" data-testid="admin-payments">
      <h3 className="font-display font-bold">Vendor settlements</h3>
      <Card className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Gross collected</TableHead><TableHead>Commission</TableHead><TableHead>Payable</TableHead><TableHead>Pending payout</TableHead><TableHead>Bank</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>{d.vendors.map((v) => <TableRow key={v.vendor_id}><TableCell className="font-medium">{v.vendor_name}</TableCell><TableCell>{formatINR(v.gross)}</TableCell><TableCell className="text-purple-600">{formatINR(v.commission)}</TableCell><TableCell>{formatINR(v.payable)}</TableCell><TableCell className="font-bold text-amber-600">{formatINR(v.pending_payout)}</TableCell><TableCell>{v.has_bank ? "✓" : "missing"}</TableCell><TableCell>{v.pending_payout > 0 && <Button size="sm" className="h-7 text-xs rounded-lg" onClick={() => payout(v)}>Mark paid out</Button>}</TableCell></TableRow>)}</TableBody></Table>
        {d.vendors.length === 0 && <p className="p-8 text-center text-muted-foreground">No settled payments yet.</p>}</Card>
      <h3 className="font-display font-bold">Ledger</h3>
      <Card className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Booking</TableHead><TableHead>Amount</TableHead><TableHead>Commission</TableHead><TableHead>Vendor amt</TableHead><TableHead>Payout</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
        <TableBody>{d.entries.map((e) => <TableRow key={e.id}><TableCell className="capitalize">{e.type}</TableCell><TableCell className="font-mono text-xs">{e.booking_id.slice(0, 8)}</TableCell><TableCell>{formatINR(e.amount)}</TableCell><TableCell>{e.commission != null ? formatINR(e.commission) : "—"}</TableCell><TableCell>{e.vendor_amount != null ? formatINR(e.vendor_amount) : "—"}</TableCell><TableCell>{e.payout_status || "—"}</TableCell><TableCell className="text-xs">{new Date(e.created_at).toLocaleString("en-IN")}</TableCell></TableRow>)}</TableBody></Table></Card>
    </div>
  );
}

// ---------- Coupons & offers ----------
export function CouponsTab({ categories }) {
  const [list, load] = useList("/admin/coupons");
  const [f, setF] = useState({ code: "", title: "", type: "percent", value: 10, max_discount: "", min_amount: "", category_slug: "", max_uses: "", expires_at: "" });
  const save = async () => { try { await api.post("/admin/coupons", { ...f, value: Number(f.value), max_discount: f.max_discount ? Number(f.max_discount) : null, min_amount: f.min_amount ? Number(f.min_amount) : null, max_uses: f.max_uses ? Number(f.max_uses) : null, category_slug: f.category_slug || null, expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null }); toast.success("Coupon saved"); load(); } catch (e) { toast.error(e.response?.data?.detail || "Failed"); } };
  return (
    <div className="space-y-4" data-testid="admin-coupons">
      <Card className="grid sm:grid-cols-4 gap-3">
        <Input data-testid="coupon-code" placeholder="CODE" className="rounded-xl uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
        <Input placeholder="Title / offer text" className="rounded-xl" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">Percent %</option><option value="flat">Flat ₹</option></select>
        <Input type="number" placeholder="Value" className="rounded-xl" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        <Input type="number" placeholder="Max discount ₹" className="rounded-xl" value={f.max_discount} onChange={(e) => setF({ ...f, max_discount: e.target.value })} />
        <Input type="number" placeholder="Min amount ₹" className="rounded-xl" value={f.min_amount} onChange={(e) => setF({ ...f, min_amount: e.target.value })} />
        <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={f.category_slug} onChange={(e) => setF({ ...f, category_slug: e.target.value })}><option value="">All categories</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        <Input type="number" placeholder="Max uses" className="rounded-xl" value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })} />
        <Input type="date" className="rounded-xl" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} />
        <Button data-testid="coupon-save-btn" onClick={save} disabled={!f.code} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Save coupon</Button>
      </Card>
      <Card className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Offer</TableHead><TableHead>Value</TableHead><TableHead>Uses</TableHead><TableHead>Scope</TableHead><TableHead>Expires</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>{list.map((c) => <TableRow key={c.code}><TableCell className="font-mono font-bold">{c.code}</TableCell><TableCell>{c.title}</TableCell><TableCell>{c.type === "percent" ? `${c.value}%` : formatINR(c.value)}{c.max_discount ? ` (max ${formatINR(c.max_discount)})` : ""}</TableCell><TableCell>{c.uses}/{c.max_uses || "∞"}</TableCell><TableCell>{c.category_slug || "all"}</TableCell><TableCell className="text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-IN") : "—"}</TableCell><TableCell><Button size="icon" variant="ghost" onClick={async () => { await api.delete(`/admin/coupons/${c.code}`); load(); }}><Trash2 className="h-4 w-4 text-red-400" /></Button></TableCell></TableRow>)}</TableBody></Table></Card>
    </div>
  );
}

// ---------- Reviews moderation ----------
export function ReviewsTab() {
  const [list, load] = useList("/admin/reviews");
  const act = async (r, a) => { await api.post(`/admin/reviews/${r.id}/${a}`); toast.success(`Review ${a}d`); load(); };
  return (
    <div className="space-y-3" data-testid="admin-reviews">
      {list.length === 0 && <p className="text-center text-muted-foreground py-8">No reviews.</p>}
      {list.map((r) => <Card key={r.id} className="flex flex-wrap items-center gap-3"><div className="flex-1 min-w-48"><div className="font-semibold">{r.name} · {r.rating}★ {r.verified_booking && <span className="text-[10px] text-emerald-600 font-bold">VERIFIED BOOKING</span>}</div><p className="text-sm text-muted-foreground">{r.text}</p></div><StatusBadge status={r.status} />
        <div className="flex gap-1">{r.status !== "approved" && <Button data-testid={`review-approve-${r.id}`} size="sm" className="h-8 rounded-lg bg-emerald-500" onClick={() => act(r, "approve")}>Approve</Button>}{r.status !== "rejected" && <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => act(r, "reject")}>Reject</Button>}<Button size="sm" variant="ghost" className="h-8 rounded-lg text-red-500" onClick={() => act(r, "delete")}>Delete</Button></div></Card>)}
    </div>
  );
}

// ---------- Plans ----------
export function PlansTab() {
  const [list, load] = useList("/admin/plans");
  const [f, setF] = useState({ name: "", price_monthly: 0, features: "", lead_limit: "", featured_slots: 0, commission_percent: "" });
  const save = async () => { await api.post("/admin/plans", { ...f, price_monthly: Number(f.price_monthly), features: f.features.split(",").map((s) => s.trim()).filter(Boolean), lead_limit: f.lead_limit ? Number(f.lead_limit) : null, featured_slots: Number(f.featured_slots), commission_percent: f.commission_percent ? Number(f.commission_percent) : null }); toast.success("Plan saved"); load(); };
  return (
    <div className="space-y-4" data-testid="admin-plans">
      <Card className="grid sm:grid-cols-3 gap-3"><Input placeholder="Plan name" className="rounded-xl" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><Input type="number" placeholder="Price / month ₹" className="rounded-xl" value={f.price_monthly} onChange={(e) => setF({ ...f, price_monthly: e.target.value })} /><Input placeholder="Features, comma separated" className="rounded-xl" value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} /><Input type="number" placeholder="Lead limit (blank = unlimited)" className="rounded-xl" value={f.lead_limit} onChange={(e) => setF({ ...f, lead_limit: e.target.value })} /><Input type="number" placeholder="Featured slots" className="rounded-xl" value={f.featured_slots} onChange={(e) => setF({ ...f, featured_slots: e.target.value })} /><Input type="number" placeholder="Commission % override" className="rounded-xl" value={f.commission_percent} onChange={(e) => setF({ ...f, commission_percent: e.target.value })} /><Button onClick={save} disabled={!f.name} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Save plan</Button></Card>
      <div className="grid sm:grid-cols-3 gap-4">{list.map((p) => <Card key={p.slug}><div className="flex justify-between"><div className="font-display font-bold text-lg">{p.name}</div><Button size="icon" variant="ghost" onClick={async () => { await api.delete(`/admin/plans/${p.slug}`); load(); }}><Trash2 className="h-4 w-4 text-red-400" /></Button></div><div className="text-2xl font-extrabold text-purple-600">{formatINR(p.price_monthly)}<span className="text-xs text-muted-foreground font-normal">/mo</span></div><ul className="text-sm mt-2 space-y-1">{p.features.map((x) => <li key={x}>• {x}</li>)}</ul><div className="text-xs text-muted-foreground mt-2">Leads {p.lead_limit ?? "∞"} · Featured slots {p.featured_slots}{p.commission_percent != null ? ` · Commission ${p.commission_percent}%` : ""}</div></Card>)}</div>
    </div>
  );
}

// ---------- CMS pages ----------
export function PagesTab() {
  const [list, load] = useList("/admin/pages");
  const [f, setF] = useState({ slug: "", title: "", content: "", published: true });
  const save = async () => { await api.post("/admin/pages", f); toast.success("Page saved"); load(); };
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4" data-testid="admin-pages">
      <Card className="space-y-3"><div className="grid sm:grid-cols-2 gap-3"><Input placeholder="slug (about, terms…)" className="rounded-xl" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /><Input placeholder="Title" className="rounded-xl" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div><Textarea placeholder="Content (Markdown / HTML)" className="rounded-xl min-h-48" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /><div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm"><Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} /> Published</label><Button onClick={save} disabled={!f.slug || !f.title} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Save page</Button></div></Card>
      <div className="space-y-2">{list.map((p) => <button key={p.slug} onClick={() => setF(p)} className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-purple-300"><b>{p.title}</b> <span className="text-muted-foreground">/{p.slug}</span>{!p.published && <span className="text-[10px] text-red-400 ml-2">draft</span>}</button>)}</div>
    </div>
  );
}

// ---------- Settings (logo, splash, commission, policies) ----------
export function SettingsTab() {
  const [s, setS] = useState({}); const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/admin/settings").then((r) => setS(Object.fromEntries(r.data.map((x) => [x.key, x.value])))); }, []);
  const put = async (key, value) => { setBusy(true); try { await api.put("/admin/settings", { key, value }); setS({ ...s, [key]: value }); toast.success(`${key} saved`); } finally { setBusy(false); } };
  const Row = ({ k, label, type = "text", hint }) => <div className="space-y-1"><label className="text-sm font-medium">{label}</label><div className="flex gap-2"><Input data-testid={`setting-${k}`} type={type} className="rounded-xl" defaultValue={s[k] ?? ""} onBlur={(e) => e.target.value !== String(s[k] ?? "") && put(k, type === "number" ? Number(e.target.value) : e.target.value)} /></div>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
  return (
    <div className="grid lg:grid-cols-2 gap-4" data-testid="admin-settings">
      <Card className="space-y-4"><h3 className="font-display font-bold">Brand</h3><Row k="brand_name" label="Brand name" /><Row k="support_phone" label="Support phone" /><Row k="support_email" label="Support email" />
        <div className="grid grid-cols-2 gap-4"><div><div className="text-sm font-medium mb-1">Logo</div><FileUpload value={s.logo_url ? [s.logo_url] : []} onChange={(v) => put("logo_url", v[0] || null)} max={1} purpose="brand" testId="setting-logo-upload" /></div><div><div className="text-sm font-medium mb-1">Launch / splash image</div><FileUpload value={s.splash_url ? [s.splash_url] : []} onChange={(v) => put("splash_url", v[0] || null)} max={1} purpose="brand" testId="setting-splash-upload" /></div></div></Card>
      <Card className="space-y-4"><h3 className="font-display font-bold">Commerce</h3><Row k="commission_percent" label="Platform commission %" type="number" hint="Applied to new bookings. Plans may override." />
        <div className="space-y-1"><label className="text-sm font-medium">Default cancellation policy</label><Textarea className="rounded-xl" defaultValue={s.default_cancellation_policy || ""} onBlur={(e) => put("default_cancellation_policy", e.target.value)} /></div>
        <div className="space-y-1"><label className="text-sm font-medium">Vendor terms & declaration</label><Textarea className="rounded-xl" defaultValue={s.vendor_terms || ""} onBlur={(e) => put("vendor_terms", e.target.value)} /></div>{busy && <Loader2 className="h-4 w-4 animate-spin" />}</Card>
    </div>
  );
}

// ---------- Notifications broadcast ----------
export function NotifyTab() {
  const [f, setF] = useState({ title: "", body: "", audience: "all", link: "" }); const [busy, setBusy] = useState(false);
  const send = async () => { setBusy(true); try { const { data } = await api.post("/admin/notifications/broadcast", { ...f, link: f.link || null }); toast.success(`Sent to ${data.sent} users`); } finally { setBusy(false); } };
  return <Card className="max-w-lg space-y-3" data-testid="admin-notify"><Input placeholder="Title" className="rounded-xl" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><Textarea placeholder="Message" className="rounded-xl" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /><div className="flex gap-2"><select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="all">Everyone</option><option value="customers">Customers</option><option value="vendors">Vendors</option></select><Input placeholder="Link (optional)" className="rounded-xl" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></div><Button onClick={send} disabled={busy || !f.title || !f.body} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send broadcast"}</Button></Card>;
}

export function AuditTab() {
  const [list] = useList("/admin/audit-logs");
  return <Card className="p-0 overflow-x-auto" data-testid="admin-audit"><Table><TableHeader><TableRow><TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Meta</TableHead></TableRow></TableHeader><TableBody>{list.map((a) => <TableRow key={a.id}><TableCell className="text-xs">{new Date(a.created_at).toLocaleString("en-IN")}</TableCell><TableCell>{a.actor}</TableCell><TableCell className="font-mono text-xs">{a.action}</TableCell><TableCell className="font-mono text-xs">{(a.target || "").slice(0, 12)}</TableCell><TableCell className="text-xs text-muted-foreground">{JSON.stringify(a.meta || {}).slice(0, 60)}</TableCell></TableRow>)}</TableBody></Table></Card>;
}
