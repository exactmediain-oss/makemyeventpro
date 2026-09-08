import { useEffect, useState } from "react";
import { Plus, Trash2, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import api from "@/lib/api";
import { toast } from "sonner";

const ORDER = ["country", "state", "city", "area", "pincode"];

export default function LocationsTab() {
  const [all, setAll] = useState([]); const [sel, setSel] = useState({}); const [edit, setEdit] = useState(null); const [busy, setBusy] = useState(false);
  const load = () => api.get("/locations?active_only=false").then((r) => setAll(r.data));
  useEffect(() => { load(); }, []);
  const children = (type, parentId) => all.filter((l) => l.type === type && (type === "country" || l.parent_id === parentId));
  const save = async () => {
    setBusy(true);
    try { if (edit.id) await api.put(`/admin/locations/${edit.id}`, edit); else await api.post("/admin/locations", edit); toast.success("Saved"); setEdit(null); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  const del = async (l) => { if (!window.confirm(`Delete ${l.name}?`)) return; try { await api.delete(`/admin/locations/${l.id}`); load(); } catch (e) { toast.error(e.response?.data?.detail || "Failed"); } };

  return (
    <div data-testid="locations-tab">
      <p className="text-sm text-muted-foreground mb-4">Country → State → City → Area → Pincode. Add new cities/areas here — discovery, onboarding and banners pick them up automatically.</p>
      <div className="grid md:grid-cols-5 gap-3">
        {ORDER.map((type, i) => {
          const parentId = i === 0 ? null : sel[ORDER[i - 1]];
          const list = i === 0 || parentId ? children(type, parentId) : [];
          return (
            <div key={type} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{type}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i > 0 && !parentId} data-testid={`loc-add-${type}`} onClick={() => setEdit({ type, name: "", parent_id: parentId, lat: null, lng: null, pincode: "", active: true, order: 100, is_launch: false })}><Plus className="h-4 w-4" /></Button></div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {list.map((l) => (
                  <div key={l.id} className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm cursor-pointer ${sel[type] === l.id ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 font-semibold" : "hover:bg-muted"}`} onClick={() => setSel({ ...sel, [type]: l.id })} data-testid={`loc-item-${l.slug}`}>
                    <span className="truncate">{l.name}{!l.active && <span className="text-[10px] text-red-400 ml-1">off</span>}</span>
                    <span className="hidden group-hover:flex gap-1"><button onClick={(e) => { e.stopPropagation(); setEdit(l); }}><MapPin className="h-3.5 w-3.5" /></button><button onClick={(e) => { e.stopPropagation(); del(l); }}><Trash2 className="h-3.5 w-3.5 text-red-400" /></button></span>
                  </div>))}
                {list.length === 0 && <p className="text-xs text-muted-foreground p-2">{i > 0 && !parentId ? "Select parent" : "Empty"}</p>}
              </div>
            </div>);
        })}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="bg-white dark:bg-slate-900 rounded-3xl max-w-md" data-testid="loc-dialog">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit" : "Add"} {edit?.type}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input data-testid="loc-name" className="rounded-xl" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Latitude</Label><Input data-testid="loc-lat" type="number" step="any" className="rounded-xl" value={edit.lat ?? ""} onChange={(e) => setEdit({ ...edit, lat: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Longitude</Label><Input data-testid="loc-lng" type="number" step="any" className="rounded-xl" value={edit.lng ?? ""} onChange={(e) => setEdit({ ...edit, lng: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Pincode</Label><Input className="rounded-xl" value={edit.pincode || ""} onChange={(e) => setEdit({ ...edit, pincode: e.target.value })} /></div>
              <div className="space-y-1"><Label>Order</Label><Input type="number" className="rounded-xl" value={edit.order} onChange={(e) => setEdit({ ...edit, order: Number(e.target.value) })} /></div>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"><span>Active</span><Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /></label>
            {edit.type === "city" && <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"><span>Launch city</span><Switch checked={edit.is_launch} onCheckedChange={(v) => setEdit({ ...edit, is_launch: v })} /></label>}
            <Button data-testid="loc-save-btn" onClick={save} disabled={busy || !edit.name} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
