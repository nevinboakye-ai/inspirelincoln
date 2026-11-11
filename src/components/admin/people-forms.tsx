"use client";
import { submitWithoutReset } from "@/lib/use-action-form";
import { useActionState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { addRegistration, reviewPoster, setRegistrationStatus, setRole, updateEnquiry } from "@/app/admin/people-actions";
import type { ActionResult } from "@/app/portal/actions";
import { Field, inputClass } from "@/components/forms/field";
import { ResultBanner } from "@/components/portal/profile-forms";
import { btn } from "./ui";

const small = "min-h-10 rounded-[3px] border border-navy/15 bg-white px-3 text-sm";

/** A compact select that saves on change. */
function AutoSelect({ action, hidden, name, value, options, label }: { action: (s: ActionResult, f: FormData) => Promise<ActionResult>; hidden: Record<string, string>; name: string; value: string; options: [string, string][]; label: string }) {
  const [state, act, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} onSubmit={submitWithoutReset(act)} className="flex items-center gap-2">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <select name={name} defaultValue={value} aria-label={label} onChange={() => ref.current?.requestSubmit()} className={small} disabled={pending}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {pending && <Loader2 aria-hidden className="size-4 animate-spin text-slate" />}
      {state?.error && <span role="alert" className="text-xs text-danger">{state.error}</span>}
      {state?.ok && !pending && <span className="sr-only" role="status">Saved</span>}
    </form>
  );
}

export const RegistrationStatus = ({ id, status }: { id: string; status: string }) => (
  <AutoSelect action={setRegistrationStatus} hidden={{ id }} name="status" value={status} label="Registration status" options={[["pending", "Pending"], ["confirmed", "Confirmed"], ["waitlisted", "Waitlisted"], ["cancelled", "Cancelled"]]} />
);
export const RoleSelect = ({ id, role }: { id: string; role: string }) => (
  <AutoSelect action={setRole} hidden={{ id }} name="role" value={role} label="Role" options={[["delegate", "No extra access"], ["reviewer", "Abstract reviewer"], ["editor", "Website editor"], ["admin", "Site owner"]]} />
);
export const EnquiryStatus = ({ id, status }: { id: string; status: string }) => (
  <AutoSelect action={updateEnquiry} hidden={{ id }} name="status" value={status} label="Enquiry status" options={[["new", "New"], ["in_progress", "In progress"], ["closed", "Closed"]]} />
);

export function DeleteEnquiry({ id }: { id: string }) {
  const [state, act, pending] = useActionState(updateEnquiry, null);
  return (
    <form action={act} onSubmit={(e) => { if (!confirm("Delete this enquiry permanently?")) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="intent" value="delete" />
      <button disabled={pending} className="min-h-10 rounded-[3px] px-3 text-sm font-medium text-danger hover:bg-danger/[0.05]">Delete</button>
      {state?.error && <span role="alert" className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

export function AddRegistrationForm() {
  const [state, act, pending] = useActionState(addRegistration, null);
  return (
    <form action={act} className="space-y-3">
      <ResultBanner state={state} />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <Field id="email" label="Delegate's account email" error={state?.fieldErrors?.email}>
          <input id="email" name="email" type="email" required className={inputClass} />
        </Field>
        <Field id="status" label="Status">
          <select id="status" name="status" defaultValue="confirmed" className={inputClass}>
            <option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="waitlisted">Waitlisted</option>
          </select>
        </Field>
        <Field id="reference" label="External reference">
          <input id="reference" name="reference" className={inputClass} placeholder="Optional" />
        </Field>
        <button disabled={pending} className={btn.primary}>{pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Add</button>
      </div>
    </form>
  );
}

export function PosterReviewForm({ id, status, note }: { id: string; status: string; note: string }) {
  const [state, act, pending] = useActionState(reviewPoster, null);
  return (
    <form onSubmit={submitWithoutReset(act)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} aria-label="Poster status" className={small}>
        <option value="received">Received</option><option value="approved">Approved</option><option value="needs_changes">Changes requested</option>
      </select>
      <input name="note" defaultValue={note} placeholder="Note to presenter" aria-label="Note to presenter" className={`${small} min-w-48 flex-1`} />
      <button disabled={pending} className={btn.secondary}>Save</button>
      {state?.error && <span role="alert" className="text-xs text-danger">{state.error}</span>}
      {state?.ok && <span role="status" className="text-xs text-success">Saved</span>}
    </form>
  );
}
