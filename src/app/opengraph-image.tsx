import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getEdition } from "@/lib/data/content";

export const alt = "INSPIRE National Medical Research Conference";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function OgImage() {
  const e = await getEdition();
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(`${e.date}T12:00:00Z`));
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), "public/brand/conference-logo-white.png"))).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#0C182C 0%,#1A3154 55%,#14284A 100%)", color: "#F8F6F0", position: "relative", fontFamily: "sans-serif" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not the browser */}
        <img src={logo} alt="" width={426} height={163} style={{ position: "absolute", right: 64, top: 64 }} />
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 8, color: "#C9D8EC", marginTop: 40 }}>{`INSPIRE ${e.year}`}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 720 }}>{e.theme}</div>
          <div style={{ display: "flex", fontSize: 30, marginTop: 28, color: "rgba(247,249,252,0.75)" }}>{`${date} · ${e.venueName}`}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "rgba(247,249,252,0.6)" }}>National Medical Research Conference</div>
      </div>
    ),
    size,
  );
}
