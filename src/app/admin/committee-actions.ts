"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth";
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
  const { db, user, profile } = await requireAccess("review_accounts", "/admin/accounts");
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
  const { db } = await requireAccess("review_submissions", "/admin/submissions");
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
  statuses: z.array(z.enum(["pending", "approved", "waitlisted", "declined"])),
  includeSelected: z.boolean(),
  intent: z.enum(["preview", "test", "send"]),
});

export type BroadcastResult = (ActionResult & { count?: number }) | null;

type Recipient = { email: string; full_name: string | null; joined: boolean };

/** Someone a group email will go to, as shown in the recipient list. */
export type RecipientRow = Recipient & { account_type: AccountType; account_status: AccountStatus | null; institution: string | null; id: string | null };

type Selection = { types: AccountType[]; statuses: AccountStatus[]; purpose: "service" | "marketing"; includeSelected: boolean };

/** Everyone a group email would reach, with duplicates removed and accounts taking priority over the selected list. */
async function resolveRecipients(db: Awaited<ReturnType<typeof requireAccess>>["db"], v: Selection): Promise<{ ok: true; people: RecipientRow[] } | { ok: false }> {
  // Selected people haven't agreed to news, so they only get conference updates.
  const withSelected = v.includeSelected && v.purpose === "service";
  const [accounts, selected] = await Promise.all([
    v.statuses.length && v.types.length
      ? db.rpc("broadcast_recipients", { types: v.types, statuses: v.statuses, marketing_only: v.purpose === "marketing" })
      : Promise.resolve({ data: [], error: null }),
    withSelected && v.types.length ? db.rpc("selected_recipients", { types: v.types }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (accounts.error || selected.error) return { ok: false };
  const seen = new Set<string>();
  const people: RecipientRow[] = [];
  for (const [rows, joined] of [[accounts.data, true], [selected.data, false]] as const)
    for (const r of (rows ?? []) as { email: string; full_name: string | null; account_type: AccountType; account_status?: AccountStatus; institution: string | null; id?: string }[]) {
      const e = r.email?.toLowerCase();
      if (!e || seen.has(e)) continue;
      seen.add(e);
      people.push({ email: e, full_name: r.full_name, joined, account_type: r.account_type, account_status: r.account_status ?? null, institution: r.institution, id: r.id ?? null });
    }
  people.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email, "en-GB"));
  return { ok: true, people };
}

const selectionSchema = z.object({
  types: z.array(z.enum(ACCOUNT_TYPES as [AccountType, ...AccountType[]])),
  statuses: z.array(z.enum(["pending", "approved", "waitlisted", "declined"])),
  purpose: z.enum(["service", "marketing"]),
  includeSelected: z.boolean(),
});

/** The live list of who a group email will reach, shown while the committee chooses groups. */
export async function previewRecipients(input: Selection): Promise<{ ok: true; people: RecipientRow[] } | { ok: false; error: string }> {
  const { db } = await requireAccess("send_email", "/admin/email");
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose who to send to." };
  const r = await resolveRecipients(db, parsed.data);
  return r.ok ? r : { ok: false, error: "Could not load the recipients." };
}

function senderLine(profile: { fullName: string | null; accountStatus: string; accountType: AccountType; committeePosition: string | null }) {
  return [profile.fullName, profile.accountStatus === "approved" ? (profile.accountType === "president" ? "President" : profile.accountType === "vice_president" ? "Vice president" : profile.committeePosition) : null]
    .filter(Boolean)
    .join(", ");
}

/**
 * The email itself. People on the selected list who haven't set up an
 * account get a button to do it, and a footnote saying why they're hearing from us.
 */
function buildEmail(o: { subject: string; body: string; purpose: "service" | "marketing" | "direct"; sender: string; name: string | null; joined: boolean }) {
  const paragraphs = o.body.split(/\n{2,}/).map((para) => escapeHtml(para).replace(/\n/g, "<br>"));
  return renderEmail({
    siteUrl: SITE_URL,
    preheader: o.body.slice(0, 120),
    eyebrow: o.purpose === "marketing" ? "News from INSPIRE" : o.purpose === "direct" ? "A message from INSPIRE" : "Conference update",
    heading: o.subject,
    paragraphs: [`Hello ${escapeHtml(o.name?.split(" ")[0] || "there")},`, ...paragraphs, o.sender ? `${escapeHtml(o.sender)}<br>On behalf of the INSPIRE committee` : "The INSPIRE committee"],
    cta: o.joined ? undefined : { label: "Set up your account", url: `${SITE_URL}/auth/activate` },
    footnote: !o.joined
      ? "You're receiving this because you were selected to attend INSPIRE. Set up your account with this email address to see your Delegate Card."
      : o.purpose === "marketing"
        ? `You're receiving this because you asked for news about INSPIRE events. <a href="${SITE_URL}/portal/profile" style="color:#1a3154;">Stop these emails</a>.`
        : "You're receiving this because you have an INSPIRE account and it's about the conference.",
  });
}

/** Group email to chosen account types, optionally including selected delegates who haven't joined yet. */
export async function sendBroadcast(_: BroadcastResult, form: FormData): Promise<BroadcastResult> {
  const { db, user, profile } = await requireAccess("send_email", "/admin/email");
  const parsed = broadcastSchema.safeParse({
    subject: form.get("subject"),
    body: form.get("body"),
    purpose: form.get("purpose"),
    types: form.getAll("types"),
    statuses: form.getAll("statuses"),
    includeSelected: form.get("includeSelected") === "on",
    intent: form.get("intent"),
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fe };
  }
  const v = parsed.data;
  const withSelected = v.includeSelected && v.purpose === "service";
  if (!v.statuses.length && !withSelected) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { statuses: "Choose at least one account status, or include selected delegates." } };

  const found = await resolveRecipients(db, v);
  if (!found.ok) return { ok: false, error: "Could not load the recipients." };
  const excluded = new Set(form.getAll("exclude").map((e) => String(e).toLowerCase()));
  const recipients = found.people.filter((r) => !excluded.has(r.email));
  const waiting = recipients.filter((r) => !r.joined).length;

  if (v.intent === "preview")
    return {
      ok: true,
      count: recipients.length,
      message: `${recipients.length} ${recipients.length === 1 ? "person" : "people"} will receive this${waiting ? `, including ${waiting} selected ${waiting === 1 ? "delegate who hasn't" : "delegates who haven't"} set up an account yet` : ""}.`,
    };

  const sender = senderLine(profile);
  if (v.intent === "test") {
    const ok = await sendEmail({ to: user.email!, subject: `[Test] ${v.subject}`, ...buildEmail({ ...v, sender, name: profile.fullName, joined: true }) });
    return ok ? { ok: true, message: `A test has been sent to ${user.email}.` } : { ok: false, error: "Email isn't set up yet. Add the Resend settings in Vercel first." };
  }

  if (!recipients.length) return { ok: false, error: found.people.length ? "Everyone in those groups has been unticked." : "Nobody matches those groups." };
  const delivered = await sendBatch(recipients.map((r) => ({ to: r.email, subject: v.subject, ...buildEmail({ ...v, sender, name: r.full_name, joined: r.joined }) })));
  await db.from("email_broadcasts").insert({
    sent_by: user.id,
    sender_name: sender,
    subject: v.subject,
    body: v.body,
    purpose: v.purpose,
    audience_types: v.types,
    audience_statuses: v.statuses,
    include_selected: withSelected,
    recipient_count: recipients.length,
    delivered_count: delivered,
  });
  revalidatePath("/admin/email");
  if (!delivered) return { ok: false, error: "Nothing was sent. Check that email is set up in Vercel." };
  return { ok: true, message: `Sent to ${delivered} of ${recipients.length} people.` };
}

const directSchema = z.object({
  to: z.string().trim().toLowerCase().email("Choose who to email."),
  subject: z.string().trim().min(3, "Write a subject.").max(160),
  body: z.string().trim().min(10, "Write your message.").max(10000),
  intent: z.enum(["test", "send"]),
});

/** Email one delegate. Only people with an account or on the selected list can be chosen. */
export async function sendDirectEmail(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, user, profile } = await requireAccess("send_email", "/admin/email");
  const parsed = directSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fe };
  }
  const v = parsed.data;
  const { data, error } = await db.rpc("email_directory");
  if (error) return { ok: false, error: "Could not load the delegate list." };
  const person = ((data ?? []) as { email: string; full_name: string | null; joined: boolean }[]).find((p) => p.email === v.to);
  if (!person) return { ok: false, fieldErrors: { to: "Choose someone from the list. You can only email delegates and people on the selected list." } };
  const sender = senderLine(profile);
  const content = buildEmail({ subject: v.subject, body: v.body, purpose: "direct", sender, name: person.full_name, joined: person.joined });

  if (v.intent === "test") {
    const ok = await sendEmail({ to: user.email!, subject: `[Test] ${v.subject}`, ...content });
    return ok ? { ok: true, message: `A test has been sent to ${user.email}.` } : { ok: false, error: "Email isn't set up yet. Add the Resend settings in Vercel first." };
  }
  const ok = await sendEmail({ to: person.email, subject: v.subject, replyTo: user.email ?? undefined, ...content });
  await db.from("email_broadcasts").insert({
    sent_by: user.id,
    sender_name: sender,
    subject: v.subject,
    body: v.body,
    purpose: "service",
    audience_types: [],
    audience_statuses: [],
    recipient_email: person.email,
    recipient_count: 1,
    delivered_count: ok ? 1 : 0,
  });
  revalidatePath("/admin/email");
  return ok ? { ok: true, message: `Sent to ${person.full_name || person.email}.` } : { ok: false, error: "Nothing was sent. Check that email is set up in Vercel." };
}
