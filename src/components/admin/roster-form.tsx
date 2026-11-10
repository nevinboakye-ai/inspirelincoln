"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { addRosterEntry } from "@/app/admin/people-actions";
import { submitWithoutReset } from "@/lib/use-action-form";
import { Field, inputClass } from "@/components/forms/field";
import { ResultBanner } from "@/components/portal/profile-forms";
import { RoleCheckboxes } from "./roles";

export function RosterAddForm({ canLead }: { canLead: boolean }) {
  const [state, action, pending] = useActionState(addRosterEntry, null);
  const fe = (k: string) => state?.fieldErrors?.[k];
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><ResultBanner state={state} /></div>
      <Field id="r-name" label="Full name" required error={fe("fullName")}>
        <input id="r-name" name="fullName" className={inputClass} aria-invalid={Boolean(fe("fullName"))} />
      </Field>
      <Field id="r-email" label="Email they applied with" required error={fe("email")}>
        <input id="r-email" name="email" type="email" className={inputClass} aria-invalid={Boolean(fe("email"))} />
      </Field>
      <Field id="r-inst" label="University">
        <input id="r-inst" name="institution" className={inputClass} />
      </Field>
      <Field id="r-year" label="Year">
        <input id="r-year" name="year" placeholder="e.g. Year 2" className={inputClass} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 block text-sm font-semibold text-ink">
          Roles <span className="text-danger">*</span>
        </legend>
        <RoleCheckboxes initial={["delegate"]} canLead={canLead} compact />
      </fieldset>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700 disabled:opacity-60">
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Add to the list
        </button>
      </div>
    </form>
  );
}
