import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, CircleDashed, FlaskConical, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Notice } from "@/components/ui/notice";
import { ConsentForm } from "@/components/research/consent-form";
import { ParticipantPanel } from "@/components/research/participant-panel";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/research/instrument";
import { STUDY_TITLE, consentStatements, participantInformation } from "@/lib/research/content";
import { formatWhen, isOpen, windowOf } from "@/lib/research/schedule";
import { getMyResearch } from "@/lib/research/server";

export const metadata: Metadata = { title: "Research study", robots: { index: false } };
export const dynamic = "force-dynamic";

const btn = "tap inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 font-ui text-sm font-semibold";

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ preview?: string; done?: string; joined?: string; declined?: string; withdrawn?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireUser("/portal/research");
  const r = await getMyResearch(db, profile);
  const s = r.settings;
  const preview = Boolean(sp.preview) && r.canPreview;
  const running = r.ready && s.enabled;

  const header = (
    <header className="relative overflow-hidden rounded-2xl bg-midnight p-6 text-paper sm:p-8">
      <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-15" />
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-cyan/20 blur-3xl" />
      <p className="eyebrow relative flex items-center gap-2 text-cyan">
        <FlaskConical aria-hidden className="size-4" /> Research study · separate from conference feedback
      </p>
      <h1 className="relative mt-2 max-w-3xl font-display text-2xl leading-tight sm:text-3xl">{STUDY_TITLE}</h1>
      <p className="relative mt-2 max-w-2xl text-paper/75">
        Three short questionnaires: before the conference, just after it and eight weeks later. Voluntary, and nothing about your place depends on it.
      </p>
    </header>
  );
  const back = (
    <Link href="/portal" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-ink">
      <ArrowLeft aria-hidden className="size-4" /> My Hub
    </Link>
  );
  const info = (open = false) => (
    <section aria-labelledby="pis-h" className="app-card p-4 sm:p-6">
      <h2 id="pis-h" className="font-display text-xl text-ink">
        Participant information <span className="font-ui text-xs font-semibold text-slate">version {s.infoVersion}</span>
      </h2>
      <div className="mt-3 divide-y divide-navy/10">
        {participantInformation(s).map((sec, i) => (
          <details key={sec.heading} open={open || i < 3} className="group py-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink">
              {sec.heading}
              <span aria-hidden className="text-slate transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="space-y-2 pb-1 text-sm leading-relaxed text-slate-700">
              {sec.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );

  // The research team can look at everything before the study starts.
  if (preview && (!running || !r.eligible)) {
    return (
      <div className="space-y-5">
        {back}
        <Notice tone="warning" title="Preview">
          This is what delegates will see. {running ? "You aren't invited yourself" : "The study is switched off"}, so nothing here is saved. Open the questionnaires:{" "}
          {STAGES.map((st, i) => (
            <span key={st}>
              {i > 0 && " · "}
              <Link className="font-semibold underline" href={`/portal/research/${st}?preview=1`}>
                {STAGE_LABEL[st].title.toLowerCase()}
              </Link>
            </span>
          ))}
        </Notice>
        {header}
        {info()}
        <ConsentForm statements={consentStatements(s)} preview />
      </div>
    );
  }

  if (!running || !r.eligible) {
    return (
      <div className="space-y-5">
        {back}
        {header}
        <section className="app-card p-6">
          <p className="text-slate-700">{running ? "This study is for delegates and presenters, so there's nothing for you to do here." : "There's no research study running at the moment."}</p>
          {r.canPreview && (
            <Link href="/portal/research?preview=1" className={`${btn} mt-4 bg-navy text-paper`}>
              Preview the study <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </section>
      </div>
    );
  }

  const notices = (
    <>
      {sp.joined && <Notice title="Thank you for taking part">Your study code is {r.code}. You can start the first questionnaire now.</Notice>}
      {sp.done && STAGES.includes(sp.done as Stage) && <Notice title="Answers saved">Thank you. {r.next ? `The next questionnaire opens ${formatWhen(r.next.opens)}.` : ""}</Notice>}
      {sp.declined && <Notice title="No problem">You won&apos;t be asked again. Nothing else about your place changes.</Notice>}
    </>
  );

  if (r.withdrawn) {
    return (
      <div className="space-y-5">
        {back}
        {header}
        {sp.withdrawn && <Notice title="You've stopped taking part">Thank you for your time. We won&apos;t contact you about the study again.</Notice>}
        <section className="app-card p-6 text-slate-700">
          You have stopped taking part in the study.{" "}
          {r.withdrawal === "delete" ? "Your answers have been deleted." : "The answers you gave before stopping stay in the study, stored under your study code only."}
        </section>
      </div>
    );
  }

  if (r.decision !== "consented") {
    return (
      <div className="space-y-5">
        {back}
        {notices}
        {header}
        {r.decision === "declined" && !r.canJoin ? (
          <section className="app-card p-6 text-slate-700">You chose not to take part. Thank you for considering it.</section>
        ) : !r.canJoin ? (
          <section className="app-card p-6 text-slate-700">The study closed to new participants when the conference began, so everyone who takes part has answered the first questionnaire beforehand. Thank you for your interest.</section>
        ) : (
          <>
            {r.decision === "declined" && (
              <Notice>You said no thanks. If you change your mind, you can join until {formatWhen(s.preClosesAt)}.</Notice>
            )}
            {info()}
            <ConsentForm statements={consentStatements(s)} declinedBefore={r.decision === "declined"} />
          </>
        )}
      </div>
    );
  }

  // Taking part.
  const now = new Date();
  return (
    <div className="space-y-5">
      {back}
      {notices}
      {header}
      <section aria-labelledby="stages-h" className="app-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="stages-h" className="font-display text-xl text-ink">
            Your questionnaires
          </h2>
          <p className="flex items-center gap-1.5 rounded-full bg-paper-200 px-3 py-1 font-ui text-sm font-semibold text-ink">
            <Lock aria-hidden className="size-3.5" /> Study code {r.code}
          </p>
        </div>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {STAGES.map((st) => {
            const done = r.done.includes(st);
            const due = r.due === st;
            const w = windowOf(s, st);
            const closed = !done && !isOpen(s, st, now) && w.closes && new Date(w.closes) < now;
            return (
              <li key={st} className={`rounded-xl border p-4 ${due ? "border-gold bg-gold/[0.06]" : "border-navy/10"}`}>
                <p className="eyebrow text-slate">{STAGE_LABEL[st].short}</p>
                <p className="mt-1 font-semibold text-ink">{STAGE_LABEL[st].title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                  {done ? (
                    <>
                      <CheckCircle2 aria-hidden className="size-4 text-success" /> Done, thank you
                    </>
                  ) : due ? (
                    <>
                      <CalendarClock aria-hidden className="size-4 text-gold-700" /> Open until {formatWhen(w.closes)}
                    </>
                  ) : closed ? (
                    <>
                      <CircleDashed aria-hidden className="size-4" /> Closed
                    </>
                  ) : (
                    <>
                      <CircleDashed aria-hidden className="size-4" /> Opens {formatWhen(w.opens)}
                    </>
                  )}
                </p>
                {due && (
                  <Link href={`/portal/research/${st}`} className={`${btn} mt-3 w-full bg-navy text-paper`}>
                    Start, about {STAGE_LABEL[st].minutes} minutes <ArrowRight aria-hidden className="size-4" />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </section>
      <ParticipantPanel consent={r.consent} canDelete={!s.anonymisedAt} />
      {info()}
    </div>
  );
}
