import { useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { Plus, Pencil, ArrowUp, ArrowDown, Loader2, Search, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FileUpload from "@/components/FileUpload";
import { categoryIcon } from "@/components/CategoryBar";
import api, { fileUrl } from "@/lib/api";
import { toast } from "sonner";

// Icon set = lucide-react (already used app-wide). Exclude helpers/aliases.
const ICON_NAMES = Object.keys(Icons).filter((k) => /^[A-Z]/.test(k) && !k.endsWith("Icon") && !k.startsWith("Lucide") && typeof Icons[k] === "object");
const DEFAULT_THEME = { accent: "#7C3AED", secondary: "#EC4899", active_bg: "", active_text: "#FFFFFF", header_color: "", light_bg: "", heading_color: "", button_color: "", overlay: 0.75 };
const EMPTY = { name: "", slug: "", icon: "Sparkles", description: "", banner: "", banner_title: "", banner_subtitle: "", order: 99, active: true, subcategories: [], amenities: [], theme: DEFAULT_THEME };

function IconPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => ICON_NAMES.filter((n) => n.toLowerCase().includes(q.toLowerCase())).slice(0, 96), [q]);
  const Cur = categoryIcon(value);
  return (
    <div className="space-y-2" data-testid="icon-picker">
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center"><Cur className="h-5 w-5" /></div>
        <code className="text-xs" data-testid="icon-picker-current">{value}</code>
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input data-testid="icon-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons (camera, music, car…)" className="pl-8 h-9 rounded-xl" /></div>
      </div>
      <div className="grid grid-cols-8 sm:grid-cols-12 gap-1 max-h-40 overflow-y-auto rounded-xl border border-border p-2">
        {list.map((n) => { const I = Icons[n]; return <button type="button" key={n} title={n} data-testid={`icon-opt-${n}`} onClick={() => onChange(n)} className={`h-8 w-8 rounded-lg flex items-center justify-center hover:bg-purple-50 ${value === n ? "bg-purple-600 text-white" : ""}`}><I className="h-4 w-4" /></button>; })}
      </div>
    </div>
  );
}

const ColorField = ({ label, value, onChange, testId }) => (
  <div className="space-y-1"><Label className="text-xs">{label}</Label>
    <div className="flex gap-2"><input type="color" data-testid={testId} value={/^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#7C3AED"} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded-lg border border-border p-0.5 bg-transparent" /><Input value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-xl font-mono text-xs" /></div>
  </div>
);

function Preview({ c }) {
  const t = c.theme || {}; const Icon = categoryIcon(c.icon);
  const activeBg = t.active_bg || `linear-gradient(135deg, ${t.accent}, ${t.secondary})`;
  return (
    <div className="space-y-3" data-testid="category-preview">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live preview</div>
      <div className="flex gap-2">
        <div className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl shadow-lg" style={{ background: activeBg, color: t.active_text || "#fff" }}><div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center"><Icon className="h-5 w-5" /></div><span className="text-[11px] font-semibold">{c.name?.split(" ")[0] || "Name"}</span></div>
        <div className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl border border-border"><div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${t.accent}14` }}><Icon className="h-5 w-5" style={{ color: t.accent }} /></div><span className="text-[11px] font-semibold">{c.name?.split(" ")[0] || "Name"}</span></div>
        <div className="text-[11px] text-muted-foreground self-center">← active / inactive</div>
      </div>
      <div className="rounded-xl px-3 py-2 text-white text-xs font-bold flex items-center justify-between" style={{ background: t.header_color || activeBg }} data-testid="preview-header">MakeMyEventPro header <span className="px-2 py-0.5 rounded-lg bg-white/20">Login</span></div>
      <div className="rounded-xl px-3 py-2 text-sm font-bold" style={{ background: t.light_bg || `${t.accent}14`, color: t.heading_color || t.accent }}>Section heading · <span className="px-2 py-0.5 rounded-lg text-white text-xs font-semibold" style={{ background: t.button_color || activeBg }}>Button</span></div>
      <div className="relative h-28 rounded-2xl overflow-hidden bg-slate-800">
        {c.banner && <img src={fileUrl(c.banner)} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${t.accent}, ${t.secondary || t.accent})`, opacity: t.overlay ?? 0.75 }} />
        <div className="absolute inset-0 p-4 text-white flex flex-col justify-end"><div className="font-display font-extrabold text-lg leading-tight">{c.banner_title || `${c.name || "Category"} in Hyderabad`}</div><div className="text-xs text-white/85">{c.banner_subtitle || c.description}</div></div>
      </div>
    </div>
  );
}

export default function CategoryManagerTab({ categories, reload }) {
  const [edit, setEdit] = useState(null); const [busy, setBusy] = useState(false); const [original, setOriginal] = useState(null);
  const sorted = [...categories].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const open = (c) => { setOriginal(c); setEdit({ ...EMPTY, ...c, theme: { ...DEFAULT_THEME, ...(c.theme || {}) } }); };
  const setT = (k, v) => setEdit({ ...edit, theme: { ...edit.theme, [k]: v } });

  const save = async () => {
    if (!edit.name) { toast.error("Name required"); return; }
    setBusy(true);
    try {
      const body = { name: edit.name, icon: edit.icon, description: edit.description, banner: edit.banner || "", banner_title: edit.banner_title || null, banner_subtitle: edit.banner_subtitle || null, order: Number(edit.order), active: edit.active, subcategories: edit.subcategories, amenities: edit.amenities, theme: { ...edit.theme, active_bg: edit.theme.active_bg || `linear-gradient(135deg, ${edit.theme.accent}, ${edit.theme.secondary})`, overlay: Number(edit.theme.overlay) } };
      if (edit.id) await api.put(`/admin/categories/${edit.slug}`, body); else await api.post("/admin/categories", { ...body, slug: edit.slug || undefined });
      toast.success("Category saved"); setEdit(null); reload();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  const quick = async (c, body) => { try { await api.put(`/admin/categories/${c.slug}`, body); reload(); } catch (e) { toast.error(e.response?.data?.detail || "Failed"); } };
  const move = async (i, dir) => { const j = i + dir; if (j < 0 || j >= sorted.length) return; const a = sorted[i], b = sorted[j]; await api.put(`/admin/categories/${a.slug}`, { order: j }); await api.put(`/admin/categories/${b.slug}`, { order: i }); reload(); };

  return (
    <div data-testid="category-manager">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-muted-foreground">Icons, colours, banners and copy for every category — including <b>All Categories</b>. Changes go live instantly.</p>
        <Button data-testid="cat-add-btn" className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500" onClick={() => open({ ...EMPTY, order: categories.length })}><Plus className="h-4 w-4 mr-1" /> New category</Button>
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {sorted.map((c, i) => { const Icon = categoryIcon(c.icon); const t = c.theme || {}; return (
          <div key={c.slug} className="flex items-center gap-3 p-3" data-testid={`cat-row-${c.slug}`}>
            <div className="flex flex-col"><button onClick={() => move(i, -1)} data-testid={`cat-up-${c.slug}`}><ArrowUp className="h-3.5 w-3.5 text-muted-foreground" /></button><button onClick={() => move(i, 1)} data-testid={`cat-down-${c.slug}`}><ArrowDown className="h-3.5 w-3.5 text-muted-foreground" /></button></div>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: t.active_bg || t.accent, color: t.active_text || "#fff" }}><Icon className="h-5 w-5" /></div>
            <img src={fileUrl(c.banner)} alt="" className="h-10 w-16 rounded-lg object-cover hidden sm:block bg-muted" />
            <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{c.name} {c.is_all && <span className="text-[10px] text-purple-600 font-bold">ALL</span>}</div><div className="text-xs text-muted-foreground truncate">/{c.slug} · {c.icon} · <span style={{ color: t.accent }}>{t.accent}</span> / {t.secondary} · order {c.order}</div></div>
            <Switch data-testid={`cat-active-${c.slug}`} checked={!!c.active} disabled={c.is_all} onCheckedChange={(v) => quick(c, { active: v })} />
            <Button size="icon" variant="ghost" data-testid={`cat-edit-${c.slug}`} onClick={() => open(c)}><Pencil className="h-4 w-4" /></Button>
          </div>); })}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="cat-dialog">
          <DialogHeader><DialogTitle>{edit?.id ? `Edit · ${edit.name}` : "New category"}</DialogTitle></DialogHeader>
          {edit && <div className="grid lg:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Category name</Label><Input data-testid="cat-name" className="rounded-xl" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Slug</Label><Input data-testid="cat-slug" className="rounded-xl font-mono text-xs" value={edit.slug} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} placeholder="auto from name" /></div>
                <div className="space-y-1"><Label>Display order</Label><Input data-testid="cat-order" type="number" className="rounded-xl" value={edit.order} onChange={(e) => setEdit({ ...edit, order: e.target.value })} /></div>
                <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm mt-5"><span>Active</span><Switch data-testid="cat-active-toggle" checked={edit.active} disabled={edit.is_all} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /></label>
              </div>
              <div className="space-y-1"><Label>Description (fallback subtitle)</Label><Input className="rounded-xl" value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div><Label className="mb-1 block">Icon</Label><IconPicker value={edit.icon} onChange={(icon) => setEdit({ ...edit, icon })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Primary colour" testId="cat-color-primary" value={edit.theme.accent} onChange={(v) => setT("accent", v)} />
                <ColorField label="Secondary / accent colour" testId="cat-color-secondary" value={edit.theme.secondary} onChange={(v) => setT("secondary", v)} />
                <div className="space-y-1"><Label className="text-xs">Active background (CSS colour/gradient)</Label><div className="flex gap-2"><Input data-testid="cat-active-bg" className="h-9 rounded-xl font-mono text-xs" value={edit.theme.active_bg || ""} placeholder={`linear-gradient(135deg, ${edit.theme.accent}, ${edit.theme.secondary})`} onChange={(e) => setT("active_bg", e.target.value)} /><input type="color" title="Solid colour" value="#7C3AED" onChange={(e) => setT("active_bg", e.target.value)} className="h-9 w-10 rounded-lg border border-border p-0.5 bg-transparent" /></div></div>
                <ColorField label="Active text / icon colour" testId="cat-color-active-text" value={edit.theme.active_text} onChange={(v) => setT("active_text", v)} />
                <div className="space-y-1"><Label className="text-xs">Header colour (CSS colour/gradient)</Label><div className="flex gap-2"><Input data-testid="cat-header-color" className="h-9 rounded-xl font-mono text-xs" value={edit.theme.header_color || ""} placeholder="defaults to active background" onChange={(e) => setT("header_color", e.target.value)} /><input type="color" value={/^#[0-9a-fA-F]{6}$/.test(edit.theme.header_color || "") ? edit.theme.header_color : edit.theme.accent} onChange={(e) => setT("header_color", e.target.value)} className="h-9 w-10 rounded-lg border border-border p-0.5 bg-transparent" /></div></div>
                <ColorField label="Light / background colour" testId="cat-color-light" value={edit.theme.light_bg} onChange={(v) => setT("light_bg", v)} />
                <ColorField label="Section heading colour" testId="cat-color-heading" value={edit.theme.heading_color} onChange={(v) => setT("heading_color", v)} />
                <div className="space-y-1"><Label className="text-xs">Button colour (CSS colour/gradient)</Label><div className="flex gap-2"><Input data-testid="cat-button-color" className="h-9 rounded-xl font-mono text-xs" value={edit.theme.button_color || ""} placeholder="defaults to active background" onChange={(e) => setT("button_color", e.target.value)} /><input type="color" value={/^#[0-9a-fA-F]{6}$/.test(edit.theme.button_color || "") ? edit.theme.button_color : edit.theme.accent} onChange={(e) => setT("button_color", e.target.value)} className="h-9 w-10 rounded-lg border border-border p-0.5 bg-transparent" /></div></div>
              </div>
              <div className="rounded-2xl border border-border p-3 space-y-3">
                <div className="flex items-center justify-between"><Label>Banner image</Label><div className="flex gap-1">
                  {edit.banner && <Button size="sm" variant="ghost" className="h-7 text-xs" data-testid="cat-banner-remove" onClick={() => setEdit({ ...edit, banner: "" })}><X className="h-3.5 w-3.5 mr-1" /> Remove</Button>}
                  {original?.banner && original.banner !== edit.banner && <Button size="sm" variant="ghost" className="h-7 text-xs" data-testid="cat-banner-reset" onClick={() => setEdit({ ...edit, banner: original.banner })}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset</Button>}</div></div>
                {edit.banner && <img src={fileUrl(edit.banner)} alt="" className="h-24 w-full rounded-xl object-cover" data-testid="cat-banner-preview" />}
                <FileUpload value={[]} onChange={(ids) => ids[0] && setEdit({ ...edit, banner: `/api/files/${ids[0]}` })} max={1} purpose="banner" testId="cat-banner-upload" label={edit.banner ? "Replace image" : "Upload image"} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Banner title</Label><Input data-testid="cat-banner-title" className="rounded-xl" value={edit.banner_title || ""} onChange={(e) => setEdit({ ...edit, banner_title: e.target.value })} placeholder={`${edit.name || "Category"} in Hyderabad`} /></div>
                  <div className="space-y-1"><Label className="text-xs">Overlay opacity · {Math.round((edit.theme.overlay ?? 0.75) * 100)}%</Label><input data-testid="cat-overlay" type="range" min="0" max="1" step="0.05" value={edit.theme.overlay ?? 0.75} onChange={(e) => setT("overlay", Number(e.target.value))} className="w-full accent-purple-600 mt-3" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Banner subtitle</Label><Textarea data-testid="cat-banner-subtitle" className="rounded-xl min-h-10" value={edit.banner_subtitle || ""} onChange={(e) => setEdit({ ...edit, banner_subtitle: e.target.value })} placeholder={edit.description} /></div>
              </div>
              {!edit.is_all && <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Subcategories (comma separated)</Label><Textarea className="rounded-xl min-h-10 text-xs" value={(edit.subcategories || []).join(", ")} onChange={(e) => setEdit({ ...edit, subcategories: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
                <div className="space-y-1"><Label className="text-xs">Amenities (comma separated)</Label><Textarea className="rounded-xl min-h-10 text-xs" value={(edit.amenities || []).join(", ")} onChange={(e) => setEdit({ ...edit, amenities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
              </div>}
            </div>
            <div className="space-y-4">
              <Preview c={edit} />
              <Button data-testid="cat-save-btn" onClick={save} disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save category"}</Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
