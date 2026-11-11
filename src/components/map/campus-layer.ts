/**
 * INSPIRE's own drawing of the Brayford Pool campus: buildings, paths, roads,
 * water and green space from OpenStreetMap, drawn in the site's colours on a
 * canvas. Nothing is fetched from a map provider; the data is a static file
 * on our own site (public/map/campus.json, made by scripts/build-campus-map.mjs).
 */
import type { LatLngExpression, Map as LeafletMap, Path } from "leaflet";
import { directionsUrl } from "./map-config";

type Ring = [number, number][];
type CampusData = {
  bounds: [[number, number], [number, number]];
  water: Ring[][];
  green: Ring[][];
  plazas: Ring[][];
  buildings: { r: Ring[]; n?: string; u?: 1 }[];
  roads: { major: Ring[]; minor: Ring[]; path: Ring[]; steps: Ring[] };
  rail: Ring[];
  waterways: Ring[];
  labels: { n: string; at: [number, number]; w?: 1 }[];
};

/** The version of public/map/campus.json. 2: widened to the stations and the cathedral. */
const DATA_VERSION = 2;

export const OSM_ATTRIBUTION = 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const C = {
  land: "#f3efe5",
  green: "#dfe7d0",
  plaza: "#ebe5d6",
  water: "#bed2e8",
  waterEdge: "#a3bddb",
  casing: "#d8cfbb",
  road: "#ffffff",
  path: "#d3c8b0",
  steps: "#b4a585",
  rail: "#99a1ab",
  building: "#e2dacb",
  buildingEdge: "#cdc3ad",
  uni: "#c9d8ec",
  uniEdge: "#345a8c",
  venue: "#e6c97f",
  venueEdge: "#a5802a",
  active: "#1a3154",
};

/** Line widths are set for zoom 17 and scaled with the zoom, so roads keep their real proportions. */
const scale = (z: number) => Math.min(1.7, Math.max(0.45, 2 ** (z - 17)));

export type BuildingKind = "venue" | "place";

export interface CampusLayer {
  bounds: [[number, number], [number, number]];
  /** Marks the building under a place's pin, so it is coloured and clickable. */
  claim(at: { lat: number; lng: number }, kind: BuildingKind, onClick: () => void): string | null;
  /** Outlines the building of the selected place. */
  setActive(id: string | null): void;
}

function contains(ring: Ring, lat: number, lng: number) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const escape = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Loads and draws the campus. Resolves to null if the drawing can't be loaded, so the caller can fall back. */
export async function drawCampus(L: typeof import("leaflet"), map: LeafletMap): Promise<CampusLayer | null> {
  let data: CampusData;
  try {
    // Bump DATA_VERSION whenever campus.json is rebuilt, or browsers keep the old drawing.
    const res = await fetch(`/map/campus.json?v=${DATA_VERSION}`, { cache: "force-cache" });
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null;
  }

  const renderer = L.canvas({ padding: 0.6, tolerance: 4 });
  const pane = (name: string, z: number) => {
    const p = map.createPane(name);
    p.style.zIndex = String(z);
    return name;
  };
  const basePane = pane("campus-base", 200);
  const buildPane = pane("campus-buildings", 210);
  const labelPane = pane("campus-labels", 420);
  map.getContainer().style.background = C.land;

  const fill = (rings: Ring[][], color: string, extra: object = {}) =>
    rings.forEach((r) => L.polygon(r as LatLngExpression[][], { renderer, pane: basePane, stroke: false, fillColor: color, fillOpacity: 1, interactive: false, ...extra }).addTo(map));

  fill(data.green, C.green);
  fill(data.plazas, C.plaza);
  fill(data.water, C.water, { stroke: true, color: C.waterEdge, weight: 1 });

  // Lines that thicken as you zoom in.
  const scaled: { path: Path; weight: number }[] = [];
  const line = (ls: Ring[], style: { color: string; weight: number; dashArray?: string; lineCap?: "round" | "butt" }) =>
    ls.forEach((l) => {
      const p = L.polyline(l as LatLngExpression[], { renderer, pane: basePane, interactive: false, lineCap: "round", lineJoin: "round", ...style }).addTo(map);
      scaled.push({ path: p, weight: style.weight });
    });

  line(data.waterways, { color: C.water, weight: 7 });
  line(data.rail, { color: C.rail, weight: 2.5, dashArray: "7 5", lineCap: "butt" });
  line(data.roads.minor, { color: C.casing, weight: 7 });
  line(data.roads.major, { color: C.casing, weight: 11 });
  line(data.roads.minor, { color: C.road, weight: 5 });
  line(data.roads.major, { color: C.road, weight: 8.5 });
  line(data.roads.path, { color: C.path, weight: 2 });
  line(data.roads.steps, { color: C.steps, weight: 3, dashArray: "1.5 2.5", lineCap: "butt" });

  // Buildings. University buildings are tinted; the conference venue is gold.
  const buildings = data.buildings.map((b, i) => {
    const uni = Boolean(b.u);
    const poly = L.polygon(b.r as LatLngExpression[][], {
      renderer,
      pane: buildPane,
      color: uni ? C.uniEdge : C.buildingEdge,
      weight: uni ? 1 : 0.7,
      fillColor: uni ? C.uni : C.building,
      fillOpacity: 1,
      interactive: uni && Boolean(b.n),
    }).addTo(map);
    if (uni && b.n) {
      const centre = poly.getBounds().getCenter();
      const url = directionsUrl({ name: b.n, lat: centre.lat, lng: centre.lng });
      poly.bindPopup(
        `<p class="map-popup-title">${escape(b.n)}</p><p class="map-popup-kind">University of Lincoln</p><a class="map-popup-link" href="${url}" target="_blank" rel="noopener noreferrer">Walking directions<span class="sr-only"> (opens your maps app)</span></a>`,
        { closeButton: true, autoPanPadding: [24, 24] },
      );
    }
    return { id: `b${i}`, data: b, poly, kind: null as BuildingKind | null, base: { color: uni ? C.uniEdge : C.buildingEdge, weight: uni ? 1 : 0.7, fillColor: uni ? C.uni : C.building } };
  });

  // Labels, shown from zoom 17 (set by the data-zoom attribute below).
  const labelled = new Map<string, ReturnType<typeof L.marker>>();
  for (const l of data.labels) {
    const m = L.marker(l.at, {
      pane: labelPane,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: "", html: `<span class="${l.w ? "map-water-label" : "map-bldg-label"}">${escape(l.n)}</span>`, iconSize: [0, 0] }),
    }).addTo(map);
    labelled.set(l.n, m);
  }

  const restyle = () => {
    const z = map.getZoom();
    map.getContainer().dataset.zoom = String(Math.round(z));
    // Building names only once you are close enough to read them.
    map.getContainer().dataset.labels = z >= 16.5 ? "on" : "off";
    const k = scale(z);
    for (const s of scaled) s.path.setStyle({ weight: s.weight * k });
  };
  map.on("zoomend", restyle);
  restyle();

  let active: string | null = null;
  const paint = (b: (typeof buildings)[number]) => {
    const isActive = b.id === active;
    const venue = b.kind === "venue";
    b.poly.setStyle({
      color: isActive ? C.active : venue ? C.venueEdge : b.base.color,
      weight: isActive ? 3 : venue ? 1.5 : b.base.weight,
      fillColor: venue ? C.venue : b.kind ? C.uni : b.base.fillColor,
    });
    if (isActive) b.poly.bringToFront();
  };

  return {
    bounds: data.bounds,
    claim(at, kind, onClick) {
      const b = buildings.find((x) => x.data.r[0] && contains(x.data.r[0], at.lat, at.lng));
      if (!b) return null;
      b.kind = b.kind === "venue" ? "venue" : kind;
      b.poly.unbindPopup();
      b.poly.options.interactive = true;
      b.poly.off("click").on("click", onClick);
      // The pin already names it, so drop the duplicate label.
      if (b.data.n) labelled.get(b.data.n)?.remove();
      paint(b);
      return b.id;
    },
    setActive(id) {
      const prev = active;
      active = id;
      for (const b of buildings) if (b.id === prev || b.id === id) paint(b);
    },
  };
}

