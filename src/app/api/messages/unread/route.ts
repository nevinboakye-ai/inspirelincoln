import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { nudgeMessageEmails } from "@/lib/message-emails";
import { loadUnread } from "@/lib/messages-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** How many conversations have unread messages, and the newest one, for the menu badge and pop-up. */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "signed_out" }, { status: 401, headers });
  // Emails about messages left unopened for 24 hours piggyback on this poll.
  after(nudgeMessageEmails);
  return NextResponse.json(await loadUnread(current.db), { headers });
}
