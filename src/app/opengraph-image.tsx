import { ImageResponse } from "next/og";
import { getEdition } from "@/lib/data/content";

export const alt = "INSPIRE National Medical Research Conference";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function OgImage() {
  const e = await getEdition();
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(`${e.date}T12:00:00Z`));
  const dots = Array.from({ length: 40 }, (_, i) => ({ x: (i * 197) % 1200, y: (i * 131) % 630, r: 2 + (i % 3) }));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#040B16 0%,#071426 55%,#0b1d35 100%)", color: "#F7F9FC", position: "relative", fontFamily: "sans-serif" }}>
        {dots.map((d, i) => (
          <div key={i} style={{ position: "absolute", left: d.x, top: d.y, width: d.r * 2, height: d.r * 2, borderRadius: 99, background: i % 3 === 0 ? "#8578F9" : "#39D5F2", opacity: 0.5 }} />
        ))}
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 8, color: "#39D5F2" }}>{`INSPIRE ${e.year}`}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1, letterSpacing: -2 }}>{e.theme}</div>
          <div style={{ display: "flex", fontSize: 30, marginTop: 28, color: "rgba(247,249,252,0.75)" }}>{`${date} · ${e.venueName}`}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "rgba(247,249,252,0.6)" }}>National Medical Research Conference</div>
      </div>
    ),
    size,
  );
}
