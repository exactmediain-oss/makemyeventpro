import { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
let loader;
const loadMaps = () => loader || (loader = new Promise((res, rej) => {
  if (window.google?.maps) return res(window.google);
  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places`;
  s.onload = () => res(window.google); s.onerror = rej; document.head.appendChild(s);
}));

// value: {lat, lng} | null. onChange({lat, lng, address?})
export default function MapPicker({ value, onChange, onAddress }) {
  const mapRef = useRef(); const inputRef = useRef();
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const center = value?.lat ? value : { lat: 17.385, lng: 78.4867 };

  useEffect(() => {
    if (!KEY) return;
    let map, marker;
    loadMaps().then((g) => {
      map = new g.maps.Map(mapRef.current, { center, zoom: 12, mapTypeControl: false, streetViewControl: false });
      marker = new g.maps.Marker({ position: center, map, draggable: true });
      const set = (ll) => { marker.setPosition(ll); onChange({ lat: ll.lat(), lng: ll.lng() }); };
      map.addListener("click", (e) => set(e.latLng));
      marker.addListener("dragend", (e) => set(e.latLng));
      if (inputRef.current) {
        const ac = new g.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: "in" } });
        ac.addListener("place_changed", () => {
          const p = ac.getPlace(); if (!p.geometry) return;
          map.setCenter(p.geometry.location); map.setZoom(15); set(p.geometry.location);
          onAddress?.(p.formatted_address, p.address_components);
        });
      }
      setReady(true);
    }).catch(() => setReady(false));
  }, []); // eslint-disable-line

  const locate = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition((p) => { onChange({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); }, () => setLocating(false));
  };

  return (
    <div className="space-y-3" data-testid="map-picker">
      {KEY ? (
        <>
          <Input ref={inputRef} placeholder="Search address or landmark (Google Maps)" className="rounded-xl" data-testid="map-search-input" />
          <div ref={mapRef} className="h-64 rounded-2xl border border-border bg-muted" />
          {!ready && <p className="text-xs text-muted-foreground">Loading Google Maps…</p>}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-pink-500" />
          <span>Google Maps not configured (set <code>REACT_APP_GOOGLE_MAPS_API_KEY</code>). Enter coordinates manually or use GPS.</span>
        </div>
      )}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Input data-testid="map-lat-input" type="number" step="any" placeholder="Latitude" value={value?.lat ?? ""} onChange={(e) => onChange({ ...value, lat: parseFloat(e.target.value) })} className="rounded-xl" />
        <Input data-testid="map-lng-input" type="number" step="any" placeholder="Longitude" value={value?.lng ?? ""} onChange={(e) => onChange({ ...value, lng: parseFloat(e.target.value) })} className="rounded-xl" />
        <Button type="button" variant="outline" className="rounded-xl" onClick={locate} data-testid="map-gps-btn">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
