import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signAvatars } from "@/lib/avatar";
import type { Contact, InboxRow, Peer, UnreadSummary } from "@/lib/messages";

/** Your conversations with photos. Empty (not an error) if messages aren't set up yet. */
export async function loadInbox(db: SupabaseClient): Promise<{ rows: InboxRow[]; ready: boolean }> {
  const { data, error } = await db.rpc("dm_inbox");
  if (error) return { rows: [], ready: false };
  const rows = (data ?? []) as InboxRow[];
  const photos = await signAvatars(db, rows.map((r) => r.other_avatar_path));
  for (const r of rows) r.other_photo = r.other_avatar_path ? (photos.get(r.other_avatar_path) ?? null) : null;
  return { rows, ready: true };
}

/** The other person in a conversation, or null if it isn't yours. */
export async function loadPeer(db: SupabaseClient, conversation: string): Promise<Peer | null> {
  const { data } = await db.rpc("dm_peer", { p_conversation: conversation });
  const peer = ((data ?? []) as Peer[])[0] ?? null;
  if (peer?.other_avatar_path) peer.other_photo = (await signAvatars(db, [peer.other_avatar_path])).get(peer.other_avatar_path) ?? null;
  return peer;
}

/** Everyone you can start a conversation with, with photos. */
export async function loadContacts(db: SupabaseClient): Promise<Contact[]> {
  const { data } = await db.rpc("dm_contacts");
  const rows = (data ?? []) as Contact[];
  const photos = await signAvatars(db, rows.map((r) => r.avatar_path));
  for (const r of rows) r.photo = r.avatar_path ? (photos.get(r.avatar_path) ?? null) : null;
  return rows;
}

export async function loadUnread(db: SupabaseClient): Promise<UnreadSummary> {
  const { data } = await db.rpc("dm_unread_summary");
  const r = ((data ?? []) as { conversations: number; latest_id: string | null; latest_conversation: string | null; latest_name: string | null; latest_body: string | null; latest_at: string | null }[])[0];
  if (!r) return { conversations: 0, latest: null };
  return {
    conversations: r.conversations ?? 0,
    latest: r.latest_id ? { id: r.latest_id, conversation: r.latest_conversation!, name: r.latest_name ?? "Someone", body: r.latest_body ?? "", at: r.latest_at! } : null,
  };
}
