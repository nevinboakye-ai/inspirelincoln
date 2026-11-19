"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { decideResearch } from "@/app/portal/research/actions";
import type { ConsentStatement } from "@/lib/research/content";
import { cn } from "@/lib/cn";

/**
 * The consent form: the required statements listed, agreed to with one
 * tick (as is usual for online surveys), the optional ones ticked
 * separately, and a small opt-out link.
 */
export function ConsentForm({ statements, preview = false, declinedBefore = false }: { statements: ConsentStatement[]; preview?: boolean; declinedBefore?: boolean }) {
  const router = useRouter();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<"consented" | "declined" | null>(null);
  const required = statements.filter((s) => s.required);
  const allRequired = required.every((s) => ticked[s.id]);

  const decide = (decision: "consented" | "declined") => {
    setError(null);
    if (preview) return setError("This is a preview, so nothing was saved.");
    if (decision === "consented" && !allRequired) return setError("To take part, please tick \"I agree to all of the statements above\".");
    setChoice(decision);
    start(async () => {
      const r = await decideResearch({ decision, consent: decision === "consented" ? ticked : undefined });
      if (!r.ok) {
        setError(r.error ?? "We couldn't save that. Please try again.");
        return;
      }
      router.push(decision === "consented" ? "/portal/research?joined=1" : "/portal/research?declined=1");
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="consent-h" className="app-card border-t-4 border-t-teal px-4 py-4 sm:px-6">
      <h2 id="consent-h" className="font-display text-lg text-ink">
        Take part
      </h2>
      <ul className="mt-2 space-y-1 text-[0.85rem] leading-snug text-slate-700">
        {required.map((s) => (
          <li key={s.id} className="flex gap-2">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-teal" />
            <span>{s.text}</span>
          </li>
        ))}
      </ul>
      <label className={cn("tap mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-sm font-semibold", allRequired ? "border-teal bg-teal-100 text-ink" : "border-navy/15 text-ink")}>
        <input
          type="checkbox"
          checked={allRequired}
          onChange={(e) => setTicked((t) => ({ ...t, ...Object.fromEntries(required.map((s) => [s.id, e.target.checked])) }))}
          className="size-5 shrink-0 accent-[var(--color-teal)]"
        />
        I agree to all of the statements above
      </label>
      <p className="mt-3 font-ui text-[0.7rem] font-semibold uppercase tracking-wider text-slate">Optional</p>
      <ul className="mt-1.5 space-y-1.5">
        {statements
          .filter((s) => !s.required)
          .map((s) => (
            <li key={s.id}>
              <label className={cn("tap flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border-2 px-3 py-2 text-[0.8rem] leading-snug", ticked[s.id] ? "border-sky bg-sky-100 text-ink" : "border-navy/10 text-slate-700")}>
                <input type="checkbox" checked={Boolean(ticked[s.id])} onChange={(e) => setTicked((t) => ({ ...t, [s.id]: e.target.checked }))} className="mt-0.5 size-4 shrink-0 accent-[var(--color-sky)]" />
                <span>{s.text.replace(/^Optional: /, "")}</span>
              </label>
            </li>
          ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={() => decide("consented")}
          disabled={pending}
          aria-disabled={!allRequired}
          className={cn("tap inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 font-ui text-sm font-semibold", allRequired ? "bg-navy text-paper" : "bg-navy/40 text-paper")}
        >
          {pending && choice === "consented" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
          Take part
        </button>
      </div>
      {!declinedBefore && (
        <p className="mt-4 text-xs text-slate">
          Privacy: taking part is voluntary and nothing else about your place changes if you don&apos;t.{" "}
          <button type="button" onClick={() => decide("declined")} disabled={pending} className="inline-flex min-h-6 items-center gap-1 underline underline-offset-2 hover:text-ink">
            {pending && choice === "declined" && <Loader2 aria-hidden className="size-3 animate-spin" />}
            Opt out of the study
          </button>
        </p>
      )}
    </section>
  );
}
