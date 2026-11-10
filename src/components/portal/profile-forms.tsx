"use client";
import { submitWithoutReset } from "@/lib/use-action-form";
import { useActionState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { deleteAccount, saveNeeds, setPreference, updateProfile, type ActionResult } from "@/app/portal/actions";
import { CAREER_STAGES, COMMITTEE_TYPES, hasRole, presenterKindOf } from "@/lib/accounts";
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
  const committee = hasRole(profile, ...COMMITTEE_TYPES);
  const presenter = Boolean(presenterKindOf(profile));
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <ResultBanner state={state} />
      <Field id="email" label="Email" required hint="To change the email on your account, contact the committee.">
        <input id="email" value={profile.email} readOnly disabled className={inputClass} />
      </Field>
      <Field id="fullName" label="Full name" required error={fe("fullName")}>
        <input id="fullName" name="fullName" defaultValue={profile.fullName ?? ""} autoComplete="name" className={inputClass} aria-invalid={Boolean(fe("fullName"))} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="institution" label="University or organisation">
          <input id="institution" name="institution" defaultValue={profile.institution ?? ""} autoComplete="organization" className={inputClass} />
        </Field>
        <Field id="careerStage" label="Your stage">
          <select id="careerStage" name="careerStage" defaultValue={profile.careerStage ?? ""} className={inputClass}>
            <option value="">Not set</option>
            {CAREER_STAGES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field id="programme" label="Course or specialty">
        <input id="programme" name="programme" defaultValue={profile.programme ?? ""} className={inputClass} />
      </Field>
      {committee && (
        <Field id="committeePosition" label="Committee position">
          <input id="committeePosition" name="committeePosition" defaultValue={profile.committeePosition ?? ""} className={inputClass} />
        </Field>
      )}
      {presenter && (
        <Field id="presentationTitle" label="Presentation title">
          <textarea id="presentationTitle" name="presentationTitle" rows={2} defaultValue={profile.presentationTitle ?? ""} className={inputClass} />
        </Field>
      )}
      <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700 disabled:opacity-60 sm:w-auto">
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save details
      </button>
    </form>
  );
}

export function NeedsForm({ accessibility, dietary }: { accessibility: string; dietary: string }) {
  const [state, action, pending] = useActionState(saveNeeds, null);
  const has = Boolean(accessibility || dietary);
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <ResultBanner state={state} />
      <Field id="accessibility" label="Access needs" hint="For example step-free access, a hearing loop, seating near the front or a quiet space.">
        <textarea id="accessibility" name="accessibility" rows={3} maxLength={1000} defaultValue={accessibility} className={inputClass} />
      </Field>
      <Field id="dietary" label="Dietary requirements" hint="For example vegetarian, halal or allergies.">
        <textarea id="dietary" name="dietary" rows={2} maxLength={500} defaultValue={dietary} className={inputClass} />
      </Field>
      <div>
        <label className="flex items-start gap-3 rounded-[3px] border border-navy/15 bg-paper p-4 text-sm text-slate-700">
          <input type="checkbox" name="consent" defaultChecked={has} className="mt-0.5 size-5 shrink-0 accent-navy" aria-invalid={Boolean(state?.fieldErrors?.consent)} aria-describedby={state?.fieldErrors?.consent ? "consent-error" : undefined} />
          <span>
            <span className="font-medium text-ink">I give my explicit permission</span> for INSPIRE to store these details and share them with the executive committee and the
            venue team, only to make arrangements for me at INSPIRE 2026. I can withdraw this at any time and the details will be deleted.
          </span>
        </label>
        {state?.fieldErrors?.consent && <p id="consent-error" className="mt-2 text-sm font-medium text-danger">{state.fieldErrors.consent}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value="save" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700 disabled:opacity-60">
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save needs
        </button>
        {has && (
          <button type="submit" name="intent" value="remove" disabled={pending} className="inline-flex min-h-12 items-center rounded-[3px] border border-navy/15 px-5 font-ui font-semibold text-ink">
            Withdraw permission and delete
          </button>
        )}
      </div>
    </form>
  );
}

export function PreferenceToggle({ purpose, value, label, description }: { purpose: "marketing_email" | "photography_opt_out"; value: boolean; label: string; description: string }) {
  const [state, action, pending] = useActionState(setPreference, null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} onSubmit={submitWithoutReset(action)}>
      <input type="hidden" name="purpose" value={purpose} />
      <label className="flex items-start gap-4 py-4">
        <input type="checkbox" name="value" defaultChecked={value} disabled={pending} onChange={() => ref.current?.requestSubmit()} className="mt-0.5 size-5 shrink-0 accent-navy" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">{label}</span>
          <span className="block text-sm text-slate-700">{description}</span>
          {pending && <span className="mt-1 block text-xs text-slate">Saving…</span>}
          {state?.ok && !pending && <span role="status" className="mt-1 block text-xs text-success">Saved</span>}
          {state?.error && <span role="alert" className="mt-1 block text-xs text-danger">{state.error}</span>}
        </span>
      </label>
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
      <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-danger px-6 font-ui font-semibold text-white disabled:opacity-60">
        Permanently delete my account
      </button>
    </form>
  );
}
