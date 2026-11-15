"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { newMessageEmail } from "@/lib/email/messages";
import { sendBatch, sendEmail } from "@/lib/email/resend";
import { DM_BODY_MAX, DM_MESSAGE_COLUMNS, type DmMessage } from "@/lib/messages";
import { SITE_URL } from "@/lib/site";

type Fail = { ok: false; error: string };

const uuid = z.string().uuid();

/** Turns database errors into something a person can act on. */
function friendly(e: { code?: string; message?: string } | null, fallback: string) {
  if (!e) return fallback;
  if (e.code === "VIEW_AS" || e.message?.includes("VIEW_AS")) return "You're viewing as someone else, so messages are read only.";
  if (e.code === "P0001" && e.message) return e.message;
  if (e.code === "PGRST202" || e.code === "42883") return "Messages aren't switched on yet. The site owner needs to run the latest setup.";
  return fallback;
}

function cleanBody(body: unknown): string | Fail {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return { ok: false, error: "Write a message first." };
  if (text.length > DM_BODY_MAX) return { ok: false, error: `Keep your message to ${DM_BODY_MAX} characters.` };
  return text;
}

/** Opens (or creates) the conversation with someone. */
export async function startConversation(personId: string): Promise<Fail | { ok: true; id: string }> {
  if (!uuid.safeParse(personId).success) return { ok: false, error: "That person isn't available." };
  const { db } = await requireUser("/portal/messages");
  const { data, error } = await db.rpc("dm_start", { p_other: personId });
  if (error || !data) return { ok: false, error: friendly(error, "We couldn't open that conversation. Please try again.") };
  return { ok: true, id: data as string };
}

/** Sends a message, then (after replying) emails them if they haven't been around. */
export async function sendMessage(conversationId: string, body: string): Promise<Fail | { ok: true; message: DmMessage }> {
  if (!uuid.safeParse(conversationId).success) return { ok: false, error: "That conversation isn't available." };
  const text = cleanBody(body);
  if (typeof text !== "string") return text;
  const { db } = await requireUser("/portal/messages");
  const { data, error } = await db.rpc("dm_send", { p_conversation: conversationId, p_body: text }).select(DM_MESSAGE_COLUMNS).single();
  if (error || !data) return { ok: false, error: friendly(error, "That didn't send. Check your connection and try again.") };
  const message = data as DmMessage;
  after(async () => {
    try {
      const { data: t } = await db.rpc("dm_notify_target", { p_message: message.id });
      const target = ((t ?? []) as { email: string; full_name: string | null; sender_name: string }[])[0];
      if (!target?.email) return;
      const mail = newMessageEmail({ siteUrl: SITE_URL, name: target.full_name, sender: target.sender_name, conversationId });
      await sendEmail({ to: target.email, ...mail });
    } catch (e) {
      console.error("[messages] notify failed", e);
    }
  });
  return { ok: true, message };
}

const manySchema = z.object({ people: z.array(uuid).min(1, "Choose at least one person.").max(500, "Send to 500 people or fewer at a time.") });

/** The committee sends one message to several people, each in their own conversation. */
export async function sendToMany(people: string[], body: string): Promise<Fail | { ok: true; sent: number }> {
  const parsed = manySchema.safeParse({ people });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Choose who to send it to." };
  const text = cleanBody(body);
  if (typeof text !== "string") return text;
  const { db, profile } = await requireUser("/portal/messages");
  if (!profile.access.owner && !profile.access.can.message_people) return { ok: false, error: "You can't send group messages." };
  const { data, error } = await db.rpc("dm_send_many", { p_people: [...new Set(parsed.data.people)], p_body: text });
  if (error) return { ok: false, error: friendly(error, "That didn't send. Please try again.") };
  // Emails for anyone who hasn't been around: one per person, never more than one unread nudge.
  after(async () => {
    try {
      const { data: rows } = await db.from("dm_messages").select("id, conversation_id").eq("sender_id", profile.id).gte("created_at", new Date(Date.now() - 120_000).toISOString()).limit(500);
      const mails: { to: string; subject: string; html: string; text: string }[] = [];
      const list = rows ?? [];
      for (let i = 0; i < list.length; i += 20) {
        const found = await Promise.all(
          list.slice(i, i + 20).map(async (r) => {
            const { data: t } = await db.rpc("dm_notify_target", { p_message: r.id });
            const target = ((t ?? []) as { email: string; full_name: string | null; sender_name: string }[])[0];
            return target?.email ? { to: target.email, ...newMessageEmail({ siteUrl: SITE_URL, name: target.full_name, sender: target.sender_name, conversationId: r.conversation_id }) } : null;
          }),
        );
        for (const m of found) if (m) mails.push(m);
      }
      if (mails.length) await sendBatch(mails);
    } catch (e) {
      console.error("[messages] group notify failed", e);
    }
  });
  revalidatePath("/portal/messages");
  return { ok: true, sent: Number(data) || 0 };
}

/** Blocks or unblocks someone. They aren't told. */
export async function setBlocked(personId: string, blocked: boolean): Promise<Fail | { ok: true }> {
  if (!uuid.safeParse(personId).success) return { ok: false, error: "That person isn't available." };
  const { db } = await requireUser("/portal/messages");
  const { error } = await db.rpc("dm_block", { p_other: personId, p_on: Boolean(blocked) });
  if (error) return { ok: false, error: friendly(error, "That didn't save. Please try again.") };
  return { ok: true };
}

/** Hides a conversation from your own inbox. It comes back if they write again. */
export async function clearConversation(conversationId: string): Promise<Fail | { ok: true }> {
  if (!uuid.safeParse(conversationId).success) return { ok: false, error: "That conversation isn't available." };
  const { db } = await requireUser("/portal/messages");
  const { error } = await db.rpc("dm_clear", { p_conversation: conversationId });
  if (error) return { ok: false, error: friendly(error, "That didn't delete. Please try again.") };
  revalidatePath("/portal/messages");
  return { ok: true };
}

/**
 * Reports a conversation to the committee as a private enquiry, with the
 * latest messages quoted so they can see what happened.
 */
export async function reportConversation(conversationId: string, note: string): Promise<Fail | { ok: true }> {
  if (!uuid.safeParse(conversationId).success) return { ok: false, error: "That conversation isn't available." };
  const { db } = await requireUser("/portal/messages");
  const [{ data: peer }, { data: msgs }] = await Promise.all([
    db.rpc("dm_peer", { p_conversation: conversationId }),
    db.from("dm_messages").select("sender_name, body, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(15),
  ]);
  const other = ((peer ?? []) as { other_name: string }[])[0];
  if (!other) return { ok: false, error: "That conversation isn't available." };
  const quoted = (msgs ?? [])
    .reverse()
    .map((m) => `[${new Date(m.created_at).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}] ${m.sender_name}: ${m.body.replace(/\s+/g, " ").slice(0, 300)}`)
    .join("\n");
  const why = note.trim().slice(0, 800) || "No details given.";
  const body = `I'm reporting my direct messages with ${other.other_name}.\n\nWhat happened: ${why}\n\nLatest messages:\n${quoted}`.slice(0, 4000);
  const { error } = await db.rpc("enquiry_open", { p_topic: "other", p_subject: `Report: messages with ${other.other_name}`.slice(0, 120), p_body: body });
  if (error) return { ok: false, error: friendly(error, "We couldn't send your report. Please try again, or email the committee.") };
  revalidatePath("/portal", "layout");
  revalidatePath("/admin/enquiries");
  return { ok: true };
}

/** Someone's own message settings. */
export async function saveMessagePrefs(open: boolean, email: boolean): Promise<Fail | { ok: true }> {
  const { db } = await requireUser("/portal/messages");
  const { error } = await db.rpc("dm_set_prefs", { p_open: Boolean(open), p_email: Boolean(email) });
  if (error) return { ok: false, error: friendly(error, "That didn't save. Please try again.") };
  return { ok: true };
}

/** The site owner turns delegate-to-delegate messages on or off. */
export async function setDelegateMessages(on: boolean): Promise<Fail | { ok: true }> {
  const { db, user, profile } = await requireUser("/portal/messages");
  if (!profile.access.owner) return { ok: false, error: "Only the site owner can change this." };
  const { error } = await db.from("site_switches").upsert({ key: "delegate_messages", enabled: Boolean(on), updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: friendly(error, "That didn't save. Please try again.") };
  revalidatePath("/portal/messages");
  return { ok: true };
}
