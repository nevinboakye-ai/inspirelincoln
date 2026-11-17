import type { Metadata } from "next";
import { MessagesShell } from "@/components/messages/inbox";
import { requireUser } from "@/lib/auth";
import { isJudgeOnly } from "@/lib/accounts";
import { loadInbox } from "@/lib/messages-server";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

/**
 * The inbox stays on screen (on laptops) while you move between
 * conversations, so switching is instant: only the conversation reloads.
 */
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const { db, profile } = await requireUser("/portal/messages");
  const a = profile.access;
  // Committee members can turn their read receipts off.
  const canHideReceipts = a.owner || a.can.message_people || a.can.answer_enquiries || a.can.review_submissions;
  const [inbox, { data: prefs }, { data: sw }, receipts] = await Promise.all([
    loadInbox(db),
    db.from("profiles").select("dm_open, dm_email").eq("id", profile.id).maybeSingle(),
    db.from("site_switches").select("enabled").eq("key", "delegate_messages").maybeSingle(),
    // Asked separately so the other settings still load before the database update that adds it.
    canHideReceipts ? db.from("profiles").select("read_receipts").eq("id", profile.id).maybeSingle() : Promise.resolve(null),
  ]);
  return (
    <MessagesShell
      initialRows={inbox.rows}
      ready={inbox.ready}
      prefs={{
        open: prefs?.dm_open ?? true,
        email: prefs?.dm_email ?? true,
        // null hides the setting: not committee, or the database isn't updated yet.
        receipts: receipts && !receipts.error && receipts.data ? receipts.data.read_receipts !== false : null,
      }}
      owner={profile.access.owner}
      delegateMessages={sw?.enabled ?? true}
      committee={profile.access.owner || profile.access.can.message_people}
      judge={isJudgeOnly(profile.accountType, profile.extraTypes)}
    >
      {children}
    </MessagesShell>
  );
}
