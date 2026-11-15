import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dayContext, loadMyDay } from "@/lib/day/server";
import { buildDay } from "@/lib/day/plan";

export const dynamic = "force-dynamic";

/**
 * The day the live alerts follow: the signed-in person's own (with their
 * workshop rooms), or the general programme for everyone else. Fetched when
 * a page first opens and every few minutes after, not on every poll.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const db = await createClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (db && user) {
    const { items, edition } = await loadMyDay(db, user.id);
    return NextResponse.json({ personal: true, eventDate: edition.date, items }, { headers });
  }
  const ctx = await dayContext();
  const items = buildDay({ ...ctx, places: [], placesPublished: false, assignments: [] });
  return NextResponse.json({ personal: false, eventDate: ctx.edition.date, items }, { headers });
}
