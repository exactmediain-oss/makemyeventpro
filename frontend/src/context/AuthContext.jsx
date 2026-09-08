import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("mmep_token");
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      localStorage.removeItem("mmep_token");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    if (!localStorage.getItem("mmep_token")) return;
    try {
      const { data } = await api.get("/favorites");
      setFavorites(data.vendor_ids || []);
    } catch (e) {}
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => { if (user) loadFavorites(); }, [user, loadFavorites]);

  const login = (token, u) => {
    localStorage.setItem("mmep_token", token);
    setUser(u);
    setAuthOpen(false);
  };

  const logout = () => {
    localStorage.removeItem("mmep_token");
    setUser(null);
    setFavorites([]);
  };

  const toggleFavorite = async (vendorId) => {
    if (!user) { setAuthOpen(true); return; }
    const { data } = await api.post("/favorites/toggle", { vendor_id: vendorId });
    setFavorites((prev) => data.favorited ? [...prev, vendorId] : prev.filter((id) => id !== vendorId));
    return data.favorited;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authOpen, setAuthOpen, favorites, toggleFavorite, loadFavorites }}>
      {children}
    </AuthContext.Provider>
  );
};
