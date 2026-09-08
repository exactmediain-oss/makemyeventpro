import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, Loader2, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api, { fileUrl } from "@/lib/api";
import { toast } from "sonner";

export default function Chat({ enquiryId, meRole }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(); const bottom = useRef();

  const load = async (after) => {
    const { data } = await api.get(`/enquiries/${enquiryId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`);
    if (data.length) setMsgs((m) => after ? [...m, ...data.filter((d) => !m.find((x) => x.id === d.id))] : data);
  };
  useEffect(() => { load(); }, [enquiryId]); // eslint-disable-line
  useEffect(() => {
    const t = setInterval(() => load(msgs[msgs.length - 1]?.created_at), 4000);
    return () => clearInterval(t);
  }, [msgs, enquiryId]); // eslint-disable-line
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async (file_id) => {
    if (!text.trim() && !file_id) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/enquiries/${enquiryId}/messages`, { text: text.trim() || null, file_id: file_id || null });
      setMsgs((m) => [...m, data]); setText("");
    } catch (e) { toast.error(e.response?.data?.detail || "Could not send"); } finally { setBusy(false); }
  };

  const attach = async (f) => {
    if (!f) return;
    const fd = new FormData(); fd.append("file", f); fd.append("kind", f.type.startsWith("image/") ? "image" : "document"); fd.append("purpose", "chat");
    setBusy(true);
    try { const { data } = await api.post("/files/upload", fd); await send(data.id); }
    catch (e) { toast.error(e.response?.data?.detail || "Upload failed"); setBusy(false); }
  };

  return (
    <div className="flex flex-col h-[480px] rounded-2xl border border-border bg-card overflow-hidden" data-testid="chat-panel">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
        {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">Start the conversation…</p>}
        {msgs.map((m) => {
          const mine = m.sender_role === meRole;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${m.id}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white" : "bg-white dark:bg-slate-800"}`}>
                {m.quote_id && <div className="text-[10px] uppercase font-bold opacity-80 mb-0.5">Quotation</div>}
                {m.file_id && (<a href={fileUrl(m.file_id, true)} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline mb-1"><FileText className="h-3.5 w-3.5" /> Attachment</a>)}
                {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                <div className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-muted-foreground"}`}>{new Date(m.created_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <div className="p-3 border-t border-border flex items-center gap-2">
        <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => { attach(e.target.files[0]); e.target.value = ""; }} />
        <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={() => fileRef.current.click()} data-testid="chat-attach-btn"><Paperclip className="h-4 w-4" /></Button>
        <Input data-testid="chat-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message…" className="rounded-xl" />
        <Button data-testid="chat-send-btn" onClick={() => send()} disabled={busy} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
