"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { inputClass } from "@/components/forms/field";
import { CAMPUS_CENTRE, CAMPUS_ZOOM, TILE_ATTRIBUTION, TILE_URL } from "@/components/map/map-config";
import { btn } from "./ui";

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Click or drag on the map to set a place's location. Writes `lat` and `lng`
 * form fields; both empty means "not pinned yet".
 */
export function LocationPicker({ lat, lng, error }: { lat: number | null; lng: number | null; error?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [pos, setPos] = useState<{ lat: string; lng: string }>({ lat: lat == null ? "" : String(lat), lng: lng == null ? "" : String(lng) });
  const place = useRef<(la: number, ln: number) => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false }).setView(lat != null && lng != null ? [lat, lng] : CAMPUS_CENTRE, CAMPUS_ZOOM);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 20, subdomains: "abcd" }).addTo(m);
      const icon = L.divIcon({ className: "", html: '<span class="map-pin map-pin--venue"></span>', iconSize: [28, 36], iconAnchor: [14, 34] });
      place.current = (la, ln) => {
        if (!marker.current) {
          marker.current = L.marker([la, ln], { draggable: true, icon, keyboard: false }).addTo(m);
          marker.current.on("dragend", () => {
            const p = marker.current!.getLatLng();
            setPos({ lat: String(round(p.lat)), lng: String(round(p.lng)) });
          });
        } else marker.current.setLatLng([la, ln]);
      };
      if (lat != null && lng != null) place.current(lat, lng);
      m.on("click", (e) => {
        place.current(e.latlng.lat, e.latlng.lng);
        setPos({ lat: String(round(e.latlng.lat)), lng: String(round(e.latlng.lng)) });
      });
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [lat, lng]);

  const typed = (k: "lat" | "lng", v: string) => {
    const next = { ...pos, [k]: v };
    setPos(next);
    const la = Number(next.lat), ln = Number(next.lng);
    if (next.lat && next.lng && Number.isFinite(la) && Number.isFinite(ln)) {
      place.current(la, ln);
      map.current?.panTo([la, ln]);
    }
  };

  const clear = () => {
    marker.current?.remove();
    marker.current = null;
    setPos({ lat: "", lng: "" });
  };

  return (
    <div className="space-y-3">
      <div ref={el} className="h-72 w-full overflow-hidden rounded-md border border-navy/15" role="application" aria-label="Map: click to set the location" />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-ink">
          Latitude
          <input name="lat" inputMode="decimal" value={pos.lat} onChange={(e) => typed("lat", e.target.value)} className={`${inputClass} mt-1`} aria-invalid={Boolean(error)} />
        </label>
        <label className="text-sm font-medium text-ink">
          Longitude
          <input name="lng" inputMode="decimal" value={pos.lng} onChange={(e) => typed("lng", e.target.value)} className={`${inputClass} mt-1`} aria-invalid={Boolean(error)} />
        </label>
        <button type="button" onClick={clear} className={btn.secondary}>Remove pin</button>
      </div>
    </div>
  );
}
