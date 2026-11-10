"use server";
import { headers } from "next/headers";
import { contactSchema, ENQUIRY_CATEGORIES } from "@/lib/validation/contact";
import { createPublicClient } from "@/lib/supabase/server";
import { emailConfigured, sendEmail } from "@/lib/email/resend";

export type ContactResult =
  | { ok: true; stored: boolean; emailed: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Per-instance burst protection. The database also limits by email address.
const recent = new Map<string, number[]>();
function throttled(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > 5;
}

export async function submitContact(raw: unknown): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  // Honeypot and time trap: pretend success to bots without storing anything.
  if (data.website || (data.startedAt && Date.now() - data.startedAt < 3000)) {
    return { ok: true, stored: false, emailed: false };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (throttled(ip)) return { ok: false, error: "Too many messages in a short time. Please try again later." };

  const db = createPublicClient();
  const to = process.env.CONTACT_TO_EMAIL;
  if (!db && !(emailConfigured() && to)) {
    return { ok: false, error: "The contact form is not active yet. Please try again later." };
  }

  let emailed = false;
  if (emailConfigured() && to) {
    emailed = await sendEmail({
      to,
      replyTo: data.email,
      subject: `[INSPIRE] ${ENQUIRY_CATEGORIES[data.category]}: ${data.subject}`,
      text: `From: ${data.name} <${data.email}>\nCategory: ${ENQUIRY_CATEGORIES[data.category]}\n\n${data.message}`,
    });
  }

  let stored = false;
  if (db) {
    const { error } = await db.from("contact_enquiries").insert({
      name: data.name,
      email: data.email,
      category: data.category,
      subject: data.subject,
      message: data.message,
      consent: true,
      delivered: emailed,
    });
    if (error) {
      if (error.message.includes("rate_limited")) return { ok: false, error: "You have sent several messages recently. Please wait a while before trying again." };
      console.error("[contact] insert failed", error);
    } else stored = true;
  }

  if (!stored && !emailed) return { ok: false, error: "We couldn't send your message. Please try again shortly." };
  return { ok: true, stored, emailed };
}
