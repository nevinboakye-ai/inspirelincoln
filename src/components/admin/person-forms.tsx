"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updatePerson, updateRosterPerson } from "@/app/admin/person-actions";
import { ResultBanner } from "@/components/portal/profile-forms";
import { Field, describedBy, inputClass } from "@/components/forms/field";
import { submitWithoutReset } from "@/lib/use-action-form";
import { CAREER_STAGES } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";
import { RoleCheckboxes } from "./roles";
import { btn } from "./ui";

type PersonDetails = {
  id: string;
  fullName: string | null;
  email: string;
  institution: string | null;
  programme: string | null;
  yearOfStudy: string | null;
  careerStage: string | null;
  committeePosition: string | null;
  presentationTitle: string | null;
};

function Input({ id, name, label, value, error, hint, required, type = "text", max, disabled }: { id: string; name: string; label: string; value: string | null; error?: string; hint?: string; required?: boolean; type?: string; max: number; disabled?: boolean }) {
  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={value ?? ""}
        maxLength={max}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, Boolean(hint))}
        className={inputClass}
      />
    </Field>
  );
}

/** Edit an account holder's details. The email only unlocks for the site owner, because it is what they log in with. */
export function PersonDetailsForm({ person, canChangeEmail, committee }: { person: PersonDetails; canChangeEmail: boolean; committee: boolean }) {
  const [state, action, pending] = useActionState(updatePerson, null);
  const fe = (k: string) => state?.fieldErrors?.[k];
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <ResultBanner state={state} />
      <input type="hidden" name="id" value={person.id} />
      {!canChangeEmail && <input type="hidden" name="email" value={person.email} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Input id="p-name" name="fullName" label="Full name" value={person.fullName} error={fe("fullName")} required max={120} />
        <Input
          id="p-email"
          name={canChangeEmail ? "email" : "email-display"}
          label="Email"
          type="email"
          value={person.email}
          error={fe("email")}
          required
          max={254}
          disabled={!canChangeEmail}
          hint={canChangeEmail ? "This is the email they log in with. Changing it takes effect straight away." : "Only the site owner can change the email someone logs in with."}
        />
        <Input id="p-inst" name="institution" label="University" value={person.institution} error={fe("institution")} max={160} />
        <Input id="p-prog" name="programme" label="Course" value={person.programme} error={fe("programme")} max={160} />
        <Input id="p-year" name="yearOfStudy" label="Year" value={person.yearOfStudy} error={fe("yearOfStudy")} max={40} />
        <Field id="p-stage" label="Stage" error={fe("careerStage")}>
          <select id="p-stage" name="careerStage" defaultValue={person.careerStage ?? ""} className={inputClass}>
            <option value="">Not given</option>
            {person.careerStage && !CAREER_STAGES.includes(person.careerStage) && <option value={person.careerStage}>{person.careerStage}</option>}
            {CAREER_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        {committee && <Input id="p-pos" name="committeePosition" label="Committee position" value={person.committeePosition} error={fe("committeePosition")} max={120} />}
        <Input id="p-title" name="presentationTitle" label="Presentation title" value={person.presentationTitle} error={fe("presentationTitle")} max={300} />
      </div>
      {!committee && <input type="hidden" name="committeePosition" value={person.committeePosition ?? ""} />}
      <button type="submit" disabled={pending} className={btn.primary}>
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save details
      </button>
    </form>
  );
}

type RosterDetails = {
  id: string;
  fullName: string;
  email: string;
  institution: string | null;
  yearOfStudy: string | null;
  accountType: AccountType;
  extraTypes?: AccountType[] | null;
  presentationTitle: string | null;
  note: string | null;
};

/** Edit someone on the selected list before they set up their account. */
export function RosterPersonForm({ person, canLead }: { person: RosterDetails; canLead: boolean }) {
  const [state, action, pending] = useActionState(updateRosterPerson, null);
  const fe = (k: string) => state?.fieldErrors?.[k];
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <ResultBanner state={state} />
      <input type="hidden" name="id" value={person.id} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input id="r-name" name="fullName" label="Full name" value={person.fullName} error={fe("fullName")} required max={120} />
        <Input
          id="r-email"
          name="email"
          label="Email"
          type="email"
          value={person.email}
          error={fe("email")}
          required
          max={254}
          hint="They must set up their account with this email to be approved automatically."
        />
        <Input id="r-inst" name="institution" label="University" value={person.institution} error={fe("institution")} max={160} />
        <Input id="r-year" name="yearOfStudy" label="Year" value={person.yearOfStudy} error={fe("yearOfStudy")} max={40} />
        <fieldset className="sm:col-span-2" aria-describedby={fe("types") ? "r-types-error" : undefined}>
          <legend className="mb-2 block text-sm font-semibold text-ink">
            Roles <span className="text-danger">*</span> <span className="font-normal text-slate">They&apos;ll have these when they set up their account.</span>
          </legend>
          <RoleCheckboxes initial={[person.accountType, ...(person.extraTypes ?? []).filter((t) => t !== person.accountType)]} canLead={canLead} compact />
          {fe("types") && (
            <p id="r-types-error" className="mt-2 text-sm font-medium text-danger">
              {fe("types")}
            </p>
          )}
        </fieldset>
        <Input id="r-title" name="presentationTitle" label="Presentation title" value={person.presentationTitle} error={fe("presentationTitle")} max={300} />
        <Field id="r-note" label="Committee note" error={fe("note")} hint="Only the committee sees this." className="sm:col-span-2">
          <textarea id="r-note" name="note" rows={3} maxLength={1000} defaultValue={person.note ?? ""} className={inputClass} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={btn.primary}>
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save details
      </button>
    </form>
  );
}

/** Remove someone from the selected list, after a confirmation. */
export function RemoveRosterButton({ id, name, action }: { id: string; name: string; action: (form: FormData) => Promise<void> }) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(`Remove ${name} from the selected list?`)) e.preventDefault(); }} className="mt-4">
      <input type="hidden" name="id" value={id} />
      <button className={`${btn.danger} w-full`}>Remove {name.split(" ")[0]}</button>
    </form>
  );
}
