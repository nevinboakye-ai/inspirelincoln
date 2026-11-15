import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DM_MESSAGE_COLUMNS } from "@/lib/messages";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

/**
 * New messages in one conversation since `after`, and when the other person
 * last read it, for the chat to poll. Row level security decides who can
 * see it. `seen=1` (sent only while the page is in front of them) marks it read.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "signed_out" }, { status: 401, headers });
  const { db, user } = current;
  const after = req.nextUrl.searchParams.get("after");
  const afterOk = after && !Number.isNaN(Date.parse(after));

  if (req.nextUrl.searchParams.get("seen") === "1") await db.rpc("dm_seen", { p_conversation: id });

  let q = db.from("dm_messages").select(DM_MESSAGE_COLUMNS).eq("conversation_id", id).order("created_at").limit(200);
  if (afterOk) q = q.gt("created_at", after);
  const [members, messages] = await Promise.all([db.from("dm_members").select("user_id, last_read_at").eq("conversation_id", id), q]);
  const mine = (members.data ?? []).find((m) => m.user_id === user.id);
  if (!mine) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  const other = (members.data ?? []).find((m) => m.user_id !== user.id);
  return NextResponse.json({ messages: messages.data ?? [], otherReadAt: other?.last_read_at ?? null, otherGone: !other }, { headers });
}
