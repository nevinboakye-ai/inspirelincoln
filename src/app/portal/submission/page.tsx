import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEdition } from "@/lib/data/content";
import { formatEventDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { SubmissionUpload } from "@/components/portal/submission-upload";
import { FeedbackThread } from "@/components/portal/submission-ui";
import { ACCOUNT_STATUS_LABEL, SUBMISSION_FILES, SUBMISSION_LABEL, SUBMISSION_STATUS_LABEL, submissionKindFor } from "@/lib/accounts";
import type { SubmissionStatus } from "@/lib/types";

export const metadata: Metadata = { title: "My submission" };
export const dynamic = "force-dynamic";

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

export default async function SubmissionPage() {
  const { db, user, profile } = await requireUser("/portal/submission");
  const kind = submissionKindFor(profile.accountType);

  if (!kind) {
    return (
      <div className="rounded-xl border border-navy/10 bg-white p-6 sm:p-8">
        <h1 className="font-display text-2xl text-ink">Submissions are for presenters</h1>
        <p className="mt-3 text-slate-700">Oral and poster presenters upload their slides or poster here. Your account is set up for attending.</p>
        <p className="mt-3 text-slate-700">If you&apos;ve been accepted to present, <Link href="/contact" className="font-medium text-electric-600 underline underline-offset-4">tell the committee</Link> and they&apos;ll update your account.</p>
      </div>
    );
  }

  const edition = await getEdition();
  const label = SUBMISSION_LABEL[kind];
  const { data: subs } = await db
    .from("presentation_submissions")
    .select("id, version, title, status, file_name, created_at, presenter_note")
    .eq("user_id", user.id)
    .eq("kind", kind)
    .order("version", { ascending: false });
  const latest = subs?.[0];
  const { data: feedback } = subs?.length
    ? await db.from("submission_feedback").select("id, author_name, decision, body, created_at, submission_id").in("submission_id", subs.map((s) => s.id)).order("created_at")
    : { data: [] };
  const versionOf = new Map((subs ?? []).map((s) => [s.id, s.version]));
  const approved = profile.accountStatus === "approved";
  const st = latest ? SUBMISSION_STATUS_LABEL[latest.status as SubmissionStatus] : null;
  const deadline = kind === "poster" ? edition.posterDeadline : null;

  return (
    <div className="space-y-6">
      <header className="rounded-xl bg-navy p-6 text-paper sm:p-8">
        <p className="eyebrow text-cyan">{kind === "slides" ? "Oral presentation" : "Poster presentation"}</p>
        <h1 className="mt-3 font-display text-3xl">{latest ? latest.title : `Your ${label.noun}`}</h1>
        <p className="mt-3 max-w-2xl text-paper/75">
          {kind === "slides"
            ? "Upload your slides so the committee can check them and load them before your talk. You can upload a new version at any time."
            : "Upload your poster for the committee to review. They'll send feedback here, and you can upload a new version until it's approved."}
        </p>
        {st && <p className="mt-4"><Badge tone={st.tone} className="!bg-white !text-ink">{st.label}</Badge></p>}
      </header>

      {!approved && (
        <div className="rounded-xl border border-navy/10 bg-white p-6">
          <p className="font-semibold text-ink">Your account is {ACCOUNT_STATUS_LABEL[profile.accountStatus].label.toLowerCase()}.</p>
          <p className="mt-2 text-sm text-slate-700">Uploads open as soon as the executive committee approves your account. We&apos;ll email you when that happens.</p>
        </div>
      )}

      {approved && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-xl border border-navy/10 bg-white p-6 sm:p-7">
            <h2 className="font-display text-xl text-ink">{latest ? (latest.status === "approved" ? "Need to make a late change?" : "Upload a new version") : `Submit your ${label.noun}`}</h2>
            <ul className="mb-6 mt-3 space-y-1 text-sm text-slate-700">
              <li>{SUBMISSION_FILES[kind].label}, up to {SUBMISSION_FILES[kind].maxMb} MB.</li>
              {kind === "slides" && <li>Please use 16:9 slides and embed any videos. A PDF copy is a safe backup.</li>}
              {kind === "poster" && edition.posterRequirements.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
              {deadline && <li><strong className="text-ink">Deadline:</strong> {formatEventDate(deadline)}</li>}
            </ul>
            <SubmissionUpload kind={kind} userId={user.id} defaultTitle={latest?.title ?? profile.presentationTitle ?? ""} isUpdate={Boolean(latest)} />
          </section>
          <section className="rounded-xl border border-navy/10 bg-white p-6 sm:p-7">
            <h2 className="font-display text-xl text-ink">Committee feedback</h2>
            <div className="mt-4">
              <FeedbackThread items={(feedback ?? []).map((f) => ({ ...f, version: versionOf.get(f.submission_id) ?? null }))} empty={latest ? "No feedback yet. We'll email you when there is." : "Feedback will appear here once you've submitted."} />
            </div>
            {(subs?.length ?? 0) > 0 && (
              <>
                <h3 className="mt-8 font-ui text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate">Your uploads</h3>
                <ul className="mt-2 divide-y divide-navy/10 text-sm">
                  {subs!.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 py-3">
                      <FileText aria-hidden className="size-4 shrink-0 text-slate" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink">Version {s.version}: {s.file_name}</span>
                        <span className="block text-xs text-slate">{when(s.created_at)}</span>
                      </span>
                      <Badge tone={SUBMISSION_STATUS_LABEL[s.status as SubmissionStatus].tone}>{SUBMISSION_STATUS_LABEL[s.status as SubmissionStatus].label}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
