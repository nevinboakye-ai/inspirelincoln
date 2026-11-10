"use client";
import { submitWithoutReset } from "@/lib/use-action-form";
import { useActionState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { assignReviewer, decideAbstract, setShowcase, unassignReviewer } from "@/app/admin/abstracts/actions";
import { Field, inputClass } from "@/components/forms/field";
import { ResultBanner } from "@/components/portal/profile-forms";
import { btn } from "./ui";

export function AssignReviewerForm({ abstractId, reviewers }: { abstractId: string; reviewers: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(assignReviewer, null);
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-3">
      <ResultBanner state={state} />
      <input type="hidden" name="abstractId" value={abstractId} />
      <div className="flex flex-wrap items-end gap-2">
        <Field id="reviewerId" label="Add a reviewer" className="min-w-56 flex-1">
          <select id="reviewerId" name="reviewerId" className={inputClass} defaultValue="">
            <option value="">Choose…</option>
            {reviewers.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>
        <button type="submit" disabled={pending || !reviewers.length} className={btn.secondary}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <UserPlus aria-hidden className="size-4" />} Assign
        </button>
      </div>
      {!reviewers.length && <p className="text-sm text-slate">No eligible reviewers. Give someone the reviewer role under Users &amp; roles.</p>}
    </form>
  );
}

export function UnassignButton({ abstractId, assignmentId, name }: { abstractId: string; assignmentId: string; name: string }) {
  const [state, action, pending] = useActionState(unassignReviewer, null);
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(`Remove ${name}? Any review they have written will be deleted.`)) e.preventDefault(); }}>
      {state?.error && <span role="alert" className="text-xs text-danger">{state.error}</span>}
      <input type="hidden" name="abstractId" value={abstractId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <button type="submit" disabled={pending} aria-label={`Remove ${name}`} className="flex size-9 items-center justify-center rounded-full text-slate hover:bg-paper-200 hover:text-danger"><X aria-hidden className="size-4" /></button>
    </form>
  );
}

export function DecisionForm({ abstractId, status, note, type, types }: { abstractId: string; status: string; note: string; type: string; types: string[] }) {
  const [state, action, pending] = useActionState(decideAbstract, null);
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-4">
      <ResultBanner state={state} />
      <input type="hidden" name="abstractId" value={abstractId} />
      <Field id="status" label="Status">
        <select id="status" name="status" defaultValue={status} className={inputClass}>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under review</option>
          <option value="accepted">Accepted</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="rejected">Not accepted</option>
        </select>
      </Field>
      <Field id="presentationType" label="Presentation type (if accepted)">
        <select id="presentationType" name="presentationType" defaultValue={type} className={inputClass}>
          <option value="">None</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field id="decisionNote" label="Note to the author" hint="Shown in the author's portal with the decision.">
        <textarea id="decisionNote" name="decisionNote" rows={4} defaultValue={note} className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={btn.primary}>{pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save decision</button>
    </form>
  );
}

export function ShowcaseForm({ abstractId, published, summary, eligible }: { abstractId: string; published: boolean; summary: string; eligible: boolean }) {
  const [state, action, pending] = useActionState(setShowcase, null);
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-4">
      <ResultBanner state={state} />
      <input type="hidden" name="abstractId" value={abstractId} />
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input type="checkbox" name="publish" defaultChecked={published} disabled={!eligible} className="mt-0.5 size-5 accent-electric-600" />
        <span>Publish in the public research showcase{!eligible && <span className="block text-slate">Requires an accepted abstract and the author&apos;s showcase consent.</span>}</span>
      </label>
      <Field id="summary" label="Public summary" hint="Optional. Defaults to the conclusion.">
        <textarea id="summary" name="summary" rows={3} defaultValue={summary} className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={btn.secondary}>Save showcase settings</button>
    </form>
  );
}
