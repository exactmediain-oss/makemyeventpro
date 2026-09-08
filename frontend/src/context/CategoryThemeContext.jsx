import { createContext, useContext, useState, useMemo, useEffect, useCallback } from "react";

const ThemeContext = createContext(null);
export const useCategoryTheme = () => useContext(ThemeContext);

// Single source of truth for the brand/default theme. Category themes come from the backend (admin-managed).
const DEFAULT_THEME = {
  gradient: "from-blue-600 via-purple-600 to-pink-500",
  accent: "#7C3AED",
  secondary: "#EC4899",
  bg_soft: "rgba(124,58,237,0.06)",
  glow: "rgba(124,58,237,0.25)",
  active_bg: "linear-gradient(135deg, #2563EB, #7C3AED, #EC4899)",
  active_text: "#FFFFFF",
  header_color: "",
  light_bg: "",
  heading_color: "",
  button_color: "",
  overlay: 0.75,
};

export const resolveTheme = (t) => {
  const th = { ...DEFAULT_THEME, ...(t || {}) };
  th.active_bg = th.active_bg || `linear-gradient(135deg, ${th.accent}, ${th.secondary})`;
  th.header_color = th.header_color || th.active_bg;
  th.light_bg = th.light_bg || `${th.accent}14`;
  th.heading_color = th.heading_color || th.accent;
  th.button_color = th.button_color || th.active_bg;
  return th;
};

export const CategoryThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(resolveTheme(DEFAULT_THEME));
  const [activeSlug, setActiveSlug] = useState("all");
  const themed = activeSlug !== "all";

  // Expose theme as CSS variables so any component/CSS can consume it without duplicating colours
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--cat-accent", theme.accent);
    r.setProperty("--cat-secondary", theme.secondary);
    r.setProperty("--cat-active-bg", theme.active_bg);
    r.setProperty("--cat-header", themed ? theme.header_color : "");
    r.setProperty("--cat-light", theme.light_bg);
    r.setProperty("--cat-heading", themed ? theme.heading_color : "inherit");
    r.setProperty("--cat-button", theme.button_color);
  }, [theme, themed]);

  const applyTheme = useCallback((t, slug) => { const isAll = !slug || slug === "all"; setTheme(resolveTheme(isAll ? DEFAULT_THEME : t)); setActiveSlug(isAll ? "all" : slug); }, []);
  const resetTheme = useCallback(() => { setTheme(resolveTheme(DEFAULT_THEME)); setActiveSlug("all"); }, []);
  const value = useMemo(() => ({ theme, activeSlug, themed, applyTheme, resetTheme }), [theme, activeSlug, themed, applyTheme, resetTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export { DEFAULT_THEME };
