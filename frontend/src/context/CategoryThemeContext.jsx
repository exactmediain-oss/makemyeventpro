import { createContext, useContext, useState, useMemo } from "react";

const ThemeContext = createContext(null);
export const useCategoryTheme = () => useContext(ThemeContext);

const DEFAULT_THEME = {
  gradient: "from-blue-600 via-purple-600 to-pink-500",
  accent: "#7C3AED",
  bg_soft: "rgba(124,58,237,0.06)",
  glow: "rgba(124,58,237,0.25)",
};

export const CategoryThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [activeSlug, setActiveSlug] = useState("all");

  const value = useMemo(() => ({
    theme, activeSlug,
    applyTheme: (t, slug) => { setTheme(t || DEFAULT_THEME); setActiveSlug(slug || "all"); },
    resetTheme: () => { setTheme(DEFAULT_THEME); setActiveSlug("all"); },
  }), [theme, activeSlug]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export { DEFAULT_THEME };
