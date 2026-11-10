"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarCheck2, CalendarX2, Check, Loader2, MapPin, Pencil, X } from "lucide-react";
import { saveAttendance } from "@/app/portal/actions";
import { submitWithoutReset } from "@/lib/use-action-form";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";

export type AttendanceAnswer = { response: "confirmed" | "unavailable"; note: string | null; respondedAt: string } | null;

type Mode = "ask" | "decline" | "view";

const when = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

const btnBase =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] px-5 font-ui text-sm font-semibold transition-colors disabled:opacity-60 sm:w-auto";

/**
 * Oral and poster presenters tell the committee whether they'll be there to
 * present. The answer can be changed at any time; the committee sees it on
 * the Presenter attendance page.
 */
export function AttendanceCard({
  answer,
  kind,
  dateLabel,
  venue,
}: {
  answer: AttendanceAnswer;
  kind: "slides" | "poster";
  dateLabel: string;
  venue: string;
}) {
  const [state, action, pending] = useActionState(saveAttendance, null);
  const [mode, setMode] = useState<Mode>(answer ? "view" : "ask");
  const heading = useRef<HTMLHeadingElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  // Only move focus after someone has used the card, never on page load.
  const [moved, setMoved] = useState(false);
  const [seen, setSeen] = useState(state);
  const what = kind === "slides" ? "oral presentation" : "poster";
  const doing = kind === "slides" ? "giving your oral presentation" : "presenting your poster";

  // Once an answer is saved, show it.
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      setMode("view");
      setMoved(true);
    }
  }

  // Move focus with the content so keyboard and screen reader users aren't left behind.
  useEffect(() => {
    if (!moved) return;
    if (mode === "decline") noteRef.current?.focus();
    else heading.current?.focus();
  }, [mode, moved]);

  const go = (m: Mode) => {
    setMoved(true);
    setMode(m);
  };

  const shown = mode === "view" && answer ? answer.response : null;
  const tone =
    shown === "confirmed"
      ? "border-success/30 bg-success/[0.06]"
      : shown === "unavailable"
        ? "border-warning/35 bg-warning/[0.07]"
        : "border-gold/50 bg-white shadow-[0_18px_40px_-28px_rgba(14,27,49,0.55)]";

  return (
    <section aria-labelledby="attend-h" className={cn("relative scroll-mt-28 overflow-hidden rounded-xl border p-5 sm:p-7", tone)}>
      {!shown && <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gold" />}

      <p role="status" aria-live="polite" className="sr-only">
        {state?.ok ? state.message : ""}
      </p>
      {state?.error && (
        <p role="alert" className="mb-4 rounded-md border border-danger/25 bg-danger/[0.06] p-3 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}

      {shown ? (
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full",
              shown === "confirmed" ? "bg-success text-white" : "bg-warning/20 text-[#7a4a00]",
            )}
          >
            {shown === "confirmed" ? <CalendarCheck2 aria-hidden className="size-5" /> : <CalendarX2 aria-hidden className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="attend-h" ref={heading} tabIndex={-1} className="scroll-mt-32 font-display text-xl text-ink outline-none">
              {shown === "confirmed" ? "You're confirmed to present" : "You've told us you can't make it"}
            </h2>
            <p className="mt-1.5 text-slate-700">
              {shown === "confirmed"
                ? `Thank you. The committee knows you'll be there ${doing} on ${dateLabel}.`
                : `Thank you for letting us know. The committee may offer your ${what} slot to someone else. If your plans change, update your answer as soon as you can.`}
            </p>
            {shown === "unavailable" && answer?.note && (
              <p className="mt-3 rounded-md bg-white/70 p-3 text-sm text-ink">
                <span className="font-semibold">Your note: </span>
                {answer.note}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => go("ask")}
                className="inline-flex min-h-11 items-center gap-2 font-ui text-sm font-semibold text-electric-600 underline-offset-4 hover:underline"
              >
                <Pencil aria-hidden className="size-4" /> Change my answer
              </button>
              <span className="text-xs text-slate">Answered {when(answer!.respondedAt)}</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="eyebrow text-[#7a4a00]">{answer ? "Change your answer" : "Please reply"}</p>
          <h2 id="attend-h" ref={heading} tabIndex={-1} className="mt-2 font-display text-2xl leading-tight text-ink outline-none">
            Will you be there to present?
          </h2>
          <p className="mt-2 max-w-2xl text-slate-700">
            Let the committee know you&apos;ll be {doing} at INSPIRE. If you can&apos;t make it, telling us early means
            we can offer the slot to someone on the waiting list.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
            <span className="flex items-center gap-2">
              <CalendarCheck2 aria-hidden className="size-4 text-electric-600" /> {dateLabel}
            </span>
            <span className="flex items-center gap-2">
              <MapPin aria-hidden className="size-4 text-electric-600" /> {venue}
            </span>
          </p>

          {mode === "decline" ? (
            <form onSubmit={submitWithoutReset(action)} noValidate className="mt-5 space-y-4 rounded-lg border border-navy/10 bg-paper p-4 sm:p-5">
              <input type="hidden" name="response" value="unavailable" />
              <div>
                <label htmlFor="attend-note" className="mb-2 block text-sm font-semibold text-ink">
                  Anything you&apos;d like the committee to know? <span className="font-normal text-slate">(optional)</span>
                </label>
                <p id="attend-note-hint" className="-mt-1 mb-2 text-sm text-slate">
                  For example, if a co-author could present for you. Only the committee will see this.
                </p>
                <textarea
                  id="attend-note"
                  ref={noteRef}
                  name="note"
                  rows={3}
                  maxLength={500}
                  defaultValue={answer?.response === "unavailable" ? answer.note ?? "" : ""}
                  aria-describedby={state?.fieldErrors?.note ? "attend-note-hint attend-note-error" : "attend-note-hint"}
                  aria-invalid={Boolean(state?.fieldErrors?.note)}
                  className={inputClass}
                />
                {state?.fieldErrors?.note && (
                  <p id="attend-note-error" className="mt-2 text-sm font-medium text-danger">
                    {state.fieldErrors.note}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="submit" disabled={pending} className={cn(btnBase, "bg-danger text-white hover:bg-danger/90")}>
                  {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <X aria-hidden className="size-4" />}
                  Confirm I can&apos;t attend
                </button>
                <button
                  type="button"
                  onClick={() => go("ask")}
                  disabled={pending}
                  className={cn(btnBase, "border border-navy/15 bg-white text-ink hover:border-navy/40")}
                >
                  Go back
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitWithoutReset(action)} className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <input type="hidden" name="response" value="confirmed" />
              <button type="submit" disabled={pending} className={cn(btnBase, "bg-navy text-paper hover:bg-navy-700")}>
                {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
                Yes, I&apos;ll be there
              </button>
              <button
                type="button"
                onClick={() => go("decline")}
                disabled={pending}
                className={cn(btnBase, "border border-navy/15 bg-white text-ink hover:border-navy/40")}
              >
                I can&apos;t make it
              </button>
              {answer && (
                <button
                  type="button"
                  onClick={() => go("view")}
                  disabled={pending}
                  className={cn(btnBase, "text-slate-700 hover:text-ink sm:ml-auto")}
                >
                  Keep my answer
                </button>
              )}
            </form>
          )}
        </>
      )}
    </section>
  );
}
