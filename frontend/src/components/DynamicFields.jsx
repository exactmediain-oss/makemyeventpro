import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUpload from "@/components/FileUpload";
import { Check, X } from "lucide-react";
import { formatINR } from "@/lib/constants";

// Renders vendor-side inputs for admin-defined field definitions. values: {key: val}
export function DynamicFieldsForm({ fields, values = {}, onChange, errors = {} }) {
  const set = (k, v) => onChange({ ...values, [k]: v });
  const groups = fields.reduce((acc, f) => { (acc[f.group || "Details"] ||= []).push(f); return acc; }, {});
  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([g, fs]) => (
        <div key={g}>
          <h4 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">{g}</h4>
          <div className="grid sm:grid-cols-2 gap-4">
            {fs.map((f) => (
              <div key={f.key} className={`space-y-1.5 ${["boolean","checkbox"].includes(f.type) ? "flex items-center justify-between rounded-xl border border-border px-3 py-2.5 sm:col-span-1" : ""}`} data-testid={`field-${f.key}`}>
                <Label className="text-sm">{f.label}{f.required && <span className="text-pink-500"> *</span>}{f.unit && <span className="text-muted-foreground"> ({f.unit})</span>}</Label>
                <FieldInput f={f} value={values[f.key]} set={(v) => set(f.key, v)} />
                {f.help_text && !["boolean","checkbox"].includes(f.type) && <p className="text-xs text-muted-foreground">{f.help_text}</p>}
                {errors[f.key] && <p className="text-xs text-red-500">{errors[f.key]}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldInput({ f, value, set }) {
  const cls = "rounded-xl";
  switch (f.type) {
    case "boolean": return <Switch checked={!!value} onCheckedChange={set} />;
    case "checkbox": return <Checkbox checked={!!value} onCheckedChange={set} />;
    case "number": case "currency": return <Input type="number" className={cls} value={value ?? ""} min={f.min ?? undefined} max={f.max ?? undefined} onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))} placeholder={f.default ?? ""} />;
    case "range": return (
      <div className="flex gap-2">
        <Input type="number" className={cls} placeholder="Min" value={value?.min ?? ""} onChange={(e) => set({ ...(value || {}), min: Number(e.target.value) })} />
        <Input type="number" className={cls} placeholder="Max" value={value?.max ?? ""} onChange={(e) => set({ ...(value || {}), max: Number(e.target.value) })} />
      </div>);
    case "select": return (
      <Select value={value || ""} onValueChange={set}>
        <SelectTrigger className={cls}><SelectValue placeholder="Select" /></SelectTrigger>
        <SelectContent className="bg-white dark:bg-slate-900 rounded-xl">{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>);
    case "multiselect": return (
      <div className="flex flex-wrap gap-2">
        {f.options.map((o) => { const on = (value || []).includes(o); return (
          <button type="button" key={o} onClick={() => set(on ? value.filter((x) => x !== o) : [...(value || []), o])}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${on ? "bg-purple-600 text-white border-purple-600" : "border-border hover:border-purple-300"}`}>{o}</button>); })}
      </div>);
    case "date": return <Input type="date" className={cls} value={value || ""} onChange={(e) => set(e.target.value)} />;
    case "time": return <Input type="time" className={cls} value={value || ""} onChange={(e) => set(e.target.value)} />;
    case "datetime": return <Input type="datetime-local" className={cls} value={value || ""} onChange={(e) => set(e.target.value)} />;
    case "url": return <Input type="url" className={cls} value={value || ""} placeholder="https://" onChange={(e) => set(e.target.value)} />;
    case "image": return <FileUpload value={value ? [value] : []} onChange={(v) => set(v[0] || null)} kind="image" max={1} purpose="fields" testId={`upload-${f.key}`} />;
    case "video": return <FileUpload value={value ? [value] : []} onChange={(v) => set(v[0] || null)} kind="video" max={1} purpose="fields" testId={`upload-${f.key}`} />;
    case "file": return <FileUpload value={value ? [value] : []} onChange={(v) => set(v[0] || null)} kind="document" max={1} purpose="fields" testId={`upload-${f.key}`} />;
    default: return <Input className={cls} value={value || ""} onChange={(e) => set(e.target.value)} placeholder={f.default ?? ""} />;
  }
}

// Customer-facing display of field values
export function DynamicFieldsDisplay({ fields, values = {}, featuredOnly = false }) {
  const list = fields.filter((f) => values[f.key] !== undefined && values[f.key] !== null && values[f.key] !== "" && (!featuredOnly || f.featured));
  if (!list.length) return null;
  const fmt = (f, v) => {
    if (typeof v === "boolean") return v ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-red-400" />;
    if (f.type === "currency") return formatINR(v);
    if (Array.isArray(v)) return v.join(", ");
    if (f.type === "range") return `${v.min ?? "—"} – ${v.max ?? "—"}`;
    return `${v}${f.unit && f.type !== "currency" ? " " + f.unit : ""}`;
  };
  return (
    <div className={`grid ${featuredOnly ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"} gap-3`} data-testid="dynamic-fields-display">
      {list.map((f) => (
        <div key={f.key} className="rounded-xl bg-muted/60 px-3 py-2">
          <div className="text-[11px] text-muted-foreground">{f.label}</div>
          <div className="text-sm font-semibold flex items-center gap-1">{fmt(f, values[f.key])}</div>
        </div>
      ))}
    </div>
  );
}
