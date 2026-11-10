"use client";
import { submitWithoutReset } from "@/lib/use-action-form";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { deleteAccount, updateProfile, type ActionResult } from "@/app/portal/actions";
import { Field, inputClass } from "@/components/forms/field";
import type { Profile } from "@/lib/auth";

export function ResultBanner({ state }: { state: ActionResult }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="mb-6 rounded-md border border-danger/25 bg-danger/[0.06] p-4 text-sm font-medium text-danger">{state.error}</p>;
  if (state.message) return <p role="status" className="mb-6 rounded-md border border-success/25 bg-success/[0.06] p-4 text-sm font-medium text-success">{state.message}</p>;
  return null;
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  const fe = (k: string) => state?.fieldErrors?.[k];
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <ResultBanner state={state} />
      <Field id="email" label="Email" required hint="Contact the team to change the email on your account.">
        <input id="email" value={profile.email} readOnly disabled className={inputClass} />
      </Field>
      <Field id="fullName" label="Full name" required error={fe("fullName")}>
        <input id="fullName" name="fullName" defaultValue={profile.fullName ?? ""} autoComplete="name" className={inputClass} aria-invalid={Boolean(fe("fullName"))} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="institution" label="University or institution">
          <input id="institution" name="institution" defaultValue={profile.institution ?? ""} autoComplete="organization" className={inputClass} />
        </Field>
        <Field id="programme" label="Programme">
          <input id="programme" name="programme" defaultValue={profile.programme ?? ""} placeholder="e.g. MBChB" className={inputClass} />
        </Field>
      </div>
      <Field id="yearOfStudy" label="Year of study">
        <input id="yearOfStudy" name="yearOfStudy" defaultValue={profile.yearOfStudy ?? ""} className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-6 font-display font-semibold text-paper hover:bg-navy-700 disabled:opacity-60">
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save profile
      </button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, null);
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-4">
      <ResultBanner state={state} />
      <Field id="confirm" label='Type "DELETE" to confirm' required error={state?.fieldErrors?.confirm}>
        <input id="confirm" name="confirm" autoComplete="off" className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-danger px-6 font-display font-semibold text-white disabled:opacity-60">
        Permanently delete my account
      </button>
    </form>
  );
}
