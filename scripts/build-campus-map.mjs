#!/usr/bin/env node
/**
 * Builds the campus map's own drawing from an OpenStreetMap export.
 *
 *   node scripts/build-campus-map.mjs path/to/export.geojson
 *
 * Get the export from overpass-turbo.eu: paste the query below, Run, then
 * Export as GeoJSON.
 *
 *   [out:json][timeout:180];
 *   (
 *     nwr["building"](53.2190,-0.5670,53.2430,-0.5190);
 *     way["highway"](53.2190,-0.5670,53.2430,-0.5190);
 *     nwr["natural"="water"](53.2170,-0.5720,53.2450,-0.5150);
 *     way["waterway"](53.2170,-0.5720,53.2450,-0.5150);
 *     way["railway"](53.2190,-0.5670,53.2430,-0.5190);
 *     way["landuse"](53.2190,-0.5670,53.2430,-0.5190);
 *     way["leisure"](53.2190,-0.5670,53.2430,-0.5190);
 *     nwr["tourism"](53.2190,-0.5670,53.2430,-0.5190);
 *     nwr["historic"](53.2190,-0.5670,53.2430,-0.5190);
 *     nwr["amenity"="parking"](53.2190,-0.5670,53.2430,-0.5190);
 *     nwr["amenity"="university"](53.2190,-0.5670,53.2430,-0.5190);
 *   );
 *   out geom;
 *
 * The result is written to
 * public/map/campus.json: buildings, paths, roads, water and green space around
 * the Brayford Pool campus, clipped, simplified and grouped so the map can
 * draw it in INSPIRE's own style without any third-party map images.
 *
 * Map data © OpenStreetMap contributors, available under the Open Database
 * Licence (ODbL). The credit is shown on the map itself.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/build-campus-map.mjs export.geojson");
  process.exit(1);
}
const OUT = "public/map/campus.json";

/**
 * The area drawn: central Lincoln, from the West Common and Ellis Mill across to the
 * Arboretum, and from South Park up past the Castle, Cathedral and Newport Arch, so
 * delegates can explore the city's sights around their day on campus.
 */
const BOX = { s: 53.2195, w: -0.5665, n: 53.2425, e: -0.5195 };
/** Campus and the stations, drawn in full detail. Beyond it, small sheds go and outlines are simpler. */
const CORE = { s: 53.2232, w: -0.5625, n: 53.2318, e: -0.5380 };
/** About 0.4 m: small enough to keep corners crisp, large enough to drop survey noise. */
const TOLERANCE = 0.000004;
const ROUND = 1e6;
/** Outside the core: about 1.2 m simplification and 1 m rounding, which is invisible at street zooms. */
const TOLERANCE_OUTER = 0.000011;
const ROUND_OUTER = 1e5;
let tol = TOLERANCE;
let round = ROUND;
const inCore = ([x, y]) => x >= CORE.w && x <= CORE.e && y >= CORE.s && y <= CORE.n;
/** Picks the level of detail for one feature, from where its first point lies. */
function detailFor(geom) {
  let c = geom.coordinates;
  while (Array.isArray(c[0])) c = c[0];
  const core = inCore(c);
  tol = core ? TOLERANCE : TOLERANCE_OUTER;
  round = core ? ROUND : ROUND_OUTER;
  return core;
}

/** University of Lincoln buildings that OpenStreetMap doesn't tag as university-run. */
const UNIVERSITY_NAMES = new Set([
  "Isaac Newton Building",
  "Minerva Building",
  "Sarah Swift Building",
  "Joseph Banks Laboratories",
  "Bridge House",
  "Lincoln Medical School",
  "Alfred Tennyson Building",
  "David Chiddick Building",
  "Stephen Langton Building",
  "Think Tank",
  "One Campus Way",
  "Boole Technology Centre",
  "Great Central Warehouse Library",
  "Enterprise Building",
  "Lincoln Arts Centre",
  "Students' Union",
  "Janet Lane-Claypon Building",
  "Nicola de la Haye Building",
  "Peter de Wint Building",
  "University Health Centre",
  "University of Lincoln Sports Centre",
  "The Junxion",
  "Witham House",
]);

const GREEN = new Set(["park", "garden", "grass", "pitch", "meadow", "recreation_ground", "village_green", "playground", "common"]);
const MAJOR = new Set(["trunk", "primary", "secondary", "tertiary", "primary_link", "secondary_link", "tertiary_link"]);
const MINOR = new Set(["residential", "unclassified", "service", "living_street", "track"]);
const PATH = new Set(["footway", "pedestrian", "path", "cycleway", "bridleway"]);

const inside = ([x, y]) => x >= BOX.w && x <= BOX.e && y >= BOX.s && y <= BOX.n;

/** Sutherland–Hodgman: clip a ring to the box. */
function clipRing(ring) {
  const edges = [
    (p) => p[0] >= BOX.w, (p) => p[0] <= BOX.e, (p) => p[1] >= BOX.s, (p) => p[1] <= BOX.n,
  ];
  const cut = [
    (a, b) => [BOX.w, a[1] + ((b[1] - a[1]) * (BOX.w - a[0])) / (b[0] - a[0])],
    (a, b) => [BOX.e, a[1] + ((b[1] - a[1]) * (BOX.e - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (BOX.s - a[1])) / (b[1] - a[1]), BOX.s],
    (a, b) => [a[0] + ((b[0] - a[0]) * (BOX.n - a[1])) / (b[1] - a[1]), BOX.n],
  ];
  let out = ring.slice(0, -1);
  for (let i = 0; i < 4 && out.length; i++) {
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const a = input[(j + input.length - 1) % input.length];
      const b = input[j];
      const ai = edges[i](a), bi = edges[i](b);
      if (bi) {
        if (!ai) out.push(cut[i](a, b));
        out.push(b);
      } else if (ai) out.push(cut[i](a, b));
    }
  }
  return out.length >= 3 ? [...out, out[0]] : null;
}

/** Cohen–Sutherland on each segment, then join the pieces that stay inside. */
function clipLine(line) {
  const code = ([x, y]) => (x < BOX.w ? 1 : x > BOX.e ? 2 : 0) | (y < BOX.s ? 4 : y > BOX.n ? 8 : 0);
  const pieces = [];
  let cur = [];
  for (let i = 1; i < line.length; i++) {
    let a = line[i - 1], b = line[i];
    let ca = code(a), cb = code(b);
    let keep = false;
    for (;;) {
      if (!(ca | cb)) { keep = true; break; }
      if (ca & cb) break;
      const c = ca || cb;
      let x, y;
      if (c & 8) { x = a[0] + ((b[0] - a[0]) * (BOX.n - a[1])) / (b[1] - a[1]); y = BOX.n; }
      else if (c & 4) { x = a[0] + ((b[0] - a[0]) * (BOX.s - a[1])) / (b[1] - a[1]); y = BOX.s; }
      else if (c & 2) { y = a[1] + ((b[1] - a[1]) * (BOX.e - a[0])) / (b[0] - a[0]); x = BOX.e; }
      else { y = a[1] + ((b[1] - a[1]) * (BOX.w - a[0])) / (b[0] - a[0]); x = BOX.w; }
      if (c === ca) { a = [x, y]; ca = code(a); } else { b = [x, y]; cb = code(b); }
    }
    if (!keep) { if (cur.length > 1) pieces.push(cur); cur = []; continue; }
    const last = cur[cur.length - 1];
    if (!last || last[0] !== a[0] || last[1] !== a[1]) { if (cur.length > 1) pieces.push(cur); cur = [a]; }
    cur.push(b);
  }
  if (cur.length > 1) pieces.push(cur);
  return pieces;
}

/** Douglas–Peucker, in degrees, which is fine at this scale. */
function simplify(pts, closed) {
  if (pts.length <= (closed ? 4 : 2)) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [x1, y1] = pts[a], [x2, y2] = pts[b];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  const out = pts.filter((_, i) => keep[i]);
  return closed && out.length < 4 ? pts : out;
}

/** [lng, lat] in, rounded [lat, lng] out, ready for the map. */
const toLatLng = (pts) => pts.map(([x, y]) => [Math.round(y * round) / round, Math.round(x * round) / round]);

function polygons(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  const out = [];
  for (const rings of polys) {
    const clip = (r) => (r.every(inside) ? r : clipRing(r));
    const outer = clip(rings[0]);
    if (!outer) continue;
    const holes = rings.slice(1).map(clip).filter(Boolean);
    out.push([outer, ...holes].map((r) => toLatLng(simplify(r, true))));
  }
  return out;
}

function lines(geom) {
  const ls = geom.type === "LineString" ? [geom.coordinates] : geom.type === "MultiLineString" ? geom.coordinates : [];
  return ls.flatMap((l) => (l.every(inside) ? [l] : clipLine(l))).map((l) => toLatLng(simplify(l, false)));
}

function centroid(ring) {
  // Area-weighted centre of the outer ring ([lat, lng] points).
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [y0, x0] = ring[i], [y1, x1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f; x += (x0 + x1) * f; y += (y0 + y1) * f;
  }
  if (!a) return ring[0];
  return [Math.round((y / (3 * a)) * ROUND) / ROUND, Math.round((x / (3 * a)) * ROUND) / ROUND];
}

/** Rough area of a [lat, lng] ring in square metres, fine at this latitude. */
function sqMetres(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][1] * ring[i + 1][0] - ring[i + 1][1] * ring[i][0];
  return (Math.abs(a) / 2) * 111320 * 66900;
}

/** A representative [lat, lng] for any geometry (the middle of its first ring or line, or the point). */
function pointOf(g) {
  let c = g.coordinates;
  if (g.type === "Point") return [c[1], c[0]];
  while (Array.isArray(c[0][0])) c = c[0];
  const n = c.length;
  const [x, y] = c.reduce(([sx, sy], [px, py]) => [sx + px / n, sy + py / n], [0, 0]);
  return [Math.round(y * 1e6) / 1e6, Math.round(x * 1e6) / 1e6];
}

/** Named sights, written to a second file when one is given, to help choose the map's landmarks. */
const named = [];
/** The University's campus outline, used to tell campus car parks from the city's. */
const campus = [];
/** Car parks, sorted out once the campus outline is known. */
const parking = [];
const raw = JSON.parse(readFileSync(input, "utf8"));
const out = { bounds: [[BOX.s, BOX.w], [BOX.n, BOX.e]], water: [], green: [], plazas: [], parking: [], buildings: [], roads: { major: [], minor: [], path: [], steps: [] }, rail: [], waterways: [], labels: [] };

for (const f of raw.features ?? []) {
  const t = f.properties ?? {};
  const g = f.geometry;
  if (!g) continue;
  if (t.name && (t.tourism || t.historic || t.leisure === "park" || t.building === "cathedral" || t.amenity === "marketplace")) named.push({ name: t.name, tags: Object.fromEntries(Object.entries(t).filter(([k]) => /^(tourism|historic|leisure|building|amenity|website|wikipedia)$/.test(k))), at: pointOf(g) });
  const core = detailFor(g);
  if (t.amenity === "university" && /Lincoln/i.test(t.name ?? "") && (g.type === "Polygon" || g.type === "MultiPolygon")) campus.push(...polygons(g).map((r) => r[0]));
  // Surface and multi-storey car parks (a multi-storey is also drawn as a building).
  if (t.amenity === "parking" && t.parking !== "underground" && (g.type === "Polygon" || g.type === "MultiPolygon")) {
    for (const rings of polygons(g)) parking.push({ rings, t });
  }
  if (t.amenity === "parking" || t.amenity === "university") continue;
  if (t.building && t.building !== "no") {
    for (const rings of polygons(g)) {
      // Outside the core, drop sheds and garages under about 25 m².
      if (!core && !t.name && sqMetres(rings[0]) < 25) continue;
      const uni = t.building === "university" || /University of Lincoln/i.test(t.operator ?? "") || UNIVERSITY_NAMES.has(t.name);
      const b = { r: rings };
      if (t.name) b.n = t.name;
      if (uni) b.u = 1;
      out.buildings.push(b);
    }
  } else if (t.natural === "water" || t.waterway === "riverbank") {
    out.water.push(...polygons(g));
    if (t.name === "Brayford Pool") for (const rings of polygons(g)) out.labels.push({ n: t.name, at: centroid(rings[0]), w: 1 });
  } else if (t.waterway && ["river", "canal"].includes(t.waterway)) {
    out.waterways.push(...lines(g));
  } else if (GREEN.has(t.leisure) || GREEN.has(t.landuse)) {
    out.green.push(...polygons(g));
  } else if (t.highway) {
    if (g.type === "Polygon" || g.type === "MultiPolygon") {
      if (t.highway === "pedestrian" || t.highway === "footway" || t.area === "yes") out.plazas.push(...polygons(g));
    } else if (MAJOR.has(t.highway)) out.roads.major.push(...lines(g));
    else if (MINOR.has(t.highway)) out.roads.minor.push(...lines(g));
    else if (PATH.has(t.highway)) out.roads.path.push(...lines(g));
    else if (t.highway === "steps") out.roads.steps.push(...lines(g));
  } else if (t.railway === "rail") {
    out.rail.push(...lines(g));
  }
}

// Car parks: campus ones (inside the University's outline, or run by it) are flagged so the map can highlight them.
const insideRing = (ring, [y, x]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
for (const { rings, t } of parking) {
  const at = centroid(rings[0]);
  const p = { r: rings, at };
  if (t.name) p.n = t.name;
  if (campus.some((c) => insideRing(c, at)) || /University of Lincoln/i.test(t.operator ?? "")) p.u = 1;
  if (t.access && t.access !== "yes") p.a = t.access;
  out.parking.push(p);
  named.push({ name: t.name ?? "(car park)", tags: { amenity: "parking", ...Object.fromEntries(Object.entries(t).filter(([k]) => /^(access|fee|operator|parking|capacity|name)$/.test(k))) }, at, campus: p.u === 1 });
}
console.log(`Campus outline: ${campus.length} ring(s). Car parks: ${out.parking.length} (${out.parking.filter((p) => p.u).length} on campus).`);

// One label per building: buildings in several parts are labelled on their largest part.
const area = (ring) => Math.abs(ring.reduce((n, [y0, x0], i) => { const [y1, x1] = ring[(i + 1) % ring.length]; return n + x0 * y1 - x1 * y0; }, 0));
const best = new Map();
for (const b of out.buildings) if (b.u && b.n) {
  const a = area(b.r[0]);
  if (!best.has(b.n) || best.get(b.n).a < a) best.set(b.n, { a, at: centroid(b.r[0]) });
}
out.labels = [...out.labels.filter((l) => l.w), ...[...best].map(([n, { at }]) => ({ n, at }))];

// University buildings last, so they draw on top of their neighbours.
out.buildings.sort((a, b) => (a.u ?? 0) - (b.u ?? 0));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(named, null, 1));
const size = Buffer.byteLength(JSON.stringify(out));
console.log(
  `Wrote ${OUT}: ${out.buildings.length} buildings (${out.buildings.filter((b) => b.u).length} university), ${out.water.length} water, ${out.green.length} green, ` +
    `${Object.values(out.roads).reduce((n, r) => n + r.length, 0)} roads and paths, ${out.rail.length} rail, ${out.labels.length} labels, ${(size / 1024).toFixed(0)} KB`,
);
// Last rebuilt for INSPIRE 2026: central Lincoln, with car parks.
