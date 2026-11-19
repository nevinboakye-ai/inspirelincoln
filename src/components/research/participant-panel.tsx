"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateResearchConsent, withdrawResearch } from "@/app/portal/research/actions";
import { cn } from "@/lib/cn";

const OPTIONAL = [
  { key: "contact", label: "Email me reminders when the next questionnaire opens" },
  { key: "linkage", label: "Link whether I checked in on the day to my study code" },
  { key: "sharing", label: "Allow my fully anonymised answers in a research data repository" },
] as const;

/** A participant's optional consent choices, and stopping. */
export function ParticipantPanel({ consent, canDelete }: { consent: { contact: boolean; linkage: boolean; sharing: boolean }; canDelete: boolean }) {
  const router = useRouter();
  const [choices, setChoices] = useState(consent);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [stopping, setStopping] = useState(false);
  const [deleteAnswers, setDeleteAnswers] = useState(false);
  const [withdrawing, startWithdraw] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (k: keyof typeof choices) => {
    const next = { ...choices, [k]: !choices[k] };
    setChoices(next);
    setMsg(null);
    startSaving(async () => {
      const r = await updateResearchConsent(next);
      if (!r.ok) {
        setChoices(choices);
        setMsg(r.error ?? "We couldn't save that.");
      } else setMsg("Saved.");
    });
  };

  const withdraw = () =>
    startWithdraw(async () => {
      setError(null);
      const r = await withdrawResearch({ deleteAnswers });
      if (!r.ok) return setError(r.error ?? "We couldn't do that. Please try again.");
      router.push("/portal/research?withdrawn=1");
      router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="choices-h" className="app-card p-4 sm:p-5">
        <h2 id="choices-h" className="font-display text-lg text-ink">
          Your choices
        </h2>
        <ul className="mt-3 space-y-2">
          {OPTIONAL.map((o) => (
            <li key={o.key}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" checked={choices[o.key]} onChange={() => toggle(o.key)} disabled={saving} className="size-4 shrink-0 accent-[var(--color-navy)]" />
                {o.label}
              </label>
            </li>
          ))}
        </ul>
        <p role="status" aria-live="polite" className="mt-1 min-h-5 text-xs text-slate">
          {saving ? "Saving..." : msg}
        </p>
      </section>

      <section aria-labelledby="stop-h" className="app-card p-4 sm:p-5">
        <h2 id="stop-h" className="font-display text-lg text-ink">
          Stop taking part
        </h2>
        <p className="mt-1 text-sm text-slate-700">You can stop at any time without giving a reason. Nothing else about your place changes.</p>
        {!stopping ? (
          <button type="button" onClick={() => setStopping(true)} className="tap mt-3 inline-flex min-h-11 items-center rounded-full border border-navy/20 px-4 font-ui text-sm font-semibold text-ink">
            Stop taking part
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink">What should happen to the answers you&apos;ve already given?</legend>
              <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm", !deleteAnswers ? "border-navy" : "border-navy/12")}>
                <input type="radio" name="withdraw" checked={!deleteAnswers} onChange={() => setDeleteAnswers(false)} className="mt-0.5 size-4 accent-[var(--color-navy)]" />
                Keep them in the study, but don&apos;t contact me again
              </label>
              <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm", deleteAnswers ? "border-navy" : "border-navy/12", !canDelete && "opacity-50")}>
                <input type="radio" name="withdraw" checked={deleteAnswers} disabled={!canDelete} onChange={() => setDeleteAnswers(true)} className="mt-0.5 size-4 accent-[var(--color-navy)]" />
                <span>
                  Delete all my answers
                  {!canDelete && <span className="block text-xs text-slate">Not possible now: the answers have been anonymised, so we can&apos;t tell which are yours.</span>}
                </span>
              </label>
            </fieldset>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={withdraw} disabled={withdrawing} className="tap inline-flex min-h-11 items-center gap-2 rounded-full bg-danger px-4 font-ui text-sm font-semibold text-white">
                {withdrawing && <Loader2 aria-hidden className="size-4 animate-spin" />} Confirm: stop taking part
              </button>
              <button type="button" onClick={() => setStopping(false)} className="tap inline-flex min-h-11 items-center rounded-full px-4 font-ui text-sm font-semibold text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
