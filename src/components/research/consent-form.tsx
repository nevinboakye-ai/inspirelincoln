"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { decideResearch } from "@/app/portal/research/actions";
import type { ConsentStatement } from "@/lib/research/content";
import { cn } from "@/lib/cn";

/**
 * The consent form: each required statement ticked separately (as an
 * ethics committee expects), the optional ones clearly marked, and saying
 * no is one tap and just as prominent.
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
    if (decision === "consented" && !allRequired) return setError("To take part, please tick each of the statements marked required.");
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
    <section aria-labelledby="consent-h" className="app-card p-4 sm:p-6">
      <h2 id="consent-h" className="font-display text-xl text-ink">
        Consent
      </h2>
      <p className="mt-1 text-sm text-slate-700">Tick each statement you agree with. The first five are needed to take part.</p>
      <ul className="mt-4 space-y-2">
        {statements.map((s) => (
          <li key={s.id}>
            <label className={cn("tap flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm", ticked[s.id] ? "border-navy bg-navy/[0.04] text-ink" : "border-navy/12 text-slate-700")}>
              <input type="checkbox" checked={Boolean(ticked[s.id])} onChange={(e) => setTicked((t) => ({ ...t, [s.id]: e.target.checked }))} className="mt-0.5 size-4 shrink-0 accent-[var(--color-navy)]" />
              <span>
                {s.text}
                {s.required && <span className="ml-1.5 rounded bg-paper-200 px-1.5 py-0.5 font-ui text-[0.65rem] font-semibold uppercase tracking-wider text-slate">Required</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="mt-5 grid gap-2">
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
