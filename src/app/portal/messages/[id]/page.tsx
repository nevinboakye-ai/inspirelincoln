import { notFound } from "next/navigation";
import { DmChat } from "@/components/messages/dm-chat";
import { requireUser } from "@/lib/auth";
import { DM_MESSAGE_COLUMNS, type DmMessage } from "@/lib/messages";
import { loadPeer } from "@/lib/messages-server";
import { DM_REACTION_COLUMNS, type Reaction } from "@/lib/reactions";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, user, profile } = await requireUser(`/portal/messages/${id}`);
  const peer = await loadPeer(db, id);
  if (!peer) notFound();
  // The newest 300 messages, oldest first, after anything they deleted for themselves.
  let q = db.from("dm_messages").select(DM_MESSAGE_COLUMNS).eq("conversation_id", id).order("created_at", { ascending: false }).limit(300);
  if (peer.my_cleared_at) q = q.gt("created_at", peer.my_cleared_at);
  const [{ data }, reactions] = await Promise.all([q, db.from("dm_reactions").select(DM_REACTION_COLUMNS).eq("conversation_id", id).limit(3000)]);
  const messages = ((data ?? []) as DmMessage[]).reverse();
  return <DmChat key={id} conversationId={id} messages={messages} peer={peer} reactions={reactions.error ? null : ((reactions.data ?? []) as Reaction[])} me={user.id} committee={profile.access.owner || profile.access.can.message_people} />;
}
