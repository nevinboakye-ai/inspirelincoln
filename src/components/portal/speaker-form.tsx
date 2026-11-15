"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { saveMySpeaker, type SpeakerResult } from "@/app/portal/speaker/actions";
import { Field, inputClass } from "@/components/forms/field";

export function SpeakerForm({ initial }: { initial: { position: string; institution: string; credentials: string; bio: string } }) {
  const [state, action, pending] = useActionState<SpeakerResult, FormData>(saveMySpeaker, null);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="position" label="Job title">
          <input id="position" name="position" defaultValue={initial.position} maxLength={160} placeholder="e.g. Consultant Cardiologist" className={inputClass} />
        </Field>
        <Field id="credentials" label="Post-nominals" hint="Optional, for example MBBS FRCP.">
          <input id="credentials" name="credentials" defaultValue={initial.credentials} maxLength={80} className={inputClass} />
        </Field>
      </div>
      <Field id="institution" label="Organisation">
        <input id="institution" name="institution" defaultValue={initial.institution} maxLength={160} className={inputClass} />
      </Field>
      <Field id="bio" label="Biography" hint="A few sentences in the third person. Shown on your speaker page and in the conference booklet.">
        <textarea id="bio" name="bio" defaultValue={initial.bio} maxLength={2000} rows={8} className={inputClass} />
      </Field>
      {state?.error && <p role="alert" className="rounded-md border border-danger/25 bg-danger/[0.06] p-3 text-sm font-medium text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-md border border-success/25 bg-success/[0.06] p-3 text-sm font-medium text-success">{state.message}</p>}
      <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-navy px-6 text-sm font-semibold text-paper disabled:opacity-60">
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save
      </button>
    </form>
  );
}
