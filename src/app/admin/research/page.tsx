import type { Metadata } from "next";
import Link from "next/link";
import { Download, Eye, FileText, FlaskConical, Mail, ShieldAlert } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Flash, Panel, btn } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { inputClass } from "@/components/forms/field";
import { toZonedInputValue } from "@/lib/time";
import { STAGES, STAGE_LABEL } from "@/lib/research/instrument";
import { formatWhen, isOpen, launchBlockers } from "@/lib/research/schedule";
import { getStudySettings } from "@/lib/research/server";
import { emailConfigured } from "@/lib/email/resend";
import { anonymiseStudy, saveStudySettings, sendResearchEmails, setStudyEnabled } from "./actions";

export const metadata: Metadata = { title: "Research study" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  view_as: "You're viewing as someone else, so changes are switched off.",
  settings: "That couldn't be saved. Check the dates and email address and try again.",
  running: "While the study is running, the questionnaire windows have to stay in order: before, after, then eight weeks on. Switch it off first to change them.",
  blocked: "The study can't be switched on yet. Clear everything in the list first.",
  email: "Email isn't set up on this website (Resend), so nothing was sent.",
  off: "Switch the study on before sending emails.",
  confirm: "Type ANONYMISE to confirm.",
  too_early: "Anonymise only after the eight-week questionnaire has closed.",
};
const SAVED: Record<string, string> = {
  settings: "Study settings saved.",
  on: "The study is on. Invited delegates now see the invitation in My Hub.",
  off: "The study is off. Delegates no longer see it; answers already given are kept.",
  anonymised: "The link between study codes and accounts has been deleted. The data are now anonymous.",
};

function Stat({ label, value, of }: { label: string; value: number; of?: number }) {
  const pct = of ? Math.round((value / of) * 100) : null;
  return (
    <div className="rounded-xl border border-navy/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">
        {value}
        {pct !== null && <span className="ml-1.5 font-ui text-sm text-slate">{pct}%</span>}
      </p>
    </div>
  );
}

export default async function ResearchAdmin({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; sent?: string; of?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireAccess("research_data", "/admin/research");
  const { ready, settings: s } = await getStudySettings(db);

  if (!ready) {
    return (
      <div className="space-y-6">
        <AdminHeader title="Research study" />
        <Notice tone="warning" title="One database step left">
          Run setup file 50 (<code>50-research-study.sql</code>) in the Supabase SQL editor to add the research study. It starts switched off.
        </Notice>
      </div>
    );
  }

  const { data: sum } = await db.rpc("research_summary");
  const n = (k: string) => Number((sum as Record<string, unknown> | null)?.[k] ?? 0);
  const blockers = launchBlockers(s);
  const now = new Date();
  const field = (name: string, label: string, opts: { type?: string; def?: string | null; hint?: string; required?: boolean } = {}) => (
    <div>
      <label htmlFor={name} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input id={name} name={name} type={opts.type ?? "text"} defaultValue={opts.def ?? ""} required={opts.required} aria-describedby={opts.hint ? `${name}-hint` : undefined} className={`${inputClass} mt-1.5`} />
      {opts.hint && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-slate">
          {opts.hint}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Research study"
        description="The three-stage research study in My Hub. Only people with the Research study permission can open this page or the data. The rest of the committee never sees individual answers."
        actions={
          <>
            <Link href="/portal/research?preview=1" className={btn.secondary}>
              <Eye aria-hidden className="size-4" /> Preview as a delegate
            </Link>
            <Link href="/admin/research/questionnaires" className={btn.secondary}>
              <FileText aria-hidden className="size-4" /> Printable questionnaires
            </Link>
          </>
        }
      />
      {sp.saved && SAVED[sp.saved] && <Flash>{SAVED[sp.saved]}</Flash>}
      {sp.sent && <Flash>{`Sent ${sp.sent} of ${sp.of} emails.`}</Flash>}
      {sp.error && ERRORS[sp.error] && (
        <p role="alert" className="rounded-md border border-danger/25 bg-danger/[0.06] p-4 text-sm font-medium text-danger">
          {ERRORS[sp.error]}
        </p>
      )}

      <Panel title="Switch">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <FlaskConical aria-hidden className="size-4 text-electric-600" /> Research study in My Hub <Badge tone={s.enabled ? "success" : "warning"}>{s.enabled ? "On" : "Off"}</Badge>
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {s.enabled
                ? "Invited delegates and presenters see the invitation until they answer it, and participants see each questionnaire while it's open."
                : "Nobody sees the study. Switch it on to invite delegates."}
            </p>
            {!s.enabled && blockers.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>
          <form action={setStudyEnabled}>
            {!s.enabled && <input type="hidden" name="enabled" value="on" />}
            <button className={s.enabled ? btn.secondary : btn.primary} disabled={!s.enabled && blockers.length > 0}>
              {s.enabled ? "Turn off" : "Turn on"}
            </button>
          </form>
        </div>
      </Panel>

      <Panel title="Responses">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Invited" value={n("eligible")} />
          <Stat label="Taking part" value={n("consented")} of={n("eligible")} />
          <Stat label="Said no thanks" value={n("declined")} of={n("eligible")} />
          <Stat label="Withdrawn" value={n("withdrawn")} />
          <Stat label="Before" value={n("pre")} of={n("consented")} />
          <Stat label="After" value={n("post")} of={n("pre")} />
          <Stat label="Eight weeks" value={n("followup")} of={n("pre")} />
          <Stat label="Paired before and after" value={n("pre_post")} of={n("pre")} />
        </div>
        <p className="mt-3 text-sm text-slate-700">
          All three questionnaires: <strong>{n("all_three")}</strong>. The protocol&apos;s power estimate needs about 80 paired before-and-after responses to detect a small-to-moderate change (d = 0.32).
        </p>
      </Panel>

      <Panel title="Invitations and reminders">
        {!emailConfigured() && <Notice tone="warning">Email isn&apos;t set up on this website, so these buttons won&apos;t send anything.</Notice>}
        <p className="text-sm text-slate-700">These go automatically while the study is on: the invitation to everyone who hasn&apos;t answered it every 2 days (every 12 hours in the last day before the first questionnaire closes), and questionnaire reminders to participants who agreed to them, every 2 days. Use these buttons to send one now as well.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={sendResearchEmails}>
            <input type="hidden" name="kind" value="invite" />
            <button className={btn.secondary} disabled={!s.enabled || !isOpen(s, "pre", now)}>
              <Mail aria-hidden className="size-4" /> Email the invitation
            </button>
          </form>
          {STAGES.map((st) => (
            <form key={st} action={sendResearchEmails}>
              <input type="hidden" name="kind" value={st} />
              <button className={btn.secondary} disabled={!s.enabled || !isOpen(s, st, now)}>
                <Mail aria-hidden className="size-4" /> Remind: {STAGE_LABEL[st].title.toLowerCase()}
              </button>
            </form>
          ))}
        </div>
      </Panel>

      <Panel title="Data">
        <p className="text-sm text-slate-700">
          De-identified CSV files: every row carries a random study code, never a name, email or account id. Dates are given as days from the conference. Each export is written to the audit log. Store downloads securely and share them only with the research team.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/admin/research/export?file=wide" className={btn.primary}>
            <Download aria-hidden className="size-4" /> One row per participant
          </a>
          <a href="/admin/research/export?file=long" className={btn.secondary}>
            <Download aria-hidden className="size-4" /> One row per questionnaire (for mixed models)
          </a>
          <a href="/admin/research/export?file=codebook" className={btn.secondary}>
            <Download aria-hidden className="size-4" /> Codebook
          </a>
        </div>
      </Panel>

      <Panel title="Contact and dates">
        <form action={saveStudySettings} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("event_date", "Conference date", { type: "date", def: s.eventDate, required: true })}
            {field("lead_name", "Lead researcher (optional, shown to participants)", { def: s.leadName })}
            {field("lead_email", "Lead researcher's email (optional)", { type: "email", def: s.leadEmail })}
            {field("info_version", "Participant information version", { def: s.infoVersion, required: true, hint: "Recorded with every consent. Change it whenever the participant information changes." })}
            {field("protocol_version", "Protocol version", { def: s.protocolVersion, required: true })}
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Questionnaire windows (UK time)</legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {field("pre_closes_at", "Before: closes (also closes joining)", { type: "datetime-local", def: toZonedInputValue(s.preClosesAt), hint: "When the conference starts" })}
              {field("post_opens_at", "After: opens", { type: "datetime-local", def: toZonedInputValue(s.postOpensAt) })}
              {field("post_closes_at", "After: closes", { type: "datetime-local", def: toZonedInputValue(s.postClosesAt) })}
              {field("followup_opens_at", "Eight weeks: opens", { type: "datetime-local", def: toZonedInputValue(s.followupOpensAt), hint: "Week 7" })}
              {field("followup_closes_at", "Eight weeks: closes", { type: "datetime-local", def: toZonedInputValue(s.followupClosesAt), hint: "Week 10" })}
            </div>
          </fieldset>
          <button className={btn.primary}>Save</button>
        </form>
      </Panel>

      {profile.access.owner && (
        <Panel title="End of the study">
          <div className="flex gap-3">
            <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
            <div className="min-w-0">
              <p className="text-sm text-slate-700">
                {s.anonymisedAt
                  ? `The data were anonymised on ${formatWhen(s.anonymisedAt)}.`
                  : `After the eight-week questionnaire closes (${formatWhen(s.followupClosesAt)}), download the final data, then delete the link between study codes and accounts. The answers become anonymous and can no longer be withdrawn or deleted by person. This can't be undone.`}
              </p>
              {!s.anonymisedAt && (
                <form action={anonymiseStudy} className="mt-3 flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor="confirm" className="text-sm font-semibold text-ink">
                      Type ANONYMISE to confirm
                    </label>
                    <input id="confirm" name="confirm" autoComplete="off" className={`${inputClass} mt-1.5 w-48`} />
                  </div>
                  <button className={btn.danger} disabled={!s.followupClosesAt || new Date(s.followupClosesAt) > now}>
                    Anonymise the data
                  </button>
                </form>
              )}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
