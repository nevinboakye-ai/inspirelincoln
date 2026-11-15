"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Car, Check, Loader2, Pencil } from "lucide-react";
import { saveParking } from "@/app/portal/actions";
import { submitWithoutReset } from "@/lib/use-action-form";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";

/**
 * For judges, in place of "How are you getting to INSPIRE?". They're only
 * asked for a car registration, and only if they're driving, so parking can
 * be arranged on campus. It isn't on their to-do list.
 */
export function ParkingCard({ registration }: { registration: string | null }) {
  const [state, action, pending] = useActionState(saveParking, null);
  const [editing, setEditing] = useState(false);
  const [moved, setMoved] = useState(false);
  const [seen, setSeen] = useState(state);
  const heading = useRef<HTMLHeadingElement>(null);
  const regRef = useRef<HTMLInputElement>(null);

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
    if (editing) regRef.current?.focus();
    else heading.current?.focus();
  }, [editing, moved]);

  const err = state?.fieldErrors ?? {};
  const form = editing || (!registration && Boolean(err.carRegistration));

  return (
    <section id="travel" aria-labelledby="parking-h" className="scroll-mt-28 rounded-xl border border-navy/10 bg-white p-3 pr-2 sm:p-4">
      <p role="status" aria-live="polite" className="sr-only">
        {state?.ok ? state.message : ""}
      </p>
      {state?.error && (
        <p role="alert" className="mb-3 rounded-md border border-danger/25 bg-danger/[0.06] p-3 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      {!form ? (
        <div className="flex items-center gap-3">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", registration ? "bg-navy text-paper" : "bg-paper-200 text-navy")}>
            <Car aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate">Parking</p>
            <h2 id="parking-h" ref={heading} tabIndex={-1} className="font-ui text-base font-semibold leading-snug text-ink outline-none">
              {registration ? (
                <span className="inline-flex items-center rounded-[3px] border-2 border-ink bg-[#ffd307] px-2 py-0.5 text-sm font-bold tracking-[0.12em]">
                  <span className="sr-only">Your car registration: </span>
                  {registration}
                </span>
              ) : (
                "Driving to INSPIRE?"
              )}
            </h2>
            {!registration && <p className="text-sm leading-snug text-slate-700">Add your car registration and we&apos;ll arrange parking.</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              setMoved(true);
              setEditing(true);
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-ui text-sm font-semibold text-electric-600 hover:bg-paper-200"
          >
            {registration ? <Pencil aria-hidden className="size-4" /> : <Car aria-hidden className="size-4" />}
            {registration ? "Change" : "Add"}
            <span className="sr-only"> your car registration</span>
          </button>
        </div>
      ) : (
        <form onSubmit={submitWithoutReset(action)} noValidate className="pr-1">
          <h2 id="parking-h" ref={heading} tabIndex={-1} className="font-display text-xl leading-tight text-ink outline-none">
            Your car registration
          </h2>
          <p id="parking-hint" className="mt-1 text-sm text-slate-700">
            So we can arrange parking on campus. Only the committee will see it.
          </p>
          <input
            id="parking-reg"
            ref={regRef}
            name="carRegistration"
            aria-labelledby="parking-h"
            defaultValue={registration ?? ""}
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="AB12 CDE"
            aria-invalid={Boolean(err.carRegistration)}
            aria-describedby={err.carRegistration ? "parking-hint parking-error" : "parking-hint"}
            className={cn(inputClass, "mt-3 max-w-xs font-ui uppercase tracking-[0.1em]")}
          />
          {err.carRegistration && (
            <p id="parking-error" className="mt-2 text-sm font-medium text-danger">
              {err.carRegistration}
            </p>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              name="driving"
              value="yes"
              disabled={pending}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-navy px-5 font-ui text-sm font-semibold text-paper transition-colors hover:bg-navy-700 disabled:opacity-60 sm:w-auto"
            >
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
              Save
            </button>
            {registration ? (
              <button
                type="submit"
                name="driving"
                value="no"
                disabled={pending}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[3px] px-5 font-ui text-sm font-semibold text-slate-700 hover:text-ink sm:w-auto"
              >
                I&apos;m not driving now
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setMoved(true);
                  setEditing(false);
                }}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[3px] px-5 font-ui text-sm font-semibold text-slate-700 hover:text-ink sm:w-auto"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
