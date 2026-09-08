import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, Star, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatINR } from "@/lib/constants";

export default function CompareDrawer({ open, onOpenChange, vendors, onRemove }) {
  const navigate = useNavigate();
  const rows = [
    { label: "Rating", get: (v) => `${v.rating} ★ (${v.review_count})` },
    { label: "Starting Price", get: (v) => `${formatINR(v.starting_price)} / ${v.price_unit.replace("per ", "")}` },
    { label: "Capacity / Note", get: (v) => v.capacity_note },
    { label: "Location", get: (v) => v.area },
    { label: "Verified", get: (v) => (v.verified ? "Yes" : "No") },
    { label: "Experience", get: (v) => `${v.years} yrs` },
    { label: "Response", get: (v) => v.response_time },
    { label: "Top Amenities", get: (v) => (v.amenities || []).slice(0, 3).join(", ") || "—" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-white dark:bg-slate-900 rounded-t-3xl max-h-[85vh] overflow-y-auto" data-testid="compare-drawer">
        <SheetHeader><SheetTitle className="font-display text-xl">Compare Vendors</SheetTitle></SheetHeader>
        <div className="mt-4 overflow-x-auto no-scrollbar">
          <div className="grid gap-3" style={{ gridTemplateColumns: `140px repeat(${vendors.length}, minmax(160px, 1fr))` }}>
            <div />
            {vendors.map((v) => (
              <div key={v.id} className="relative rounded-2xl overflow-hidden border border-border">
                <button onClick={() => onRemove(v)} className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center">
                  <X className="h-3.5 w-3.5" />
                </button>
                <img src={v.cover} alt={v.business_name} className="w-full h-20 object-cover" />
                <div className="p-2">
                  <div className="text-xs font-bold flex items-center gap-1 truncate">{v.business_name}{v.verified && <BadgeCheck className="h-3 w-3 text-blue-500" />}</div>
                </div>
              </div>
            ))}
            {rows.map((r) => (
              <div key={r.label} className="contents">
                <div className="py-3 text-xs font-semibold text-muted-foreground border-t border-border flex items-center">{r.label}</div>
                {vendors.map((v) => <div key={v.id} className="py-3 text-sm border-t border-border">{r.get(v)}</div>)}
              </div>
            ))}
            <div />
            {vendors.map((v) => (
              <button key={v.id} data-testid={`compare-view-${v.slug}`} onClick={() => { onOpenChange(false); navigate(`/vendor/${v.slug}`); }}
                className="mt-2 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-semibold">View</button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
