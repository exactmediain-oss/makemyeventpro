import { useRef, useState } from "react";
import { Upload, X, Loader2, FileText, Play } from "lucide-react";
import api, { fileUrl } from "@/lib/api";
import { toast } from "sonner";

// value: array of file ids (or urls). kind: image|video|document. purpose: gallery|kyc|logo|cover|chat|banner
export default function FileUpload({ value = [], onChange, kind = "image", purpose = "gallery", max = 10, label, testId = "file-upload", priv = false }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const accept = { image: "image/*", video: "video/mp4,video/webm,video/quicktime", document: "application/pdf,image/*" }[kind];

  const upload = async (files) => {
    const list = Array.from(files).slice(0, max - value.length);
    if (!list.length) return;
    setBusy(true);
    const added = [];
    for (const f of list) {
      const fd = new FormData();
      fd.append("file", f); fd.append("kind", kind); fd.append("purpose", purpose);
      try {
        const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        added.push(data.id);
      } catch (e) { toast.error(e.response?.data?.detail || `Upload failed: ${f.name}`); }
    }
    onChange([...value, ...added]);
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      {label && <div className="text-sm font-semibold">{label}</div>}
      <div className="flex flex-wrap gap-3">
        {value.map((id) => (
          <div key={id} className="relative h-24 w-24 rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center" data-testid={`${testId}-item`}>
            {kind === "image" ? <img src={fileUrl(id, priv)} alt="" className="h-full w-full object-cover" />
              : kind === "video" ? <Play className="h-8 w-8 text-purple-500" /> : <FileText className="h-8 w-8 text-purple-500" />}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))}
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" data-testid={testId} onClick={() => ref.current.click()} disabled={busy}
            className="h-24 w-24 rounded-xl border-2 border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 flex flex-col items-center justify-center gap-1 text-xs text-purple-600 transition-colors">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Upload className="h-5 w-5" /> Upload</>}
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept={accept} multiple={max > 1} className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
