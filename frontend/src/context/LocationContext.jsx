import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const LocationContext = createContext(null);
export const useLocationCtx = () => useContext(LocationContext);

const saved = JSON.parse(localStorage.getItem("mmep_loc") || "null");

export const LocationProvider = ({ children }) => {
  const [tree, setTree] = useState([]);
  const [loc, setLoc] = useState(saved || { city: "Hyderabad", area: "Jubilee Hills", lat: null, lng: null, source: "default" });
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => { api.get("/locations/tree").then((r) => setTree(r.data)).catch(() => {}); }, []);
  useEffect(() => { localStorage.setItem("mmep_loc", JSON.stringify(loc)); }, [loc]);

  const selectArea = useCallback((area, city = "Hyderabad") => {
    const c = tree.find((x) => x.name === city);
    const a = c?.areas.find((x) => x.name === area);
    setLoc({ city, area, lat: a?.lat ?? null, lng: a?.lng ?? null, pincode: a?.pincode, source: "manual" });
  }, [tree]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) return Promise.reject(new Error("GPS not supported"));
    setGpsLoading(true);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const { data } = await api.get(`/locations/nearest?lat=${lat}&lng=${lng}`);
          setLoc({ city: data.city?.name || "Hyderabad", area: data.area.name, lat, lng, pincode: data.area.pincode, source: "gps" });
          resolve(data);
        } catch (e) { reject(e); } finally { setGpsLoading(false); }
      }, (err) => { setGpsLoading(false); reject(err); }, { timeout: 8000 });
    });
  }, []);

  const areas = tree.find((c) => c.name === loc.city)?.areas || [];
  return (
    <LocationContext.Provider value={{ loc, tree, areas, selectArea, locateMe, gpsLoading }}>
      {children}
    </LocationContext.Provider>
  );
};
