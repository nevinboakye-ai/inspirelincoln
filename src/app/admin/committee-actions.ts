"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { ACCOUNT_TYPES, canApprove } from "@/lib/accounts";
import { sendBatch, sendEmail } from "@/lib/email/resend";
import { accountDecisionEmail, feedbackEmail } from "@/lib/email/messages";
import { escapeHtml, renderEmail } from "@/lib/email/template";
import { SITE_URL } from "@/lib/site";
import type { AccountStatus, AccountType, SubmissionKind } from "@/lib/types";
import type { ActionResult } from "@/app/portal/actions";

const reviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "waitlisted", "declined", "pending"]),
  type: z.enum(ACCOUNT_TYPES as [AccountType, ...AccountType[]]),
  note: z.string().trim().max(1000).optional().default(""),
  notify: z.boolean(),
});

/** Executive review of an account. Updates the account and the registration together, then emails the person. */
export async function reviewAccount(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, user, profile } = await requireRole(["admin"], "/admin/accounts");
  const parsed = reviewSchema.safeParse({ ...Object.fromEntries(form), notify: form.get("notify") === "on" });
  if (!parsed.success) return { ok: false, error: "Choose a decision." };
  const v = parsed.data;
  if (v.id === user.id && !profile.access.leadership) return { ok: false, error: "You can't review your own account." };
  if (v.status === "approved" && !canApprove(profile.access, v.type))
    return { ok: false, error: "Only the president or vice president can approve executive committee accounts." };

  const { data, error } = await db.rpc("review_account", { target: v.id, new_status: v.status, new_type: v.type, note: v.note || null });
  if (error) {
    const msg = error.message.includes("site owner")
      ? "Only the site owner can change the site owner's account."
      : error.message.includes("president")
        ? "Only the president or vice president can approve executive committee accounts."
        : "Could not save the decision.";
    return { ok: false, error: msg };
  }
  const p = Array.isArray(data) ? data[0] : data;
  let emailed = false;
  if (v.notify && p?.email) {
    const mail = accountDecisionEmail({ siteUrl: SITE_URL, name: p.full_name, status: v.status as AccountStatus, type: v.type, note: v.note || null });
    if (mail) emailed = await sendEmail({ to: p.email, ...mail });
  }
  revalidatePath("/admin/accounts");
  revalidatePath("/admin");
  const label = { approved: "Approved", waitlisted: "Added to the waitlist", declined: "Declined", pending: "Moved back to review" }[v.status];
  return { ok: true, message: `${label}.${v.notify ? (emailed ? " They've been emailed." : " Email isn't set up yet, so they weren't emailed.") : ""}` };
}

const feedbackSchema = z.object({
  submissionId: z.string().uuid(),
  decision: z.enum(["comment", "changes_requested", "approved"]),
  body: z.string().trim().max(5000),
});

/** Committee feedback on a slide deck or poster. A decision also updates the submission's status. */
export async function giveFeedback(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["editor"], "/admin/submissions");
  const parsed = feedbackSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Choose a decision." };
  const v = parsed.data;
  if (v.decision !== "approved" && v.body.length < 3) return { ok: false, fieldErrors: { body: "Write some feedback for the presenter." } };

  const { data: sub } = await db.from("presentation_submissions").select("id, kind, title, user_id").eq("id", v.submissionId).maybeSingle();
  if (!sub) return { ok: false, error: "Submission not found." };
  const { error } = await db.from("submission_feedback").insert({ submission_id: v.submissionId, decision: v.decision, body: v.body });
  if (error) return { ok: false, error: "Could not save your feedback." };

  const { data: rows } = await db.rpc("submission_presenter", { sub: v.submissionId });
  const person = Array.isArray(rows) ? rows[0] : rows;
  let emailed = false;
  if (person?.email) {
    emailed = await sendEmail({
      to: person.email,
      ...feedbackEmail({ siteUrl: SITE_URL, name: person.full_name, kind: sub.kind as SubmissionKind, title: sub.title, decision: v.decision }),
    });
  }
  revalidatePath(`/admin/submissions/${v.submissionId}`);
  revalidatePath("/admin/submissions");
  return { ok: true, message: emailed ? "Feedback saved and the presenter has been emailed." : "Feedback saved. The presenter will see it in their account." };
}

const broadcastSchema = z.object({
  subject: z.string().trim().min(3, "Write a subject.").max(160),
  body: z.string().trim().min(10, "Write your message.").max(10000),
  purpose: z.enum(["service", "marketing"]),
  types: z.array(z.enum(ACCOUNT_TYPES as [AccountType, ...AccountType[]])).min(1, "Choose at least one group."),
  statuses: z.array(z.enum(["pending", "approved", "waitlisted", "declined"])).min(1, "Choose at least one account status."),
  intent: z.enum(["preview", "test", "send"]),
});

export type BroadcastResult = (ActionResult & { count?: number }) | null;

/** Group email from the president or vice president to chosen account types. */
export async function sendBroadcast(_: BroadcastResult, form: FormData): Promise<BroadcastResult> {
  const { db, user, profile } = await requireRole(["admin"], "/admin/email");
  if (!profile.access.leadership) return { ok: false, error: "Only the president or vice president can send group emails." };
  const parsed = broadcastSchema.safeParse({
    subject: form.get("subject"),
    body: form.get("body"),
    purpose: form.get("purpose"),
    types: form.getAll("types"),
    statuses: form.getAll("statuses"),
    intent: form.get("intent"),
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fe };
  }
  const v = parsed.data;

  let q = db.from("profiles").select("email, full_name").in("account_type", v.types).in("account_status", v.statuses).limit(5000);
  // Marketing and news only go to people who opted in.
  if (v.purpose === "marketing") q = q.eq("marketing_opt_in", true);
  const { data: people, error } = await q;
  if (error) return { ok: false, error: "Could not load the recipients." };
  const recipients = (people ?? []).filter((p) => p.email);

  if (v.intent === "preview") return { ok: true, count: recipients.length, message: `${recipients.length} ${recipients.length === 1 ? "person" : "people"} will receive this.` };

  const sender = [profile.fullName, profile.access.leadership ? (profile.accountType === "president" ? "President" : profile.accountType === "vice_president" ? "Vice president" : null) : null]
    .filter(Boolean)
    .join(", ");
  const paragraphs = v.body.split(/\n{2,}/).map((para) => escapeHtml(para).replace(/\n/g, "<br>"));
  const build = (name: string | null) =>
    renderEmail({
      siteUrl: SITE_URL,
      preheader: v.body.slice(0, 120),
      eyebrow: v.purpose === "marketing" ? "News from INSPIRE" : "Conference update",
      heading: v.subject,
      paragraphs: [`Hello ${escapeHtml(name?.split(" ")[0] || "there")},`, ...paragraphs, sender ? `${escapeHtml(sender)}<br>On behalf of the INSPIRE committee` : "The INSPIRE committee"],
      footnote:
        v.purpose === "marketing"
          ? `You're receiving this because you asked for news about INSPIRE events. <a href="${SITE_URL}/portal/profile" style="color:#1a3154;">Stop these emails</a>.`
          : "You're receiving this because you have an INSPIRE account and it's about the conference.",
    });

  if (v.intent === "test") {
    const ok = await sendEmail({ to: user.email!, subject: `[Test] ${v.subject}`, ...build(profile.fullName) });
    return ok ? { ok: true, message: `A test has been sent to ${user.email}.` } : { ok: false, error: "Email isn't set up yet. Add the Resend settings in Vercel first." };
  }

  if (!recipients.length) return { ok: false, error: "Nobody matches those groups." };
  const delivered = await sendBatch(recipients.map((r) => ({ to: r.email, subject: v.subject, ...build(r.full_name) })));
  await db.from("email_broadcasts").insert({
    sent_by: user.id,
    sender_name: sender,
    subject: v.subject,
    body: v.body,
    purpose: v.purpose,
    audience_types: v.types,
    audience_statuses: v.statuses,
    recipient_count: recipients.length,
    delivered_count: delivered,
  });
  revalidatePath("/admin/email");
  if (!delivered) return { ok: false, error: "Nothing was sent. Check that email is set up in Vercel." };
  return { ok: true, message: `Sent to ${delivered} of ${recipients.length} people.` };
}
