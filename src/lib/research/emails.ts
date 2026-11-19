import "server-only";
import { STAGE_LABEL, type Stage } from "@/lib/research/instrument";
import { STUDY_TITLE } from "@/lib/research/content";
import { formatWhen, settingsFromRow, type StudySettings } from "@/lib/research/schedule";
import { emailConfigured, sendBatch } from "@/lib/email/resend";
import { escapeHtml, renderEmail } from "@/lib/email/template";
import { SITE_URL } from "@/lib/site";
import { serviceClient } from "@/lib/view-as";

export type ResearchEmailKind = "invite" | Stage;

/** The invitation (or reminder to answer it) and the "your questionnaire is open" email. */
export function researchEmail(o: { kind: ResearchEmailKind; to: string; name: string | null; closesAt: string | null; settings: StudySettings }) {
  const first = o.name?.split(" ")[0];
  const invite = o.kind === "invite";
  const stage: Stage = o.kind === "invite" ? "pre" : o.kind;
  const closes = formatWhen(o.closesAt);
  const { html, text } = renderEmail({
    siteUrl: SITE_URL,
    preheader: invite ? `Please complete it in My Hub by ${closes}` : `Open until ${closes}`,
    eyebrow: "INSPIRE research study",
    heading: invite ? "Your research study task is waiting in My Hub" : `${STAGE_LABEL[stage].title}: your questionnaire is open`,
    paragraphs: [
      first ? `Hi ${escapeHtml(first)},` : "Hello,",
      invite
        ? `Before INSPIRE we're asking everyone to complete a short research study task in My Hub: ${STUDY_TITLE}. It is three short questionnaires (about 5 minutes each: before, just after and eight weeks after the conference). Please open it by ${closes}.`
        : `Thank you for taking part. The ${STAGE_LABEL[stage].title.toLowerCase()} questionnaire takes about ${STAGE_LABEL[stage].minutes} minutes and is open until ${closes}.`,
      "Taking part is voluntary, separate from conference feedback, and makes no difference to your place, presentation, prizes or certificate.",
    ],
    cta: { label: invite ? "Open the research study" : "Open the questionnaire", url: `${SITE_URL}/portal/research${invite ? "" : `/${stage}`}` },
    footnote: invite
      ? "You're receiving this because you have an INSPIRE 2026 account. We'll remind you until you've answered the invitation in My Hub."
      : "You're receiving this because you agreed to reminders. You can turn them off on the Research study page in My Hub.",
    closing: o.settings.leadName && o.settings.leadEmail ? [`Questions? Contact the lead researcher, ${escapeHtml(o.settings.leadName)}, at ${escapeHtml(o.settings.leadEmail)}.`] : [],
  });
  return {
    to: o.to,
    subject: invite ? "Reminder: your INSPIRE research study task" : "INSPIRE research study: your questionnaire is open",
    text,
    html,
    replyTo: o.settings.leadEmail ?? undefined,
  };
}

type DueRow = { user_id: string; email: string; full_name: string | null; kind: ResearchEmailKind; closes_at: string | null };

/**
 * Sends the scheduled research reminders: the invitation to anyone who
 * hasn't answered it (every 2 days, then every 12 hours in the last day),
 * and "your questionnaire is open" to participants who agreed to reminders.
 * The database decides who is due and records the send.
 */
export async function sendDueResearchReminders(): Promise<{ ok: boolean; due: number; sent: number; error?: string }> {
  const admin = serviceClient();
  if (!admin) return { ok: false, due: 0, sent: 0, error: "SUPABASE_SERVICE_ROLE_KEY is not set" };
  // Without email set up, don't mark anyone as reminded.
  if (!emailConfigured()) return { ok: false, due: 0, sent: 0, error: "Resend is not set up" };
  const { data: st } = await admin.from("research_study").select("*").eq("id", 1).maybeSingle();
  const settings = settingsFromRow(st);
  if (!settings.enabled) return { ok: true, due: 0, sent: 0 };
  const { data, error } = await admin.rpc("research_due_reminders");
  if (error) return { ok: false, due: 0, sent: 0, error: error.message };
  const rows = (data ?? []) as DueRow[];
  const mails = rows.map((r) => researchEmail({ kind: r.kind, to: r.email, name: r.full_name, closesAt: r.closes_at, settings }));
  const sent = mails.length ? await sendBatch(mails) : 0;
  return { ok: true, due: rows.length, sent };
}
