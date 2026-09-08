import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import api from "@/lib/api";
import { toast } from "sonner";

const TYPES = ["text", "number", "currency", "boolean", "select", "multiselect", "checkbox", "date", "time", "datetime", "range", "file", "image", "video", "url"];
const FLAGS = [["required", "Required"], ["customer_visible", "Customer visible"], ["vendor_only", "Vendor only"], ["filterable", "Filterable"], ["searchable", "Searchable"], ["featured", "Featured"], ["active", "Active"]];
const EMPTY = { label: "", type: "text", options: [], unit: "", help_text: "", default: "", required: false, customer_visible: true, vendor_only: false, filterable: false, searchable: false, featured: false, active: true, group: "Details", subcategory: null, order: 100 };

export default function FieldBuilderTab({ categories }) {
  const [cat, setCat] = useState(categories[0]?.slug || "");
  const [fields, setFields] = useState([]); const [edit, setEdit] = useState(null); const [busy, setBusy] = useState(false);
  const load = () => cat && api.get(`/admin/fields?category=${cat}`).then((r) => setFields(r.data));
  useEffect(() => { load(); }, [cat]); // eslint-disable-line

  const save = async () => {
    setBusy(true);
    const body = { ...edit, category_slug: cat, options: typeof edit.options === "string" ? edit.options.split(",").map((s) => s.trim()).filter(Boolean) : edit.options, unit: edit.unit || null, help_text: edit.help_text || null, default: edit.default || null, subcategory: edit.subcategory || null, min: edit.min === "" ? null : edit.min, max: edit.max === "" ? null : edit.max };
    try { if (edit.id) await api.put(`/admin/fields/${edit.id}`, body); else await api.post("/admin/fields", body); toast.success("Field saved"); setEdit(null); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  const del = async (f) => { if (!window.confirm(`Delete field "${f.label}"?`)) return; await api.delete(`/admin/fields/${f.id}`); load(); };
  const move = async (i, dir) => { const arr = [...fields]; const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; setFields(arr); await api.post("/admin/fields/reorder", { ids: arr.map((f) => f.id) }); };
  const category = categories.find((c) => c.slug === cat);

  return (
    <div data-testid="field-builder">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={cat} onValueChange={setCat}><SelectTrigger data-testid="fb-category-select" className="w-64 rounded-xl"><SelectValue /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900 rounded-xl">{categories.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Button data-testid="fb-add-btn" className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500" onClick={() => setEdit({ ...EMPTY, order: (fields.length + 1) * 10 })}><Plus className="h-4 w-4 mr-1" /> Add field</Button>
        <span className="text-sm text-muted-foreground">{fields.length} fields · no code changes needed</span>
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {fields.length === 0 && <p className="p-8 text-center text-muted-foreground">No fields yet for this category.</p>}
        {fields.map((f, i) => (
          <div key={f.id} className="flex items-center gap-3 p-3" data-testid={`fb-row-${f.key}`}>
            <div className="flex flex-col"><button onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5 text-muted-foreground" /></button><button onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5 text-muted-foreground" /></button></div>
            <div className="flex-1 min-w-0"><div className="font-medium text-sm">{f.label} <code className="text-[11px] text-muted-foreground">{f.key}</code>{f.subcategory && <span className="ml-1 text-[11px] text-purple-600">· {f.subcategory}</span>}</div>
              <div className="flex flex-wrap gap-1 mt-1">{[f.type, f.group, f.unit, f.required && "required", f.filterable && "filter", f.searchable && "search", f.featured && "featured", f.vendor_only && "vendor-only", !f.customer_visible && "hidden", !f.active && "inactive"].filter(Boolean).map((t, k) => <span key={k} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">{t}</span>)}</div></div>
            <Button size="icon" variant="ghost" data-testid={`fb-edit-${f.key}`} onClick={() => setEdit({ ...f, options: (f.options || []).join(", ") })}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" data-testid={`fb-delete-${f.key}`} onClick={() => del(f)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
          </div>))}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto" data-testid="fb-dialog">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit field" : "New field"} · {category?.name}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>Label</Label><Input data-testid="fb-label" className="rounded-xl" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></div>
              <div className="space-y-1"><Label>Type</Label><Select value={edit.type} onValueChange={(t) => setEdit({ ...edit, type: t })}><SelectTrigger data-testid="fb-type" className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900 rounded-xl">{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Group</Label><Input className="rounded-xl" value={edit.group || ""} onChange={(e) => setEdit({ ...edit, group: e.target.value })} /></div>
              <div className="space-y-1"><Label>Subcategory (optional)</Label><Select value={edit.subcategory || "__all"} onValueChange={(s) => setEdit({ ...edit, subcategory: s === "__all" ? null : s })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900 rounded-xl"><SelectItem value="__all">All subcategories</SelectItem>{(category?.subcategories || []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Unit</Label><Input className="rounded-xl" value={edit.unit || ""} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="guests, km, ₹" /></div>
              {["select", "multiselect"].includes(edit.type) && <div className="col-span-2 space-y-1"><Label>Options (comma separated)</Label><Input data-testid="fb-options" className="rounded-xl" value={edit.options} onChange={(e) => setEdit({ ...edit, options: e.target.value })} /></div>}
              {["number", "currency", "range"].includes(edit.type) && <><div className="space-y-1"><Label>Min</Label><Input type="number" className="rounded-xl" value={edit.min ?? ""} onChange={(e) => setEdit({ ...edit, min: e.target.value === "" ? "" : Number(e.target.value) })} /></div><div className="space-y-1"><Label>Max</Label><Input type="number" className="rounded-xl" value={edit.max ?? ""} onChange={(e) => setEdit({ ...edit, max: e.target.value === "" ? "" : Number(e.target.value) })} /></div></>}
              <div className="space-y-1"><Label>Default value</Label><Input className="rounded-xl" value={edit.default ?? ""} onChange={(e) => setEdit({ ...edit, default: e.target.value })} /></div>
              <div className="space-y-1"><Label>Order</Label><Input type="number" className="rounded-xl" value={edit.order} onChange={(e) => setEdit({ ...edit, order: Number(e.target.value) })} /></div>
              <div className="col-span-2 space-y-1"><Label>Help text</Label><Input className="rounded-xl" value={edit.help_text || ""} onChange={(e) => setEdit({ ...edit, help_text: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">{FLAGS.map(([k, l]) => <label key={k} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"><span>{l}</span><Switch data-testid={`fb-flag-${k}`} checked={!!edit[k]} onCheckedChange={(v) => setEdit({ ...edit, [k]: v })} /></label>)}</div>
            <Button data-testid="fb-save-btn" onClick={save} disabled={busy || !edit.label} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save field"}</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
