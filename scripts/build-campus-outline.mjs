/**
 * Draws the campus as a faint line drawing for the intro screen
 * (public/map/campus-outline.svg), from the map data made by
 * build-campus-map.mjs. Run: npm run campus-map (it runs both).
 */
import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync("public/map/campus.json", "utf8"));
const [[s, w], [n, e]] = data.bounds;
const k = Math.cos(((s + n) / 2) * (Math.PI / 180));
const W = 1600;
const scale = W / ((e - w) * k);
const H = Math.round((n - s) * scale);
const pt = ([lat, lng]) => `${((lng - w) * k * scale).toFixed(0)} ${((n - lat) * scale).toFixed(0)}`;
const ring = (r) => `M${r.map(pt).join("L")}Z`;
const line = (l) => `M${l.map(pt).join("L")}`;

const water = data.water.flatMap((p) => p.map(ring)).join("");
const buildings = data.buildings.flatMap((b) => b.r.map(ring)).join("");
const uni = data.buildings.filter((b) => b.u).flatMap((b) => b.r.map(ring)).join("");
const roads = [...data.roads.major, ...data.roads.minor].map(line).join("");
const paths = data.roads.path.map(line).join("");
const rail = data.rail.map(line).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke-linejoin="round" stroke-linecap="round">
<path d="${water}" fill="#c9d8ec" fill-opacity=".10" stroke="#c9d8ec" stroke-opacity=".35" stroke-width="1"/>
<path d="${roads}" stroke="#c9d8ec" stroke-opacity=".22" stroke-width="3"/>
<path d="${paths}" stroke="#c9d8ec" stroke-opacity=".14" stroke-width="1"/>
<path d="${rail}" stroke="#c9d8ec" stroke-opacity=".2" stroke-width="1.5" stroke-dasharray="6 5"/>
<path d="${buildings}" stroke="#c9d8ec" stroke-opacity=".3" stroke-width="1"/>
<path d="${uni}" fill="#e6c97f" fill-opacity=".07" stroke="#e6c97f" stroke-opacity=".45" stroke-width="1.2"/>
</svg>
`;
writeFileSync("public/map/campus-outline.svg", svg);
console.log(`campus-outline.svg: ${(svg.length / 1024).toFixed(0)} KB, ${W}x${H}`);
