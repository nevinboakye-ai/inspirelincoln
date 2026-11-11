import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MESSAGE_COLUMNS, THREAD_COLUMNS } from "@/lib/enquiries";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

/**
 * New messages in one conversation since `after`, for the chat to poll.
 * Row level security decides who can see it. `seen=1` (sent only while
 * the page is in front of them) marks it read.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "signed_out" }, { status: 401, headers });
  const { db } = current;
  const after = req.nextUrl.searchParams.get("after");
  const afterOk = after && !Number.isNaN(Date.parse(after));

  if (req.nextUrl.searchParams.get("seen") === "1") await db.rpc("enquiry_seen", { p_thread: id });

  let q = db.from("enquiry_messages").select(MESSAGE_COLUMNS).eq("thread_id", id).order("created_at").limit(200);
  if (afterOk) q = q.gt("created_at", after);
  const [thread, messages] = await Promise.all([db.from("enquiry_threads").select(THREAD_COLUMNS).eq("id", id).maybeSingle(), q]);
  if (!thread.data) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  return NextResponse.json({ thread: thread.data, messages: messages.data ?? [] }, { headers });
}
