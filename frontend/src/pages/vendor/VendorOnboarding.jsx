import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2, Building2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUpload from "@/components/FileUpload";
import MapPicker from "@/components/MapPicker";
import { DynamicFieldsForm } from "@/components/DynamicFields";
import { StatusBadge } from "@/components/Quote";
import { useAuth } from "@/context/AuthContext";
import { useLocationCtx } from "@/context/LocationContext";
import api from "@/lib/api";
import { BRAND_LOGO } from "@/lib/constants";
import { toast } from "sonner";

const STEPS = [
  { key: "business", title: "Business" }, { key: "contact", title: "Contact" }, { key: "category", title: "Category" },
  { key: "location", title: "Location" }, { key: "online", title: "Online presence" }, { key: "legal", title: "GST / PAN" },
  { key: "kyc", title: "KYC documents" }, { key: "bank", title: "Bank details" }, { key: "media", title: "Photos & videos" },
  { key: "fields", title: "Service details" }, { key: "terms", title: "Review & submit" },
];
const BUSINESS_TYPES = ["Proprietorship", "Partnership", "LLP", "Private Limited", "Individual / Freelancer", "Trust / Society"];
const KYC_TYPES = ["Aadhaar", "PAN Card", "GST Certificate", "Business Registration", "Shop & Establishment Licence", "Address Proof", "Cancelled Cheque", "Other"];

const Field = ({ label, children, required, hint }) => (
  <div className="space-y-1.5"><Label className="text-sm">{label}{required && <span className="text-pink-500"> *</span>}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
);

export default function VendorOnboarding() {
  const navigate = useNavigate();
  const { user, setAuthOpen, refreshUser } = useAuth();
  const { tree } = useLocationCtx();
  const [v, setV] = useState({});
  const [step, setStep] = useState(0);
  const [cats, setCats] = useState([]); const [fields, setFields] = useState([]); const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [missing, setMissing] = useState([]);

  useEffect(() => {
    if (!user) { setAuthOpen(true); setLoading(false); return; }
    Promise.all([api.get("/vendor/onboarding"), api.get("/categories"), api.get("/settings/public")])
      .then(([o, c, s]) => { setV(o.data.vendor || { city: "Hyderabad", state: "Telangana" }); setStep(o.data.vendor?.current_step || 0); setCats(c.data); setSettings(s.data); })
      .finally(() => setLoading(false));
  }, [user, setAuthOpen]);
  useEffect(() => { if (v.category_slug) api.get(`/fields?category=${v.category_slug}`).then((r) => setFields(r.data)); }, [v.category_slug]);

  const set = (k, val) => setV((x) => ({ ...x, [k]: val }));
  const setSocial = (k, val) => set("social", { ...(v.social || {}), [k]: val });
  const setBank = (k, val) => set("bank", { ...(v.bank || {}), [k]: val });
  const cat = cats.find((c) => c.slug === v.category_slug);
  const city = tree.find((c) => c.name === (v.city || "Hyderabad"));
  const geo = v.geo?.coordinates ? { lat: v.geo.coordinates[1], lng: v.geo.coordinates[0] } : v.geo?.lat ? v.geo : null;
  const locked = ["submitted", "under_review"].includes(v.status);

  const save = async (next) => {
    setBusy(true);
    try {
      const payload = { ...v, current_step: next ?? step };
      ["id","user_id","status","verified","featured","premium","trending","rating","review_count","profile_views","revenue","response_rate","response_time","created_at","updated_at","slug","category_name","profile_completion","submitted_at","admin_note","is_demo","approved_at"].forEach((k) => delete payload[k]);
      if (geo) payload.geo = geo;
      const { data } = await api.put("/vendor/onboarding", payload);
      setV(data); if (next !== undefined) setStep(next);
      return true;
    } catch (e) { toast.error(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Could not save"); return false; }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!(await save())) return;
    setBusy(true);
    try { await api.post("/vendor/onboarding/submit"); await refreshUser(); toast.success("Application submitted for verification!"); navigate("/vendor"); }
    catch (e) { const d = e.response?.data?.detail; setMissing(d?.missing || []); toast.error(d?.message || d || "Submission failed"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center text-center px-4"><div><Building2 className="h-12 w-12 mx-auto text-purple-500 mb-3" /><h2 className="font-display font-bold text-xl">Login to register your business</h2><Button className="mt-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500" onClick={() => setAuthOpen(true)}>Login with OTP</Button></div></div>;

  const cls = "rounded-xl";
  const content = [
    <div className="grid sm:grid-cols-2 gap-4" key="business">
      <Field label="Vendor / Business name" required><Input data-testid="ob-business-name" className={cls} value={v.business_name || ""} onChange={(e) => set("business_name", e.target.value)} /></Field>
      <Field label="Owner / Contact person" required><Input data-testid="ob-owner-name" className={cls} value={v.owner_name || ""} onChange={(e) => set("owner_name", e.target.value)} /></Field>
      <Field label="Business type" required><Select value={v.business_type || ""} onValueChange={(x) => set("business_type", x)}><SelectTrigger data-testid="ob-business-type" className={cls}><SelectValue placeholder="Select" /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900 rounded-xl">{BUSINESS_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Years in business"><Input data-testid="ob-years" type="number" className={cls} value={v.years ?? ""} onChange={(e) => set("years", Number(e.target.value))} /></Field>
      <div className="sm:col-span-2"><Field label="Business description" required hint="Describe your services, specialities and experience (min 50 chars recommended)."><Textarea data-testid="ob-description" className={`${cls} min-h-28`} value={v.description || ""} onChange={(e) => set("description", e.target.value)} /></Field></div>
    </div>,
    <div className="grid sm:grid-cols-2 gap-4" key="contact">
      <Field label="Business phone" required><Input data-testid="ob-business-phone" className={cls} value={v.business_phone || ""} onChange={(e) => set("business_phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" /></Field>
      <Field label="Email"><Input data-testid="ob-email" type="email" className={cls} value={v.email || ""} onChange={(e) => set("email", e.target.value)} /></Field>
      <Field label="WhatsApp number"><Input data-testid="ob-whatsapp" className={cls} value={v.social?.whatsapp || ""} onChange={(e) => setSocial("whatsapp", e.target.value.replace(/\D/g, ""))} placeholder="91XXXXXXXXXX" /></Field>
      <Field label="Website"><Input data-testid="ob-website" className={cls} value={v.website || ""} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
    </div>,
    <div className="space-y-4" key="category">
      <Field label="Primary category" required>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">{cats.map((c) => (
          <button key={c.slug} data-testid={`ob-cat-${c.slug}`} onClick={() => set("category_slug", c.slug)} className={`rounded-xl border p-3 text-left text-sm font-medium transition-colors ${v.category_slug === c.slug ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30" : "border-border hover:border-purple-300"}`}>
            <div className="h-2 w-8 rounded-full mb-2" style={{ background: c.theme?.accent }} />{c.name}</button>))}</div>
      </Field>
      {cat && <Field label="Subcategories"><div className="flex flex-wrap gap-2">{cat.subcategories.map((s) => { const on = (v.subcategories || []).includes(s); return <button key={s} data-testid={`ob-subcat-${s}`} onClick={() => set("subcategories", on ? v.subcategories.filter((x) => x !== s) : [...(v.subcategories || []), s])} className={`px-3 py-1.5 rounded-full text-sm border ${on ? "bg-purple-600 text-white border-purple-600" : "border-border"}`}>{s}</button>; })}</div></Field>}
      {cat && <Field label="Amenities / highlights"><div className="flex flex-wrap gap-2">{cat.amenities.map((s) => { const on = (v.amenities || []).includes(s); return <button key={s} onClick={() => set("amenities", on ? v.amenities.filter((x) => x !== s) : [...(v.amenities || []), s])} className={`px-3 py-1.5 rounded-full text-sm border ${on ? "bg-pink-500 text-white border-pink-500" : "border-border"}`}>{s}</button>; })}</div></Field>}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Starting price (₹)"><Input data-testid="ob-starting-price" type="number" className={cls} value={v.starting_price ?? ""} onChange={(e) => set("starting_price", Number(e.target.value))} /></Field>
        <Field label="Price unit"><Select value={v.price_unit || "per event"} onValueChange={(x) => set("price_unit", x)}><SelectTrigger className={cls}><SelectValue /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900 rounded-xl">{["per event", "per plate", "per day", "per hour", "per person"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></Field>
      </div>
    </div>,
    <div className="space-y-4" key="location">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="Address" required><Textarea data-testid="ob-address" className={cls} value={v.address || ""} onChange={(e) => set("address", e.target.value)} /></Field></div>
        <Field label="City" required><Select value={v.city || "Hyderabad"} onValueChange={(x) => set("city", x)}><SelectTrigger data-testid="ob-city" className={cls}><SelectValue /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900 rounded-xl">{tree.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Area / locality" required><Select value={v.area || ""} onValueChange={(x) => { set("area", x); const a = city?.areas.find((y) => y.name === x); if (a) { set("pincode", a.pincode); if (!geo) set("geo", { lat: a.lat, lng: a.lng }); } }}><SelectTrigger data-testid="ob-area" className={cls}><SelectValue placeholder="Select area" /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900 rounded-xl max-h-64">{(city?.areas || []).map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Pincode"><Input data-testid="ob-pincode" className={cls} value={v.pincode || ""} onChange={(e) => set("pincode", e.target.value)} /></Field>
        <Field label="Service radius (km)"><Input data-testid="ob-radius" type="number" className={cls} value={v.service_radius_km ?? ""} onChange={(e) => set("service_radius_km", Number(e.target.value))} /></Field>
      </div>
      <Field label="Map pin (Google Maps)" hint="Drop a pin on your exact business location for distance-based discovery."><MapPicker value={geo} onChange={(g) => set("geo", g)} onAddress={(a) => !v.address && set("address", a)} /></Field>
      <Field label="Service locations" hint="Areas you serve — customers there see you first."><div className="flex flex-wrap gap-2">{(city?.areas || []).map((a) => { const on = (v.service_areas || []).includes(a.name); return <button key={a.id} data-testid={`ob-service-area-${a.slug}`} onClick={() => set("service_areas", on ? v.service_areas.filter((x) => x !== a.name) : [...(v.service_areas || []), a.name])} className={`px-3 py-1 rounded-full text-xs border ${on ? "bg-purple-600 text-white border-purple-600" : "border-border"}`}>{a.name}</button>; })}</div></Field>
    </div>,
    <div className="grid sm:grid-cols-2 gap-4" key="online">
      {[["instagram", "Instagram URL"], ["facebook", "Facebook URL"], ["youtube", "YouTube URL"], ["twitter", "X / Twitter URL"], ["linkedin", "LinkedIn URL"], ["justdial", "JustDial / Other URL"]].map(([k, l]) => (
        <Field key={k} label={l}><Input data-testid={`ob-social-${k}`} className={cls} value={v.social?.[k] || ""} onChange={(e) => setSocial(k, e.target.value)} placeholder="https://" /></Field>))}
    </div>,
    <div className="grid sm:grid-cols-2 gap-4" key="legal">
      <Field label="GST number" hint="15 characters, if registered"><Input data-testid="ob-gst" className={cls} value={v.gst_number || ""} onChange={(e) => set("gst_number", e.target.value.toUpperCase())} maxLength={15} /></Field>
      <Field label="PAN number" hint="10 characters"><Input data-testid="ob-pan" className={cls} value={v.pan_number || ""} onChange={(e) => set("pan_number", e.target.value.toUpperCase())} maxLength={10} /></Field>
      <Field label="Registration type"><Select value={v.registration_type || ""} onValueChange={(x) => set("registration_type", x)}><SelectTrigger className={cls}><SelectValue placeholder="Select" /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900 rounded-xl">{["Udyam / MSME", "Shop & Establishment", "CIN (Company)", "LLPIN", "Trade Licence", "None"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Registration number"><Input data-testid="ob-reg-no" className={cls} value={v.registration_number || ""} onChange={(e) => set("registration_number", e.target.value)} /></Field>
    </div>,
    <div className="space-y-4" key="kyc">
      <p className="text-sm text-muted-foreground">Upload clear scans (PDF/JPG/PNG, max 10 MB). Documents are private and visible only to our verification team.</p>
      {(v.kyc_documents || []).map((d, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3" data-testid={`ob-kyc-doc-${i}`}>
          <Select value={d.type} onValueChange={(x) => set("kyc_documents", v.kyc_documents.map((y, j) => j === i ? { ...y, type: x } : y))}><SelectTrigger className="w-56 rounded-xl"><SelectValue /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900 rounded-xl">{KYC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          <div className="flex-1"><FileUpload value={d.file_id ? [d.file_id] : []} onChange={(ids) => set("kyc_documents", v.kyc_documents.map((y, j) => j === i ? { ...y, file_id: ids[0] || null } : y))} kind="document" purpose="kyc" max={1} priv testId={`ob-kyc-upload-${i}`} /></div>
          <Button variant="ghost" size="sm" onClick={() => set("kyc_documents", v.kyc_documents.filter((_, j) => j !== i))}>Remove</Button>
        </div>))}
      <Button data-testid="ob-add-kyc-btn" variant="outline" className="rounded-xl" onClick={() => set("kyc_documents", [...(v.kyc_documents || []), { type: "Aadhaar", file_id: null }])}>+ Add document</Button>
    </div>,
    <div className="grid sm:grid-cols-2 gap-4" key="bank">
      <Field label="Account holder name"><Input data-testid="ob-bank-name" className={cls} value={v.bank?.account_name || ""} onChange={(e) => setBank("account_name", e.target.value)} /></Field>
      <Field label="Bank name"><Input className={cls} value={v.bank?.bank_name || ""} onChange={(e) => setBank("bank_name", e.target.value)} /></Field>
      <Field label="Account number"><Input data-testid="ob-bank-account" className={cls} value={v.bank?.account_number || ""} onChange={(e) => setBank("account_number", e.target.value.replace(/\D/g, ""))} /></Field>
      <Field label="IFSC"><Input data-testid="ob-bank-ifsc" className={cls} value={v.bank?.ifsc || ""} onChange={(e) => setBank("ifsc", e.target.value.toUpperCase())} maxLength={11} /></Field>
      <Field label="UPI ID (optional)"><Input className={cls} value={v.bank?.upi_id || ""} onChange={(e) => setBank("upi_id", e.target.value)} /></Field>
      <div className="sm:col-span-2 text-xs text-muted-foreground">Settlement details are encrypted at rest and used only for payouts of your earnings.</div>
    </div>,
    <div className="space-y-6" key="media">
      <div className="grid sm:grid-cols-2 gap-6">
        <FileUpload label="Business logo" value={v.logo ? [v.logo] : []} onChange={(ids) => set("logo", ids[0] || null)} max={1} purpose="logo" testId="ob-logo-upload" />
        <FileUpload label="Cover photo" value={v.cover ? [v.cover] : []} onChange={(ids) => set("cover", ids[0] || null)} max={1} purpose="cover" testId="ob-cover-upload" />
      </div>
      <FileUpload label="Business photos (up to 15)" value={v.gallery || []} onChange={(ids) => set("gallery", ids)} max={15} purpose="gallery" testId="ob-gallery-upload" />
      <FileUpload label="Business videos (up to 3, MP4)" value={v.videos || []} onChange={(ids) => set("videos", ids)} kind="video" max={3} purpose="video" testId="ob-video-upload" />
    </div>,
    <div key="fields">{fields.length ? <DynamicFieldsForm fields={fields} values={v.custom_fields || {}} onChange={(x) => set("custom_fields", x)} /> : <p className="text-sm text-muted-foreground">Select a category first — category-specific details appear here.</p>}</div>,
    <div className="space-y-4" key="terms">
      <div className="rounded-2xl bg-muted/60 p-4 text-sm max-h-40 overflow-y-auto">{settings.vendor_terms}</div>
      <label className="flex items-start gap-3 text-sm"><Checkbox data-testid="ob-terms" checked={!!v.terms_accepted} onCheckedChange={(x) => set("terms_accepted", !!x)} /> I accept the Vendor Agreement, commission structure and marketplace policies.</label>
      <label className="flex items-start gap-3 text-sm"><Checkbox data-testid="ob-declaration" checked={!!v.declaration_accepted} onCheckedChange={(x) => set("declaration_accepted", !!x)} /> I declare that all information and documents provided are true and belong to my business.</label>
      {missing.length > 0 && <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm" data-testid="ob-missing"><b>Please complete:</b><ul className="list-disc ml-5 mt-1">{missing.map((m) => <li key={m}>{m}</li>)}</ul></div>}
    </div>,
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-white dark:bg-slate-900 border-b border-border sticky top-0 z-40"><div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between"><button onClick={() => navigate("/")} className="flex items-center gap-2"><img src={BRAND_LOGO} className="h-9 w-9 rounded-xl" alt="" /><span className="font-display font-bold">Vendor Registration</span></button>{v.status && <StatusBadge status={v.status} />}</div></header>
      <div className="max-w-5xl mx-auto px-4 py-6 grid lg:grid-cols-[220px_1fr] gap-6">
        <aside className="hidden lg:block"><ol className="space-y-1 sticky top-24">{STEPS.map((s, i) => <li key={s.key}><button data-testid={`ob-step-${s.key}`} onClick={() => setStep(i)} className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2 ${i === step ? "bg-purple-600 text-white font-semibold" : "hover:bg-muted"}`}><span className={`h-5 w-5 rounded-full text-[11px] flex items-center justify-center ${i === step ? "bg-white text-purple-600" : "bg-muted-foreground/20"}`}>{i + 1}</span>{s.title}</button></li>)}</ol></aside>
        <main className="space-y-4">
          {locked && <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm" data-testid="ob-locked">Your application is under review. Editing is locked until our team responds.</div>}
          {v.admin_note && <div className="rounded-2xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 p-4 text-sm"><b>Admin note:</b> {v.admin_note}</div>}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-7">
            <div className="flex items-center justify-between mb-1"><span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span><span className="text-xs text-purple-600 font-bold">{v.profile_completion || 0}% complete</span></div>
            <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5 mb-5" />
            <h2 className="font-display font-extrabold text-xl sm:text-2xl mb-5">{STEPS[step].title}</h2>
            <fieldset disabled={locked}>{content[step]}</fieldset>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" className="rounded-xl" disabled={step === 0} onClick={() => setStep(step - 1)} data-testid="ob-prev-btn"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => save()} disabled={busy || locked} data-testid="ob-save-btn"><Save className="h-4 w-4 mr-1" /> Save draft</Button>
              {step < STEPS.length - 1 ? <Button className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500" onClick={() => locked ? setStep(step + 1) : save(step + 1)} disabled={busy} data-testid="ob-next-btn">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Save & Continue <ChevronRight className="h-4 w-4 ml-1" /></>}</Button>
                : <Button className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500" onClick={submit} disabled={busy || locked} data-testid="ob-submit-btn">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Submit for verification</>}</Button>}
            </div>
          </div>
          {v.status === "approved" && <div className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> You're approved — changes here update your live listing after saving.</div>}
        </main>
      </div>
    </div>
  );
}
