import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** What the signed-in person can edit, so public pages can show an edit shortcut. */
export async function GET() {
  const current = await getCurrentUser();
  const body = current ? { edit: current.profile.access.can.edit_website, owner: current.profile.access.owner } : { edit: false, owner: false };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
