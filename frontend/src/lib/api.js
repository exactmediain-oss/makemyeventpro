import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mmep_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401 && localStorage.getItem("mmep_token") && !err.config?.url?.includes("/auth/")) {
    localStorage.removeItem("mmep_token");
    window.dispatchEvent(new Event("mmep:logout"));
  }
  return Promise.reject(err);
});

export const fileUrl = (idOrUrl, priv = false) => {
  if (!idOrUrl) return "";
  if (idOrUrl.startsWith("http")) return idOrUrl;
  const id = idOrUrl.replace("/api/files/", "");
  const t = priv ? `?auth=${localStorage.getItem("mmep_token")}` : "";
  return `${API}/files/${id}${t}`;
};

export default api;
