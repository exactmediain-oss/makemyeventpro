import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { useCategoryTheme } from "@/context/CategoryThemeContext";

export default function CategoryBar({ categories, active }) {
  const navigate = useNavigate();
  const { applyTheme } = useCategoryTheme();

  const go = (c) => {
    applyTheme(c.theme, c.slug);
    navigate(`/category/${c.slug}`);
  };

  return (
    <div className="border-b border-border bg-background/60 backdrop-blur sticky top-16 sm:top-20 z-30">
      <div className="max-w-7xl mx-auto px-2 sm:px-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-3">
          {categories.map((c, i) => {
            const Icon = Icons[c.icon] || Icons.Sparkles;
            const isActive = active === c.slug;
            return (
              <motion.button
                key={c.slug}
                data-testid={`category-chip-${c.slug}`}
                onClick={() => go(c)}
                whileTap={{ scale: 0.95 }}
                className={`shrink-0 flex flex-col items-center gap-1.5 px-3 sm:px-4 py-2 rounded-2xl transition-colors duration-300 min-w-[76px] ${
                  isActive ? "text-white shadow-lg" : "hover:bg-muted"
                }`}
                style={isActive ? { background: `linear-gradient(135deg, ${c.theme?.accent || "#7C3AED"}, #EC4899)` } : {}}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isActive ? "bg-white/20" : ""}`}
                  style={!isActive ? { background: c.theme?.bg_soft || "rgba(124,58,237,0.06)" } : {}}>
                  <Icon className="h-5 w-5" style={!isActive ? { color: c.theme?.accent } : {}} />
                </div>
                <span className="text-[11px] font-semibold text-center leading-tight whitespace-nowrap">
                  {c.name.split(" ")[0]}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
