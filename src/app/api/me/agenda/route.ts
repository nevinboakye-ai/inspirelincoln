import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The signed-in person's saved agenda. Used while viewing as someone, so it shows their agenda. */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ sessions: [], workshops: [] }, { status: 401 });
  const [{ data: a }, { data: w }] = await Promise.all([
    current.db.from("agenda_items").select("session_id").eq("user_id", current.user.id),
    current.db.from("saved_workshops").select("workshop_id").eq("user_id", current.user.id),
  ]);
  return NextResponse.json(
    { sessions: (a ?? []).map((r) => r.session_id), workshops: (w ?? []).map((r) => r.workshop_id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
