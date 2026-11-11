"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { BODY_MAX, ENQUIRY_TOPICS, MESSAGE_COLUMNS, SUBJECT_MAX, type EnquiryMessage } from "@/lib/enquiries";

type Fail = { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Turns database errors into something a person can act on. */
function friendly(e: { code?: string; message?: string } | null, fallback: string) {
  if (!e) return fallback;
  if (e.code === "VIEW_AS") return "You're viewing as someone else, so sending is switched off.";
  if (e.code === "P0001" && e.message) return e.message;
  return fallback;
}

const openSchema = z.object({
  topic: z.enum(Object.keys(ENQUIRY_TOPICS) as [string, ...string[]], { message: "Choose what it's about." }),
  subject: z.string().trim().min(3, "Give it a short subject, at least 3 characters.").max(SUBJECT_MAX, `Keep the subject to ${SUBJECT_MAX} characters.`),
  body: z.string().trim().min(1, "Write your message.").max(BODY_MAX, `Keep your message to ${BODY_MAX} characters.`),
});

/** A member starts a new conversation with the committee. */
export async function openEnquiry(_: unknown, form: FormData): Promise<Fail | { ok: true; id: string }> {
  const parsed = openSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const { db } = await requireUser("/portal/enquiries");
  const { data, error } = await db.rpc("enquiry_open", { p_topic: parsed.data.topic, p_subject: parsed.data.subject, p_body: parsed.data.body });
  if (error || !data) return { ok: false, error: friendly(error, "We couldn't send that. Please try again.") };
  revalidatePath("/portal", "layout");
  revalidatePath("/admin/enquiries");
  return { ok: true, id: data as string };
}

/** Adds a message to a conversation, as the member or as the committee. */
export async function sendEnquiryMessage(threadId: string, body: string): Promise<Fail | { ok: true; message: EnquiryMessage }> {
  const text = typeof body === "string" ? body.trim() : "";
  if (!z.string().uuid().safeParse(threadId).success) return { ok: false, error: "That conversation isn't available." };
  if (!text) return { ok: false, error: "Write a message first." };
  if (text.length > BODY_MAX) return { ok: false, error: `Keep your message to ${BODY_MAX} characters.` };
  const { db } = await requireUser("/portal/enquiries");
  const { data, error } = await db.rpc("enquiry_send", { p_thread: threadId, p_body: text }).select(MESSAGE_COLUMNS).single();
  if (error || !data) return { ok: false, error: friendly(error, "That didn't send. Check your connection and try again.") };
  revalidatePath("/portal", "layout");
  revalidatePath("/admin/enquiries");
  return { ok: true, message: data as EnquiryMessage };
}

/** Closes or reopens a conversation. */
export async function setEnquiryClosed(threadId: string, closed: boolean): Promise<Fail | { ok: true }> {
  if (!z.string().uuid().safeParse(threadId).success) return { ok: false, error: "That conversation isn't available." };
  const { db } = await requireUser("/portal/enquiries");
  const { error } = await db.rpc("enquiry_set_status", { p_thread: threadId, p_closed: Boolean(closed) });
  if (error) return { ok: false, error: friendly(error, "That didn't save. Please try again.") };
  revalidatePath("/portal", "layout");
  revalidatePath("/admin/enquiries");
  return { ok: true };
}

/** Deletes a conversation for good. Committee only (the database checks). */
export async function deleteEnquiry(threadId: string): Promise<Fail | { ok: true }> {
  if (!z.string().uuid().safeParse(threadId).success) return { ok: false, error: "That conversation isn't available." };
  const { db, profile } = await requireUser("/admin/enquiries");
  if (!profile.access.can.answer_enquiries && !profile.access.owner) return { ok: false, error: "You can't delete enquiries." };
  const { error, count } = await db.from("enquiry_threads").delete({ count: "exact" }).eq("id", threadId);
  if (error || !count) return { ok: false, error: friendly(error, "That didn't delete. Please try again.") };
  revalidatePath("/admin/enquiries");
  return { ok: true };
}
