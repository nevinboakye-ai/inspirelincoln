"use client";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { Navigation, ArrowUpRight, Clock, Crosshair, Footprints, Link2, LocateFixed, MapPin, School, Search, X } from "lucide-react";
import type { MapPlace } from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  CAMPUS_CENTRE,
  CAMPUS_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
  directionsUrl,
  distanceMetres,
  walkingMinutes,
} from "./map-config";
import { OSM_ATTRIBUTION, drawCampus, type CampusLayer } from "./campus-layer";

export interface MapSession {
  id: string;
  title: string;
  roomId: string | null;
  starts: string;
  ends: string | null;
  startsAt: string;
}

type Filter = "day" | "all";
type Sheet = "peek" | "half" | "full";
const SHEET_ORDER: Sheet[] = ["peek", "half", "full"];
const isPhone = () => typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches;
type Fix = { lat: number; lng: number; accuracy: number };

const KIND_LABEL: Record<MapPlace["kind"], string> = {
  venue: "Conference venue",
  room: "Room",
  building: "Campus building",
  landmark: "Landmark",
  amenity: "Facility",
};

/** A place's own coordinates, or its building's if it is a room without a pin. */
function resolve(place: MapPlace, byId: Map<string, MapPlace>): { lat: number; lng: number } | null {
  if (place.lat != null && place.lng != null) return { lat: place.lat, lng: place.lng };
  const parent = place.parentId ? byId.get(place.parentId) : undefined;
  if (parent?.lat != null && parent.lng != null) return { lat: parent.lat, lng: parent.lng };
  return null;
}

/** Places in town rather than on campus, such as the stations and the cathedral. */
function inTown(place: MapPlace) {
  return place.lat != null && place.lng != null && distanceMetres({ lat: place.lat, lng: place.lng }, { lat: CAMPUS_CENTRE[0], lng: CAMPUS_CENTRE[1] }) > 450;
}

/** The name shown beside a pin: town places drop "Lincoln (Central)" so neighbouring labels don't overlap. */
function pinLabel(place: MapPlace) {
  if (!inTown(place)) return place.name;
  const short = place.name.replace(/^Lincoln (Central )?/, "");
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

export function CampusMap({ places, sessions, dateLabel }: { places: MapPlace[]; sessions: MapSession[]; dateLabel: string }) {
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const children = useMemo(() => {
    const m = new Map<string, MapPlace[]>();
    for (const p of places) if (p.parentId) m.set(p.parentId, [...(m.get(p.parentId) ?? []), p]);
    return m;
  }, [places]);
  const sessionsFor = useCallback(
    (p: MapPlace) => {
      const ids = new Set([p.roomId, ...(children.get(p.id) ?? []).map((c) => c.roomId)].filter(Boolean));
      return sessions.filter((s) => s.roomId && ids.has(s.roomId)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    },
    [children, sessions],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("day");
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  // Phones: the panel is a sheet over the map that can be pulled up.
  const [sheet, setSheet] = useState<Sheet>("peek");
  const sheetRef = useRef<HTMLElement>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const pins = useRef<Map<string, Marker>>(new Map());
  const youLayer = useRef<LayerGroup | null>(null);
  const campusLayer = useRef<CampusLayer | null>(null);
  const buildingOf = useRef<Map<string, string>>(new Map());
  const [campusReady, setCampusReady] = useState(false);
  const watchId = useRef<number | null>(null);
  const homeView = useRef<((animate: boolean) => void) | null>(null);

  // Read ?place= on first load so links can open a place directly.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("place");
    const room = params.get("room");
    const p = slug ? places.find((x) => x.slug === slug) : room ? places.find((x) => x.roomId === room) : undefined;
    if (p) setSelected(p.id);
  }, [places]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let made: LeafletMap | null = null;
    import("leaflet").then((leaflet) => {
      if (cancelled || !mapEl.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(mapEl.current, { zoomSnap: 0.25, zoomControl: false, scrollWheelZoom: true, minZoom: 13, maxZoom: 20, tapTolerance: 20 });
      made = m;
      m.setView(CAMPUS_CENTRE, CAMPUS_ZOOM);
      if (!isPhone()) leaflet.control.zoom({ position: "bottomright" }).addTo(m);
      m.attributionControl.setPosition(isPhone() ? "topleft" : "bottomright");
      m.attributionControl.setPrefix(false);
      // Pins go on once the base is drawn, so the first view and any linked place settle only once.
      const finish = () => {
        for (const p of places) {
          if (p.lat == null || p.lng == null) continue;
          const label = (p.code ?? p.name.replace(/^The /, "").charAt(0)).slice(0, 4);
          const safe = (t: string) => t.replace(/[<>&"]/g, "");
          const icon = leaflet.divIcon({
            className: "",
            html: `<span class="map-marker"><span class="map-pin map-pin--${p.kind}" data-label="${safe(label)}"></span>${p.kind === "venue" || inTown(p) ? `<span class="map-label">${safe(pinLabel(p))}</span>` : ""}</span>`,
            iconSize: [28, 34],
            iconAnchor: [14, 32],
          });
          const marker = leaflet.marker([p.lat, p.lng], { icon, title: p.name, alt: p.name, keyboard: true, riseOnHover: true }).addTo(m);
          marker.on("click", () => {
            setSelected(p.id);
            setSheet((v) => (v === "peek" ? "half" : v));
          });
          marker.on("keypress", (e) => {
            const key = (e.originalEvent as KeyboardEvent).key;
            if (key === "Enter" || key === " ") setSelected(p.id);
          });
          pins.current.set(p.id, marker);
        }
        youLayer.current = leaflet.layerGroup().addTo(m);
        map.current = m;
        // Start on everything pinned on campus; the stations and cathedral are a pan or zoom away.
        // "Back to campus" returns to this same view.
        const pts = places.filter((p) => p.lat != null && p.lng != null && !inTown(p)).map((p) => [p.lat!, p.lng!] as [number, number]);
        homeView.current = (animate) => {
          if (pts.length > 1) {
            // On phones, leave room for the sheet so the campus sits in the visible part of the map.
            const sheetPx = isPhone() && sheetRef.current ? sheetRef.current.getBoundingClientRect().height : 0;
            m.flyToBounds(pts, { paddingTopLeft: [48, 96], paddingBottomRight: [48, 48 + sheetPx], maxZoom: 17, animate, duration: 0.8 });
          } else m.flyTo(CAMPUS_CENTRE, CAMPUS_ZOOM, { animate, duration: 0.8 });
        };
        if (pts.length > 1) m.fitBounds(pts, { padding: [48, 48], maxZoom: 17 });
        setReady(true);
      };
      // Our own drawing of the campus. If it can't load, fall back to a standard street map.
      drawCampus(leaflet, m).then((campus) => {
        if (cancelled) return;
        if (!campus) {
          let loaded = 0;
          let failed = 0;
          leaflet
            .tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 20, subdomains: "abcd" })
            .on("tileload", () => {
              loaded++;
              setTilesFailed(false);
            })
            .on("tileerror", () => {
              failed++;
              if (failed >= 6 && loaded === 0) setTilesFailed(true);
            })
            .addTo(m);
          finish();
          return;
        }
        m.attributionControl.addAttribution(OSM_ATTRIBUTION);
        // People can roam the whole drawn area (campus, the stations and up to the cathedral)
        // and zoom out until all of it is on screen, but not drift off into blank space.
        const area = leaflet.latLngBounds(campus.bounds);
        m.options.maxBoundsViscosity = 0.9;
        const fit = () => {
          // One zoom level further out than "the drawing fills the screen": far enough to see
          // the cathedral and the stations together with campus, without shrinking to a postage stamp.
          m.setMinZoom(Math.max(13, Math.min(16, Math.floor((m.getBoundsZoom(area, true) - 1) * 4) / 4)));
          if (m.getZoom() < m.getMinZoom()) m.setZoom(m.getMinZoom(), { animate: false });
        };
        m.setMaxBounds(area);
        fit();
        m.on("resize", fit);
        for (const p of places) {
          if (p.lat == null || p.lng == null) continue;
          const id = campus.claim({ lat: p.lat, lng: p.lng }, p.kind === "venue" ? "venue" : "place", () => {
            setSelected(p.id);
            setSheet((v) => (v === "peek" ? "half" : v));
          });
          if (id) buildingOf.current.set(p.id, id);
        }
        campusLayer.current = campus;
        finish();
        setCampusReady(true);
      });
    });
    const pinRefs = pins.current;
    const buildingRefs = buildingOf.current;
    return () => {
      cancelled = true;
      made?.remove();
      map.current = null;
      pinRefs.clear();
      buildingRefs.clear();
      campusLayer.current = null;
    };
  }, [places]);

  // Highlight and fly to the selected place, and keep the URL in sync.
  useEffect(() => {
    const p = selected ? byId.get(selected) : undefined;
    const target = p ? resolve(p, byId) : null;
    const pinOwner = p ? (p.lat != null ? p.id : p.parentId) : null;
    for (const [id, marker] of pins.current) {
      marker.getElement()?.querySelector(".map-pin")?.classList.toggle("is-active", id === pinOwner);
    }
    campusLayer.current?.setActive(pinOwner ? (buildingOf.current.get(pinOwner) ?? null) : null);
    if (target && map.current) {
      const m = map.current;
      const zoom = Math.max(m.getZoom(), 18);
      // Keep the pin above the sheet on phones.
      const cover = isPhone() && sheetRef.current ? sheetRef.current.getBoundingClientRect().height : 0;
      const pt = m.project([target.lat, target.lng], zoom).add([0, cover / 2]);
      m.flyTo(m.unproject(pt, zoom), zoom, { duration: 0.8 });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    if (p) url.searchParams.set("place", p.slug);
    else url.searchParams.delete("place");
    window.history.replaceState(null, "", url);
  }, [selected, byId, ready, campusReady]);

  // Draw "you are here".
  useEffect(() => {
    const leaflet = L.current;
    if (!leaflet || !youLayer.current) return;
    youLayer.current.clearLayers();
    if (!fix) return;
    leaflet.circle([fix.lat, fix.lng], { radius: fix.accuracy, color: "#2f7cf6", weight: 1, fillOpacity: 0.08 }).addTo(youLayer.current);
    leaflet
      .marker([fix.lat, fix.lng], { icon: leaflet.divIcon({ className: "", html: '<span class="map-you"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }), keyboard: false, title: "You are here" })
      .addTo(youLayer.current);
  }, [fix]);

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser does not share location. Use the list and the directions links instead.");
      return;
    }
    if (fix && map.current) {
      map.current.flyTo([fix.lat, fix.lng], 18);
      return;
    }
    setLocating(true);
    setGeoError(null);
    let first = true;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setFix(next);
        setLocating(false);
        if (first && map.current) {
          first = false;
          const far = distanceMetres(next, { lat: CAMPUS_CENTRE[0], lng: CAMPUS_CENTRE[1] }) > 3000;
          if (far) setGeoError("You seem to be away from campus, so the map stays on the University. Use the directions links to get here.");
          else map.current.flyTo([next.lat, next.lng], 18);
        }
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location access was turned off. You can still find every place in the list."
            : "We could not find your location just now. Try again outside or near a window.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
  };

  // List of places, filtered.
  const q = query.trim().toLowerCase();
  const matches = (p: MapPlace) =>
    !q ||
    [p.name, p.code ?? "", p.description, ...sessionsFor(p).map((s) => s.title)].some((t) => t.toLowerCase().includes(q));
  const top = places.filter((p) => !p.parentId);
  const onDay = top.filter((p) => p.kind === "venue");
  const around = top.filter((p) => p.kind !== "venue" && !inTown(p));
  const town = top.filter((p) => p.kind !== "venue" && inTown(p));
  const visibleDay = onDay.filter((p) => matches(p) || (children.get(p.id) ?? []).some(matches));
  const visibleAround = filter === "all" || q ? around.filter(matches) : [];
  // Always listed: on the day, the stations are where most people arrive.
  const visibleTown = town.filter(matches);

  const current = selected ? byId.get(selected) : undefined;
  const currentPos = current ? resolve(current, byId) : null;
  const fromYou = fix && currentPos ? distanceMetres(fix, currentPos) : null;

  // Places in the programme, in time order, for the "Where to be" strip.
  const placeForRoom = useMemo(() => {
    const m = new Map<string, MapPlace>();
    for (const p of places) if (p.roomId) m.set(p.roomId, p);
    return m;
  }, [places]);
  const itinerary = sessions
    .filter((s) => s.roomId && placeForRoom.has(s.roomId))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const pinnedCount = places.filter((p) => p.lat != null).length;
  const unpinnedVenues = places.filter((p) => p.kind === "venue" && p.lat == null && !p.parentId);

  const choose = (id: string | null) => {
    setSelected(id);
    if (id) setSheet((v) => (v === "peek" ? "half" : v));
  };

  // Drag the sheet's handle to resize it; a tap steps through the sizes.
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const onHandleDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dy = e.clientY - d.y;
    const i = SHEET_ORDER.indexOf(sheet);
    if (Math.abs(dy) < 8) setSheet(SHEET_ORDER[(i + 1) % SHEET_ORDER.length]);
    else if (dy < 0) setSheet(SHEET_ORDER[Math.min(i + (dy < -180 ? 2 : 1), 2)]);
    else setSheet(SHEET_ORDER[Math.max(i - (dy > 180 ? 2 : 1), 0)]);
  };

  const sheetHeight = { peek: "9.5rem", half: "55%", full: "calc(100% - 3.5rem)" }[sheet];

  const listPanel = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-white/10 px-4 pb-4 pt-1 lg:space-y-4 lg:p-5">
        <label className="relative block">
          <span className="sr-only">Search places and sessions</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-paper/60" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSheet("full")}
            placeholder="Search, e.g. INB, LMS005, keynote"
            className="min-h-12 w-full rounded-[3px] border border-white/20 bg-white/5 pl-10 pr-3 text-[1rem] text-paper placeholder:text-paper/50 focus:border-cyan"
          />
        </label>
        <div role="group" aria-label="Show" className="flex gap-2">
          {(
            [
              ["day", "On the day"],
              ["all", "All places"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
              className={cn(
                "min-h-10 rounded-[3px] px-4 text-sm font-semibold transition-colors",
                filter === v ? "bg-paper text-navy" : "border border-white/20 text-paper/80 hover:border-white/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!q && itinerary.length > 0 && (
          <section aria-labelledby="where-title" className="border-b border-white/10 p-4 lg:p-5">
            <h2 id="where-title" className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-paper/65">
              Where to be
            </h2>
            <ol className="mt-3 space-y-1">
              {itinerary.map((s) => {
                const p = placeForRoom.get(s.roomId!)!;
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => choose(p.id)} className="group grid min-h-12 w-full grid-cols-[3.5rem_1fr] gap-3 rounded-[3px] px-2 py-2 text-left hover:bg-white/5">
                      <span className="font-display text-lg tabular-nums text-cyan">{s.starts}</span>
                      <span>
                        <span className="block text-sm font-medium text-paper">{s.title}</span>
                        <span className="block text-xs text-paper/65">
                          {p.code ?? p.name}
                          {!p.locationConfirmed && " · room to be confirmed"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <PlaceGroup title="Conference venues" places={visibleDay} childrenOf={children} matches={matches} q={q} fix={fix} byId={byId} onSelect={choose} />
        {visibleAround.length > 0 && (
          <PlaceGroup title="Around campus" places={visibleAround} childrenOf={children} matches={matches} q={q} fix={fix} byId={byId} onSelect={choose} />
        )}
        {visibleTown.length > 0 && (
          <PlaceGroup title="Around Lincoln" places={visibleTown} childrenOf={children} matches={matches} q={q} fix={fix} byId={byId} onSelect={choose} />
        )}
        {visibleDay.length === 0 && visibleAround.length === 0 && visibleTown.length === 0 && (
          <p className="p-5 text-sm text-paper/75">Nothing matches &ldquo;{query}&rdquo;. Try a building code such as INB.</p>
        )}
        {filter === "day" && !q && (
          <p className="p-5 pt-0 text-sm text-paper/65">
            Choose <strong className="font-semibold text-paper">All places</strong> to see other campus buildings and landmarks.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div data-fullscreen-map className="surface-midnight pt-[var(--header-h)] lg:pt-28">
      <header className="container-page hidden flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-white/15 pb-6 pt-12 lg:flex">
        <div>
          <p className="eyebrow text-cyan">Brayford Pool campus · {dateLabel}</p>
          <h1 className="mt-4 text-display-md font-normal">
            Find your way <span className="font-light italic text-gold-300">around campus</span>
          </h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-paper/75">
          Search for a building or session, tap a pin for details, and open walking directions in your own maps app. Rooms still to be confirmed are
          marked.
        </p>
      </header>
      <h1 className="sr-only lg:hidden">Campus map</h1>

      {/*
        "isolate" keeps Leaflet's own layers (z-index 400 to 1000) inside this box, so the map can
        never paint over the site header, the phone menu or the footer. The fixed single grid row
        keeps the sidebar scrolling on its own, so the map stays exactly one screen tall.
      */}
      <div className="relative isolate h-[calc(100svh-var(--header-h)-4rem-env(safe-area-inset-bottom))] min-h-[480px] overflow-hidden lg:grid lg:h-[calc(100svh-var(--header-h))] lg:min-h-[640px] lg:grid-cols-[400px_1fr] lg:grid-rows-[minmax(0,1fr)]">
        {/* Map */}
        <div className="absolute inset-0 bg-paper-200 lg:relative lg:order-2 lg:h-full">
          <div ref={mapEl} className="absolute inset-0" role="region" aria-label="Interactive campus map. The list of places contains the same information." />
          <div className="pointer-events-none absolute inset-x-3 top-10 z-[500] flex justify-end gap-2 lg:top-3">
            <button
              type="button"
              onClick={locate}
              className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-[3px] bg-navy px-4 font-ui text-sm font-semibold text-paper shadow-lg hover:bg-navy-700"
            >
              {fix ? <LocateFixed aria-hidden className="size-4" /> : <Crosshair aria-hidden className={cn("size-4", locating && "animate-spin")} />}
              {fix ? "Show me" : locating ? "Finding you" : "Where am I?"}
            </button>
            <button
              type="button"
              onClick={() => homeView.current?.(true)}
              className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-[3px] bg-white px-4 font-ui text-sm font-semibold text-navy shadow-lg hover:bg-paper"
            >
              <School aria-hidden className="size-4" />
              Back to campus
            </button>
          </div>
          {(geoError || tilesFailed || pinnedCount === 0) && (
            <div className="absolute inset-x-3 top-24 z-[500] space-y-2 lg:bottom-3 lg:top-auto lg:max-w-md">
              {geoError && <p role="status" className="rounded-[3px] bg-white px-4 py-3 text-sm text-ink shadow-lg">{geoError}</p>}
              {tilesFailed && (
                <p role="status" className="rounded-[3px] bg-white px-4 py-3 text-sm text-ink shadow-lg">
                  The map images couldn&apos;t load on this connection. Every place and its walking directions are still in the list.
                </p>
              )}
              {pinnedCount === 0 && <p className="rounded-[3px] bg-white px-4 py-3 text-sm text-ink shadow-lg">Pins will appear once locations are confirmed. Use the list for directions.</p>}
            </div>
          )}
        </div>

        {/* Panel: a pull-up sheet on phones, a sidebar on larger screens */}
        <aside
          ref={sheetRef}
          aria-label="Places"
          style={{ ["--sheet-h" as string]: sheetHeight }}
          className="absolute inset-x-0 bottom-0 z-[600] flex h-[var(--sheet-h)] flex-col rounded-t-xl border-t border-white/15 bg-midnight shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.6)] transition-[height] duration-300 ease-[var(--ease-out-expo)] lg:relative lg:z-auto lg:order-1 lg:h-full lg:min-h-0 lg:rounded-none lg:border-r lg:border-t-0 lg:shadow-none lg:transition-none"
        >
          <button
            type="button"
            onPointerDown={onHandleDown}
            onPointerUp={onHandleUp}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") setSheet(SHEET_ORDER[Math.min(SHEET_ORDER.indexOf(sheet) + 1, 2)]);
              if (e.key === "ArrowDown") setSheet(SHEET_ORDER[Math.max(SHEET_ORDER.indexOf(sheet) - 1, 0)]);
            }}
            aria-label={sheet === "full" ? "Shrink the list" : "Expand the list"}
            aria-expanded={sheet !== "peek"}
            className="flex h-8 w-full shrink-0 touch-none items-center justify-center lg:hidden"
          >
            <span aria-hidden className="h-1.5 w-12 rounded-full bg-white/30" />
          </button>
          {current ? (
            <PlaceDetail
              place={current}
              parent={current.parentId ? byId.get(current.parentId) : undefined}
              rooms={children.get(current.id) ?? []}
              sessions={sessionsFor(current)}
              pinned={Boolean(currentPos)}
              fromYou={fromYou}
              onClose={() => setSelected(null)}
              onSelect={choose}
              onCopy={copy}
              copied={copied}
              unpinnedVenue={unpinnedVenues.some((v) => v.id === current.id || v.id === current.parentId)}
            />
          ) : (
            listPanel
          )}
        </aside>
      </div>
    </div>
  );
}

function PlaceGroup({
  title,
  places,
  childrenOf,
  matches,
  q,
  fix,
  byId,
  onSelect,
}: {
  title: string;
  places: MapPlace[];
  childrenOf: Map<string, MapPlace[]>;
  matches: (p: MapPlace) => boolean;
  q: string;
  fix: Fix | null;
  byId: Map<string, MapPlace>;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="p-5">
      <h2 className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-paper/65">{title}</h2>
      <ul className="mt-3 divide-y divide-white/10 border-y border-white/10">
        {places.map((p) => {
          const pos = resolve(p, byId);
          const d = fix && pos ? distanceMetres(fix, pos) : null;
          const rooms = (childrenOf.get(p.id) ?? []).filter((c) => !q || matches(c) || matches(p));
          return (
            <li key={p.id}>
              <button type="button" onClick={() => onSelect(p.id)} className="flex w-full items-start gap-4 py-4 text-left hover:bg-white/[0.03]">
                <span className={cn("mt-0.5 grid h-9 min-w-9 place-items-center rounded-[3px] px-1.5 font-ui text-[0.7rem] font-bold", p.kind === "venue" ? "bg-paper text-navy" : "border border-white/30 text-paper")}>
                  {(p.code ?? p.name.replace(/^The /, "").charAt(0)).slice(0, 4)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg leading-snug text-paper">{p.name}</span>
                  <span className="mt-0.5 block text-xs text-paper/65">
                    {KIND_LABEL[p.kind]}
                    {!pos && " · not pinned on the map yet"}
                    {d != null && ` · ${formatDistance(d)}, about ${walkingMinutes(d)} min walk`}
                  </span>
                </span>
              </button>
              {rooms.length > 0 && (
                <ul className="mb-4 ml-[3.25rem] space-y-1">
                  {rooms.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => onSelect(r.id)} className="flex w-full items-center justify-between gap-3 rounded-[3px] px-3 py-2 text-left text-sm text-paper/85 hover:bg-white/5">
                        <span>{r.name}</span>
                        {!r.locationConfirmed && <span className="shrink-0 text-xs text-cyan">To be confirmed</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PlaceDetail({
  place,
  parent,
  rooms,
  sessions,
  pinned,
  fromYou,
  onClose,
  onSelect,
  onCopy,
  copied,
  unpinnedVenue = false,
}: {
  unpinnedVenue?: boolean;
  place: MapPlace;
  parent?: MapPlace;
  rooms: MapPlace[];
  sessions: MapSession[];
  pinned: boolean;
  fromYou: number | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  // preventScroll: moving focus must not jump the page or the sheet under your finger.
  useEffect(() => ref.current?.focus({ preventScroll: true }), [place.id]);
  // Directions go to the building for rooms.
  const target = place.lat == null && parent ? parent : place;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-1 sm:px-6 lg:pt-6">
      <div className="flex items-start justify-between gap-4">
        <p className="eyebrow text-cyan">{KIND_LABEL[place.kind]}{place.code ? ` · ${place.code}` : ""}</p>
        <button type="button" onClick={onClose} className="-mr-2 -mt-2 grid size-11 place-items-center rounded-[3px] text-paper/80 hover:bg-white/10" aria-label="Back to all places">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <h2 ref={ref} tabIndex={-1} className="mt-3 text-display-sm font-normal outline-none">
        {place.name}
      </h2>
      {parent && (
        <p className="mt-2 text-sm text-paper/75">
          Inside{" "}
          <button type="button" onClick={() => onSelect(parent.id)} className="font-semibold text-paper underline decoration-white/30 underline-offset-4 hover:decoration-white">
            {parent.name}
          </button>
        </p>
      )}
      {place.description && <p className="mt-4 leading-relaxed text-paper/80">{place.description}</p>}

      <ul className="mt-5 space-y-2 text-sm">
        {!place.locationConfirmed && (
          <li className="flex gap-2 text-cyan">
            <Clock aria-hidden className="mt-0.5 size-4 shrink-0" /> The exact room or spot is still to be confirmed.
          </li>
        )}
        {!pinned && (
          <li className="flex gap-2 text-paper/75">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            {unpinnedVenue
              ? "Not pinned on this map yet. The walking directions below find the building by name."
              : "Not pinned on this map yet. The directions link searches for it by name."}
          </li>
        )}
        {fromYou != null && (
          <li className="flex gap-2 text-paper/85">
            <Footprints aria-hidden className="mt-0.5 size-4 shrink-0" /> {formatDistance(fromYou)} from you, roughly {walkingMinutes(fromYou)} min on foot (straight-line estimate).
          </li>
        )}
      </ul>

      {place.directions && (
        <div className="mt-5 border-l-2 border-cyan/60 pl-4 text-sm leading-relaxed text-paper/85">
          <p className="font-semibold text-paper">On the day</p>
          <p className="mt-1">{place.directions}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href={directionsUrl(target)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-paper px-5 font-ui text-sm font-semibold text-navy hover:bg-white"
        >
          Walking directions <ArrowUpRight aria-hidden className="size-4" />
          <span className="sr-only">(opens Google Maps)</span>
        </a>
        <a
          href={directionsUrl(target, "apple")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center gap-2 rounded-[3px] border border-white/30 px-4 font-ui text-sm font-medium text-paper hover:border-white/70"
        >
          <Navigation aria-hidden className="size-4" /> Apple Maps <span className="sr-only">(opens in a new tab)</span>
        </a>
        <button type="button" onClick={onCopy} className="inline-flex min-h-12 items-center gap-2 rounded-[3px] border border-white/30 px-4 font-ui text-sm font-medium text-paper hover:border-white/70">
          <Link2 aria-hidden className="size-4" /> {copied ? "Link copied" : "Copy link"}
        </button>
      </div>

      {sessions.length > 0 && (
        <section className="mt-8">
          <h3 className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-paper/65">Sessions here</h3>
          <ol className="mt-3 divide-y divide-white/10 border-y border-white/10">
            {sessions.map((s) => (
              <li key={s.id} className="grid grid-cols-[5.5rem_1fr] gap-3 py-3">
                <span className="font-display tabular-nums text-cyan">
                  {s.starts}
                  {s.ends && <span className="text-paper/60"> to {s.ends}</span>}
                </span>
                <span className="text-sm text-paper">{s.title}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {rooms.length > 0 && (
        <section className="mt-8">
          <h3 className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-paper/65">Rooms in this building</h3>
          <ul className="mt-3 space-y-1">
            {rooms.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onSelect(r.id)} className="flex w-full items-center justify-between gap-3 rounded-[3px] border border-white/10 px-4 py-3 text-left text-sm text-paper hover:border-white/30">
                  <span>{r.name}</span>
                  {!r.locationConfirmed && <span className="shrink-0 text-xs text-cyan">To be confirmed</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
