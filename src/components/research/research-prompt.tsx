"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, FlaskConical, X } from "lucide-react";
import { researchLater } from "@/app/portal/research/actions";

/**
 * The research invitation, put in front of invited people in My Hub until
 * they answer it on the Research study page (take part, or the small opt-out
 * there). Closing it or "Remind me later" brings it back after a few hours,
 * and it stays as a pending task in the hub checklist. Once someone is taking part, the same card tells
 * them when a questionnaire is open.
 */
export function ResearchPrompt({
  mode,
  closes,
  stageTitle,
  minutes,
  href,
  onHub = false,
}: {
  mode: "invite" | "due";
  closes: string;
  stageTitle?: string;
  minutes?: number;
  href: string;
  /** My Hub already shows this task (after the conference), so don't pop up there. */
  onHub?: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(true);
  const titleId = useId();
  const descId = useId();
  // The post-conference hub has the study on it already.
  const here = path.startsWith("/portal/research") || path.startsWith("/portal/after") || (onHub && path === "/portal");

  useEffect(() => {
    const d = dialog.current;
    if (!here && open && d && !d.open) d.showModal();
  }, [open, here]);

  if (here || !open) return null;

  const close = () => {
    setOpen(false);
    dialog.current?.close();
  };
  const later = () => {
    close();
    void researchLater();
  };
  const go = () => {
    close();
    router.push(href);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault();
        later();
      }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-0 text-ink shadow-[0_40px_90px_-30px_rgba(12,24,44,0.7)] backdrop:bg-midnight/60 backdrop:backdrop-blur-[2px] open:animate-[enter-pop_0.45s_var(--ease-out-expo)] motion-reduce:open:animate-none"
    >
      <div className="relative overflow-hidden bg-midnight px-6 pb-6 pt-7 text-paper sm:px-7">
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
        <button type="button" onClick={later} className="absolute right-3 top-3 grid size-11 place-items-center rounded-full text-paper/70 hover:bg-white/10 hover:text-paper focus-visible:outline-2 focus-visible:outline-gold" aria-label="Remind me later">
          <X aria-hidden className="size-5" />
        </button>
        <span className="relative grid size-12 place-items-center rounded-xl bg-cyan/15 text-cyan">
          <FlaskConical aria-hidden className="size-6" />
        </span>
        <p className="eyebrow relative mt-4 text-cyan">Research study · not conference feedback</p>
        <h2 id={titleId} className="relative mt-1 font-display text-2xl leading-tight">
          {mode === "invite" ? "Before the conference: your research study task" : `${stageTitle}: your questionnaire is open`}
        </h2>
      </div>
      <div className="px-6 py-6 sm:px-7">
        <div id={descId} className="space-y-2 text-sm text-slate-700">
          {mode === "invite" ? (
            <>
              <p>We&apos;re studying whether student-led research conferences change students&apos; research confidence and what they go on to do. It&apos;s three short questionnaires: before the conference, just after and eight weeks later.</p>
              <p>
                <strong className="text-ink">Please complete it by {closes}.</strong> It takes about 5 minutes. Your answers are confidential and make no difference to your place, presentation, prizes or certificate.
              </p>
            </>
          ) : (
            <p>
              It takes about {minutes} minutes and is open until {closes}. Answers from everyone, including people who haven&apos;t done much research yet, are what make the study work.
            </p>
          )}
        </div>
        <div className="mt-5 grid gap-2">
          <button type="button" onClick={go} className="tap inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-navy px-5 font-ui text-sm font-semibold text-paper">
            {mode === "invite" ? "Start the research study" : "Start now"} <ArrowRight aria-hidden className="size-4" />
          </button>
          <button type="button" onClick={later} className="tap inline-flex min-h-11 items-center justify-center rounded-full px-5 font-ui text-sm font-semibold text-slate-700">
            Remind me later
          </button>
        </div>
      </div>
    </dialog>
  );
}
