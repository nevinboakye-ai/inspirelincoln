"use client";
import { submitWithoutReset } from "@/lib/use-action-form";
import { useActionState, useState } from "react";
import { Loader2, Save, Send } from "lucide-react";
import { saveReview } from "@/app/review/actions";
import { Field, inputClass } from "@/components/forms/field";
import { ResultBanner } from "@/components/portal/profile-forms";
import { cn } from "@/lib/cn";

export interface Criterion { id: string; label: string; description: string; maxScore: number; weight: number }

export function ReviewForm({
  assignmentId,
  criteria,
  initial,
  locked,
}: {
  assignmentId: string;
  criteria: Criterion[];
  initial: { scores: Record<string, number>; comments: string; confidentialComments: string; recommendation: string };
  locked: boolean;
}) {
  const [state, action, pending] = useActionState(saveReview, null);
  const [scores, setScores] = useState<Record<string, number | undefined>>(initial.scores);
  const isLocked = locked || (state?.ok && state.message?.startsWith("Review submitted"));
  const fe = (k: string) => state?.fieldErrors?.[k];
  const totalW = criteria.reduce((n, c) => n + c.weight, 0);
  const weighted = criteria.every((c) => scores[c.id] !== undefined) && totalW > 0
    ? (criteria.reduce((n, c) => n + ((scores[c.id] ?? 0) / c.maxScore) * c.weight, 0) / totalW) * 100
    : null;

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-8">
      <ResultBanner state={state} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <fieldset disabled={Boolean(isLocked)} className="space-y-8 disabled:opacity-80">
        <div className="space-y-6">
          {criteria.map((c) => (
            <fieldset key={c.id}>
              <legend className="font-semibold text-ink">{c.label} <span className="font-normal text-slate">(0–{c.maxScore}{c.weight !== 1 ? `, weight ${c.weight}` : ""})</span></legend>
              {c.description && <p className="mt-1 text-sm text-slate-700">{c.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={c.label}>
                {Array.from({ length: c.maxScore + 1 }, (_, n) => (
                  <label key={n} className={cn("flex size-11 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-electric", scores[c.id] === n ? "border-navy bg-navy text-paper" : "border-navy/15 bg-white text-ink hover:border-navy/40")}>
                    <input type="radio" className="sr-only" name={`score_${c.id}`} value={n} checked={scores[c.id] === n} onChange={() => setScores((s) => ({ ...s, [c.id]: n }))} />
                    {n}
                  </label>
                ))}
              </div>
              {fe(`score_${c.id}`) && <p className="mt-1 text-sm font-medium text-danger">{fe(`score_${c.id}`)}</p>}
            </fieldset>
          ))}
          <p className="rounded-md bg-paper p-4 text-sm text-slate-700" aria-live="polite">
            Weighted score: <strong className="text-ink">{weighted === null ? "complete all criteria" : `${weighted.toFixed(0)} / 100`}</strong>
          </p>
        </div>
        <Field id="comments" label="Comments for the author" hint="May be shared with the author with the decision." error={fe("comments")}>
          <textarea id="comments" name="comments" rows={5} defaultValue={initial.comments} className={inputClass} />
        </Field>
        <Field id="confidentialComments" label="Confidential comments for the committee" hint="Only visible to the conference team." error={fe("confidentialComments")}>
          <textarea id="confidentialComments" name="confidentialComments" rows={3} defaultValue={initial.confidentialComments} className={inputClass} />
        </Field>
        <Field id="recommendation" label="Recommendation" required error={fe("recommendation")}>
          <select id="recommendation" name="recommendation" defaultValue={initial.recommendation} className={inputClass}>
            <option value="">Choose…</option>
            <option value="accept">Accept</option>
            <option value="waitlist">Waitlist</option>
            <option value="reject">Do not accept</option>
          </select>
        </Field>
        {!isLocked && (
          <div className="flex flex-wrap gap-3">
            <button type="submit" name="intent" value="draft" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-navy/20 px-6 font-display font-semibold text-ink hover:border-navy/40 disabled:opacity-60">
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />} Save draft
            </button>
            <button type="submit" name="intent" value="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-6 font-display font-semibold text-paper hover:bg-navy-700 disabled:opacity-60">
              <Send aria-hidden className="size-4" /> Submit review
            </button>
          </div>
        )}
      </fieldset>
      {isLocked && <p className="text-sm text-slate">This review has been submitted and is locked. Contact the conference team if a change is needed.</p>}
    </form>
  );
}
