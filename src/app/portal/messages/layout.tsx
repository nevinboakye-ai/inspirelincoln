import type { Metadata } from "next";
import { MessagesShell } from "@/components/messages/inbox";
import { requireUser } from "@/lib/auth";
import { loadInbox } from "@/lib/messages-server";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

/**
 * The inbox stays on screen (on laptops) while you move between
 * conversations, so switching is instant: only the conversation reloads.
 */
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const { db, profile } = await requireUser("/portal/messages");
  const [inbox, { data: prefs }, { data: sw }] = await Promise.all([
    loadInbox(db),
    db.from("profiles").select("dm_open, dm_email").eq("id", profile.id).maybeSingle(),
    db.from("site_switches").select("enabled").eq("key", "delegate_messages").maybeSingle(),
  ]);
  return (
    <MessagesShell
      initialRows={inbox.rows}
      ready={inbox.ready}
      prefs={{ open: prefs?.dm_open ?? true, email: prefs?.dm_email ?? true }}
      owner={profile.access.owner}
      delegateMessages={sw?.enabled ?? true}
      committee={profile.access.owner || profile.access.can.message_people}
    >
      {children}
    </MessagesShell>
  );
}
