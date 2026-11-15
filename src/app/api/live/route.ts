import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type LiveAlert = {
  id: string;
  title: string;
  body: string | null;
  place: string | null;
  mapHref: string | null;
  startsAt: string;
  endsAt: string;
};
export type LiveState = { auto: boolean; leadMinutes: number; alerts: LiveAlert[]; serverNow: number };

/**
 * What every page's live alert needs, polled while a page is open: whether
 * the automatic "where to go next" alerts are on, how early they show, and
 * any alert the committee has sent that is live now. Small and quick: two
 * reads, under the visitor's own row level security.
 */
export async function GET() {
  const empty: LiveState = { auto: true, leadMinutes: 10, alerts: [], serverNow: Date.now() };
  const headers = { "Cache-Control": "private, no-store" };
  const db = await createClient();
  if (!db) return NextResponse.json(empty, { headers });
  const nowIso = new Date().toISOString();
  const [settings, alerts] = await Promise.all([
    db.from("live_alert_settings").select("auto_enabled, lead_minutes, editions!inner(is_current)").eq("editions.is_current", true).maybeSingle(),
    db.from("live_alerts").select("id, title, body, place, map_slug, starts_at, ends_at").lte("starts_at", nowIso).gt("ends_at", nowIso).order("starts_at", { ascending: false }).limit(3),
  ]);
  const body: LiveState = {
    auto: settings.data ? Boolean(settings.data.auto_enabled) : true,
    leadMinutes: Number(settings.data?.lead_minutes ?? 10),
    alerts: (alerts.data ?? []).map((a) => ({
      id: String(a.id),
      title: String(a.title),
      body: (a.body as string | null) ?? null,
      place: (a.place as string | null) ?? null,
      mapHref: a.map_slug ? `/map?place=${a.map_slug}` : null,
      startsAt: String(a.starts_at),
      endsAt: String(a.ends_at),
    })),
    serverNow: Date.now(),
  };
  return NextResponse.json(body, { headers });
}
