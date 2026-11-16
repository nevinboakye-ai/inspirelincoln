"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth";
import { rolesLabel } from "@/lib/accounts";
import { sendBatch, sendEmail } from "@/lib/email/resend";
import { BIO_MIN_WORDS, formatDeadline, needsReminder, wordCount, reminderEmail, tasksFor, type ReminderKind, type ReminderPerson, type TaskKey } from "@/lib/email/reminders";
import { loadReminderAudience } from "@/lib/email/reminder-audience";
import { loginDetailsAvailable, prepareLogins, type LoginDetails } from "@/lib/accounts/login-details";
import { SITE_URL } from "@/lib/site";
import type { AccountType } from "@/lib/types";
import type { ActionResult } from "@/app/portal/actions";

const WEBSITE = SITE_URL.replace(/^https?:\/\//, "");

/** One person in the reminder list, with the tasks their email will list. */
export type ReminderRow = {
  email: string;
  name: string;
  detail: string;
  joined: boolean;
  tasks: { key: TaskKey; title: string }[];
};

const kindSchema = z.enum(["final", "sign_in", "presenter"]);

function senderLine(profile: { fullName: string | null; accountStatus: string; accountType: AccountType; committeePosition: string | null }) {
  const role =
    profile.accountStatus === "approved"
      ? profile.accountType === "president"
        ? "President"
        : profile.accountType === "vice_president"
          ? "Vice president"
          : profile.committeePosition
      : null;
  return [profile.fullName, role].filter(Boolean).join(", ");
}

function loginRows(login: LoginDetails | "sample" | null): { label: string; value: string }[] | undefined {
  if (login === "sample")
    return [
      { label: "Website", value: `${WEBSITE}/login` },
      { label: "Email", value: "their email address" },
      { label: "Temporary password", value: "made for each person when you send" },
    ];
  if (!login) return undefined;
  return [
    { label: "Website", value: `${WEBSITE}/login` },
    { label: "Email", value: login.email },
    login.kind === "temporary"
      ? { label: "Temporary password", value: login.password }
      : { label: "Password", value: "the one you chose. Forgotten it? Use \"Forgotten your password?\" on the login page." },
  ];
}

async function recipients(kind: ReminderKind) {
  const r = await loadReminderAudience();
  if (!r.ok) return r;
  const people = r.audience.people.filter((p) => needsReminder(kind, p));
  return { ok: true as const, people, rankingClosesAt: r.audience.rankingClosesAt };
}

const toRow = (kind: ReminderKind, p: ReminderPerson): ReminderRow => ({
  email: p.email,
  name: p.fullName || p.email,
  detail: [rolesLabel(p.roles.filter((t) => ["delegate", "oral_presenter", "poster_presenter", "oral_waitlist"].includes(t))), p.institution].filter(Boolean).join(" · "),
  joined: p.joined,
  tasks: tasksFor(kind, p).map((t) => ({ key: t.key, title: t.title })),
});

/** Who a reminder would go to right now, and a suggested deadline. */
export async function listReminderRecipients(
  kindInput: ReminderKind,
): Promise<{ ok: true; people: ReminderRow[]; suggested: { date: string; time: string } | null } | { ok: false; error: string }> {
  await requireAccess("send_email", "/admin/email");
  const kind = kindSchema.parse(kindInput);
  const r = await recipients(kind);
  if (!r.ok) return r;
  let suggested: { date: string; time: string } | null = null;
  if (r.rankingClosesAt) {
    // Shown in UK time, as people read it.
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(r.rankingClosesAt));
    const g = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
    suggested = { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
  }
  return { ok: true, people: r.people.map((p) => toRow(kind, p)), suggested };
}

const previewSchema = z.object({
  kind: kindSchema,
  email: z.string().email().nullable(),
  date: z.string(),
  time: z.string().optional().default(""),
  note: z.string().max(1500).optional().default(""),
});

/** The email exactly as one person would get it (login details shown as a sample). */
export async function previewReminder(input: z.input<typeof previewSchema>): Promise<{ ok: true; subject: string; html: string } | { ok: false; error: string }> {
  const { profile } = await requireAccess("send_email", "/admin/email");
  const v = previewSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Choose a deadline first." };
  const deadline = formatDeadline(v.data.date, v.data.time) ?? "the deadline";
  let person: ReminderPerson | null = null;
  if (v.data.email) {
    const r = await recipients(v.data.kind);
    if (!r.ok) return r;
    person = r.people.find((p) => p.email === v.data.email!.toLowerCase()) ?? null;
  }
  const sample: ReminderPerson = person ?? {
    email: "sample@example.com",
    fullName: "Alex Example",
    institution: "University of Lincoln",
    joined: false,
    signedIn: v.data.kind === "presenter",
    roles: v.data.kind === "sign_in" ? ["delegate"] : ["oral_presenter"],
    photo: false,
    details: false,
    bio: v.data.kind !== "sign_in" ? "Medical student interested in digital health." : null,
    travel: false,
    ranked: false,
    attendance: null,
    submissions: {},
  };
  const tasks = tasksFor(v.data.kind, sample);
  const e = reminderEmail({
    kind: v.data.kind,
    siteUrl: SITE_URL,
    name: sample.fullName,
    roles: sample.roles,
    tasks,
    deadline,
    login: !sample.signedIn ? loginRows("sample") : undefined,
    bioDone: wordCount(sample.bio) >= BIO_MIN_WORDS,
    note: v.data.note,
    sender: senderLine(profile),
  });
  return { ok: true, subject: e.subject, html: e.html };
}

const sendSchema = z.object({
  kind: kindSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the deadline date."),
  time: z.string().regex(/^(\d{2}:\d{2})?$/).optional().default(""),
  note: z.string().trim().max(1500, "Keep the note under 1,500 characters.").optional().default(""),
  intent: z.enum(["test", "send"]),
});

/**
 * Sends each person their own reminder, listing only what they still have to
 * do. Anyone who hasn't signed in gets their login details (a temporary
 * password if they haven't chosen one), so the email alone gets them in.
 */
export async function sendReminders(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, user, profile } = await requireAccess("send_email", "/admin/email");
  const parsed = sendSchema.safeParse({
    kind: form.get("kind"),
    date: form.get("date"),
    time: form.get("time") ?? "",
    note: form.get("note") ?? "",
    intent: form.get("intent"),
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fe };
  }
  const v = parsed.data;
  const deadline = formatDeadline(v.date, v.time);
  if (!deadline) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { date: "Choose the deadline date." } };
  const sender = senderLine(profile);

  if (v.intent === "test") {
    const sample = reminderEmail({
      kind: v.kind,
      siteUrl: SITE_URL,
      name: profile.fullName,
      roles: v.kind === "sign_in" ? ["delegate"] : ["oral_presenter"],
      tasks: tasksFor(v.kind, {
        email: user.email!,
        fullName: profile.fullName,
        institution: null,
        joined: true,
        signedIn: false,
        roles: v.kind === "sign_in" ? ["delegate"] : ["oral_presenter"],
        photo: false,
        details: false,
        bio: null,
        travel: false,
        ranked: false,
        attendance: null,
        submissions: {},
      }),
      deadline,
      login: loginRows("sample"),
      note: v.note,
      sender,
    });
    const ok = await sendEmail({ to: user.email!, subject: `[Test] ${sample.subject}`, html: sample.html, text: sample.text });
    return ok
      ? { ok: true, message: `A test has been sent to ${user.email}. It lists every task, so you can see them all; each person only gets the ones they haven't done.` }
      : { ok: false, error: "Email isn't set up yet. Add the Resend settings in Vercel first." };
  }

  const found = await recipients(v.kind);
  if (!found.ok) return found;
  const excluded = new Set(form.getAll("exclude").map((e) => String(e).toLowerCase()));
  const people = found.people.filter((p) => !excluded.has(p.email));
  if (!people.length) return { ok: false, error: found.people.length ? "Everyone has been unticked." : "Nobody needs this reminder right now." };

  const needLogin = people.filter((p) => !p.signedIn);
  if (needLogin.length && !loginDetailsAvailable()) return { ok: false, error: "Login details need SUPABASE_SERVICE_ROLE_KEY in Vercel. Add it and redeploy." };
  const logins = needLogin.length
    ? await prepareLogins(needLogin.map((p) => ({ email: p.email, joined: p.joined, account_type: p.roles[0] })))
    : new Map<string, LoginDetails>();
  if (!logins) return { ok: false, error: "Could not prepare login details. Check SUPABASE_SERVICE_ROLE_KEY in Vercel." };

  const delivered = await sendBatch(
    people.map((p) => {
      const e = reminderEmail({
        kind: v.kind,
        siteUrl: SITE_URL,
        name: p.fullName,
        roles: p.roles,
        tasks: tasksFor(v.kind, p),
        deadline,
        login: p.signedIn ? undefined : loginRows(logins.get(p.email) ?? null),
        bioDone: wordCount(p.bio) >= BIO_MIN_WORDS,
        note: v.note,
        sender,
      });
      return { to: p.email, subject: e.subject, html: e.html, text: e.text };
    }),
  );

  const label = v.kind === "final" ? "Final reminder: all outstanding tasks" : v.kind === "sign_in" ? "Reminder: sign in and complete tasks" : "Reminder: presenter tasks";
  await db.from("email_broadcasts").insert({
    sent_by: user.id,
    sender_name: sender,
    subject: `${label} by ${deadline}`,
    body: `${label}. Each person's email listed only their own outstanding tasks.${v.note ? `\n\nNote: ${v.note}` : ""}`,
    purpose: "service",
    audience_types: [...new Set(people.flatMap((p) => p.roles))],
    audience_statuses: ["approved"],
    include_selected: people.some((p) => !p.joined),
    recipient_count: people.length,
    delivered_count: delivered,
  });
  revalidatePath("/admin/email");
  if (!delivered) return { ok: false, error: "Nothing was sent. Check that email is set up in Vercel." };
  return { ok: true, message: `Reminder sent to ${delivered} of ${people.length} ${people.length === 1 ? "person" : "people"}.` };
}
