import "server-only";
import { unreadMessagesEmail, type UnreadConversation } from "@/lib/email/messages";
import { emailConfigured, sendBatch } from "@/lib/email/resend";
import { SITE_URL } from "@/lib/site";
import { serviceClient } from "@/lib/view-as";

type DueRow = { user_id: string; email: string; full_name: string | null; conversation_id: string; sender_name: string; unread: number };

/** Turns due rows (one per conversation) into one email per person. */
export function groupDueEmails(rows: DueRow[], siteUrl: string) {
  const people = new Map<string, { email: string; name: string | null; conversations: UnreadConversation[] }>();
  for (const r of rows) {
    const p = people.get(r.user_id) ?? { email: r.email, name: r.full_name, conversations: [] };
    p.conversations.push({ conversationId: r.conversation_id, sender: r.sender_name, unread: r.unread });
    people.set(r.user_id, p);
  }
  return [...people.values()].map((p) => ({ to: p.email, ...unreadMessagesEmail({ siteUrl, name: p.name, conversations: p.conversations }) }));
}

/**
 * Emails everyone who has had a message sitting unopened for 24 hours, once
 * per unread stretch, batching each person's conversations into one email.
 * With `gap`, it does nothing if another run happened within that time, so
 * busy page loads can call it freely.
 */
export async function sendDueMessageEmails(opts: { gap?: string } = {}): Promise<{ ok: boolean; people: number; sent: number; error?: string }> {
  const admin = serviceClient();
  if (!admin) return { ok: false, people: 0, sent: 0, error: "SUPABASE_SERVICE_ROLE_KEY is not set" };
  // Without email set up, don't mark anything as emailed.
  if (!emailConfigured()) return { ok: false, people: 0, sent: 0, error: "Resend is not set up" };
  const { data, error } = await admin.rpc("dm_due_emails", opts.gap ? { p_gap: opts.gap } : {});
  if (error) return { ok: false, people: 0, sent: 0, error: error.message };
  const mails = groupDueEmails((data ?? []) as DueRow[], SITE_URL);
  const sent = mails.length ? await sendBatch(mails) : 0;
  return { ok: true, people: mails.length, sent };
}

let lastNudge = 0;

/**
 * Runs the 24 hour check from ordinary page traffic, so emails still go out
 * if the scheduled job isn't set up. Each server checks at most every five
 * minutes, and the database lets only one run through every fifteen.
 */
export async function nudgeMessageEmails() {
  const now = Date.now();
  if (now - lastNudge < 5 * 60_000) return;
  lastNudge = now;
  try {
    const r = await sendDueMessageEmails({ gap: "15 minutes" });
    if (r.ok && r.people) console.info(`[messages] emailed ${r.sent} of ${r.people} people about unread messages`);
  } catch (e) {
    console.error("[messages] unread email check failed", e);
  }
}
