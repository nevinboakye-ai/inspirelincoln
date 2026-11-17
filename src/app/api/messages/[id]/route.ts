import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DM_MESSAGE_COLUMNS } from "@/lib/messages";
import { DM_REACTION_COLUMNS } from "@/lib/reactions";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

/**
 * New messages in one conversation since `after`, when the other person
 * last read it (left out if they've turned read receipts off), and every
 * reaction, for the chat to poll. Row level security decides who can see
 * it. `seen=1` (sent only while the page is in front of them) marks it read.
 * `reactions` is null until the database has reactions set up.
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
  const [state, messages, reactions] = await Promise.all([
    db.rpc("dm_read_state", { p_conversation: id }),
    q,
    db.from("dm_reactions").select(DM_REACTION_COLUMNS).eq("conversation_id", id).limit(3000),
  ]);

  let read: { member: boolean; other_gone: boolean; other_read_at: string | null } | null;
  if (state.error) {
    // The database hasn't been updated yet: read the members table as before.
    const { data } = await db.from("dm_members").select("user_id, last_read_at").eq("conversation_id", id);
    const mine = (data ?? []).find((m) => m.user_id === user.id);
    const other = (data ?? []).find((m) => m.user_id !== user.id);
    read = mine ? { member: true, other_gone: !other, other_read_at: other?.last_read_at ?? null } : null;
  } else {
    read = ((state.data ?? []) as { member: boolean; other_gone: boolean; other_read_at: string | null }[])[0] ?? null;
  }
  if (!read?.member) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  return NextResponse.json(
    { messages: messages.data ?? [], otherReadAt: read.other_read_at, otherGone: read.other_gone, reactions: reactions.error ? null : (reactions.data ?? []) },
    { headers },
  );
}
