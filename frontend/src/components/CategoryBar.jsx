import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { useCategoryTheme, resolveTheme } from "@/context/CategoryThemeContext";

export const categoryIcon = (name) => Icons[name] || Icons.Sparkles;

// Data-driven category chip: every colour comes from category.theme (admin-managed)
export default function CategoryBar({ categories, active }) {
  const navigate = useNavigate();
  const { applyTheme } = useCategoryTheme();

  const go = (c) => {
    applyTheme(c.theme, c.slug);
    navigate(c.is_all ? "/search" : `/category/${c.slug}`);
  };

  return (
    <div className="border-b border-border bg-background/60 backdrop-blur sticky top-16 sm:top-20 z-30" data-testid="category-bar">
      <div className="max-w-7xl mx-auto px-2 sm:px-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-3">
          {categories.map((c) => {
            const Icon = categoryIcon(c.icon);
            const isActive = active === c.slug || (c.is_all && active === "all");
            const t = resolveTheme(c.theme);
            const accent = t.accent;
            return (
              <motion.button
                key={c.slug}
                data-testid={`category-chip-${c.slug}`}
                data-active={isActive}
                onClick={() => go(c)}
                whileTap={{ scale: 0.95 }}
                className={`shrink-0 flex flex-col items-center gap-1.5 px-3 sm:px-4 py-2 rounded-2xl transition-colors duration-300 min-w-[76px] ${isActive ? "shadow-lg" : "hover:bg-muted"}`}
                style={isActive && !c.is_all ? { background: t.active_bg, color: t.active_text } : isActive ? { background: "linear-gradient(135deg, #2563EB, #7C3AED, #EC4899)", color: "#fff" } : {}}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isActive ? "bg-white/20" : ""}`}
                  style={!isActive ? { background: t.light_bg } : {}}>
                  <Icon className="h-5 w-5" style={{ color: isActive ? t.active_text : accent }} />
                </div>
                <span className="text-[11px] font-semibold text-center leading-tight whitespace-nowrap">
                  {c.is_all ? "All Categories" : c.name.split(" ")[0]}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
