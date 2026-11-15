import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadInbox } from "@/lib/messages-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Your conversations, for the inbox to keep itself up to date. */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "signed_out" }, { status: 401, headers });
  const { rows, ready } = await loadInbox(current.db);
  return NextResponse.json({ rows, ready }, { headers });
}
