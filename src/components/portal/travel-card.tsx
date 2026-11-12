"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Bus, Car, Check, Home, Loader2, Pencil, TrainFront } from "lucide-react";
import { saveTravel } from "@/app/portal/actions";
import { submitWithoutReset } from "@/lib/use-action-form";
import { TRAVEL_LABEL, TRAVEL_MODES, type TravelAnswer, type TravelMode } from "@/lib/travel";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";

const ICON: Record<TravelMode, typeof Bus> = { inspire_coach: Bus, external_coach: Bus, train: TrainFront, car: Car, local: Home };

const when = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

/**
 * "How are you getting to INSPIRE?" on My Hub. Drivers also give their car
 * registration. The committee sees every answer on the Travel page.
 */
export function TravelCard({ answer }: { answer: TravelAnswer }) {
  const [state, action, pending] = useActionState(saveTravel, null);
  const [editing, setEditing] = useState(!answer);
  const [mode, setMode] = useState<TravelMode | null>(answer?.mode ?? null);
  const heading = useRef<HTMLHeadingElement>(null);
  const regRef = useRef<HTMLInputElement>(null);
  const [moved, setMoved] = useState(false);
  const [seen, setSeen] = useState(state);

  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      setEditing(false);
      setMoved(true);
    }
  }

  // Move focus with the content, but never on page load.
  useEffect(() => {
    if (!moved) return;
    if (editing && mode === "car") regRef.current?.focus();
    else heading.current?.focus();
    // Only when switching between showing and changing the answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, moved]);

  const shown = !editing && answer;
  const Icon = shown ? ICON[answer.mode] : Bus;
  const err = state?.fieldErrors ?? {};

  return (
    <section
      id="travel"
      aria-labelledby="travel-h"
      className={cn(
        "relative scroll-mt-28 overflow-hidden rounded-xl border",
        shown ? "p-3 pr-2 sm:p-4" : "p-4 sm:p-5",
        shown ? "border-navy/10 bg-white" : "border-gold/50 bg-white shadow-[0_18px_40px_-28px_rgba(14,27,49,0.55)]",
      )}
    >
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
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-navy text-paper">
            <Icon aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate">Getting here</p>
            <h2 id="travel-h" ref={heading} tabIndex={-1} className="scroll-mt-32 font-ui text-base font-semibold leading-snug text-ink outline-none">
              <span className="sr-only">Getting here: </span>
              {TRAVEL_LABEL[answer.mode].label}
            </h2>
            {answer.carRegistration && (
              <p className="mt-1 inline-flex items-center rounded-[3px] border-2 border-ink bg-[#ffd307] px-2 py-0.5 font-ui text-sm font-bold tracking-[0.12em] text-ink">
                <span className="sr-only">Car registration: </span>
                {answer.carRegistration}
              </p>
            )}
            <p className="sr-only">Answered {when(answer.updatedAt)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMoved(true);
              setEditing(true);
            }}
            title={`Answered ${when(answer.updatedAt)}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-ui text-sm font-semibold text-electric-600 hover:bg-paper-200"
          >
            <Pencil aria-hidden className="size-4" /> <span className="lg:sr-only">Change</span><span className="sr-only"> how you&apos;re getting here</span>
          </button>
        </div>
      ) : (
        <form onSubmit={submitWithoutReset(action)} noValidate>
          <p className="eyebrow text-[#7a4a00]">{answer ? "Change your answer" : "Please reply"}</p>
          <h2 id="travel-h" ref={heading} tabIndex={-1} className="mt-1 font-display text-xl leading-tight text-ink outline-none">
            How are you getting to INSPIRE?
          </h2>
          <fieldset className="mt-3" aria-describedby={err.mode ? "travel-mode-error" : undefined}>
            <legend className="sr-only">How you&apos;re travelling</legend>
            <div className="grid grid-cols-2 gap-2">
              {TRAVEL_MODES.map((m) => {
                const I = ICON[m];
                return (
                  <label
                    key={m}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[3px] border px-3 py-2 transition-colors last:col-span-2 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-electric/20",
                      mode === m ? "border-navy bg-navy/[0.04] ring-1 ring-navy" : "border-navy/15 hover:border-navy/40",
                    )}
                  >
                    <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
                    <I aria-hidden className={cn("hidden size-5 shrink-0 sm:block", mode === m ? "text-navy" : "text-slate")} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-snug text-ink">{TRAVEL_LABEL[m].label}</span>
                      <span className={cn("text-xs leading-snug text-slate-700", m.endsWith("coach") ? "block" : "hidden sm:block")}>{TRAVEL_LABEL[m].hint}</span>
                    </span>
                    <span
                      aria-hidden
                      className={cn("hidden size-5 shrink-0 place-items-center rounded-full border-2 sm:grid", mode === m ? "border-navy bg-navy text-paper" : "border-navy/25")}
                    >
                      {mode === m && <Check className="size-3" />}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {err.mode && (
            <p id="travel-mode-error" className="mt-2 text-sm font-medium text-danger">
              {err.mode}
            </p>
          )}

          {mode === "car" && (
            <div className="mt-3 rounded-lg border border-navy/10 bg-paper p-3 sm:p-4">
              <label htmlFor="travel-reg" className="block text-sm font-semibold text-ink">
                Car registration <span className="text-danger">*</span>
              </label>
              <p id="travel-reg-hint" className="mb-2 mt-0.5 text-sm text-slate">
                So we can arrange parking on campus. Only the committee will see it.
              </p>
              <input
                id="travel-reg"
                ref={regRef}
                name="carRegistration"
                defaultValue={answer?.carRegistration ?? ""}
                maxLength={12}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="AB12 CDE"
                aria-invalid={Boolean(err.carRegistration)}
                aria-describedby={err.carRegistration ? "travel-reg-hint travel-reg-error" : "travel-reg-hint"}
                className={cn(inputClass, "max-w-xs font-ui uppercase tracking-[0.1em]")}
              />
              {err.carRegistration && (
                <p id="travel-reg-error" className="mt-2 text-sm font-medium text-danger">
                  {err.carRegistration}
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-navy px-5 font-ui text-sm font-semibold text-paper transition-colors hover:bg-navy-700 disabled:opacity-60 sm:w-auto"
            >
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
              Save my answer
            </button>
            {answer && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setMode(answer.mode);
                  setMoved(true);
                  setEditing(false);
                }}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[3px] px-5 font-ui text-sm font-semibold text-slate-700 hover:text-ink sm:w-auto"
              >
                Keep my answer
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
