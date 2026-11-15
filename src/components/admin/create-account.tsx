"use client";
import { useActionState, useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, UserPlus } from "lucide-react";
import { createAccount } from "@/app/admin/account-manage-actions";
import { submitWithoutReset } from "@/lib/use-action-form";
import { Field, inputClass } from "@/components/forms/field";
import { Overlay } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { COMMITTEE_TYPES, GUEST_TYPES } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";
import { cn } from "@/lib/cn";
import { RoleCheckboxes } from "./roles";

/** The form: name, email, any roles, and whether to email them how to log in. */
export function CreateAccountForm({ canLead, onDone }: { canLead: boolean; onDone?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [state, action, pending] = useActionState(createAccount, null);
  const [types, setTypes] = useState<AccountType[]>(["delegate"]);
  const [notify, setNotify] = useState(true);
  const fe = (k: string) => state?.fieldErrors?.[k];
  const presenting = types.some((t) => t === "oral_presenter" || t === "poster_presenter" || t === "oral_waitlist");
  const staffish = types.some((t) => COMMITTEE_TYPES.includes(t) || GUEST_TYPES.includes(t));

  useEffect(() => {
    if (!state?.ok) return;
    toast({ tone: "success", title: state.message ?? "Account created." });
    router.refresh();
    onDone?.();
    // Only when a new result arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      {state?.error && !state.ok && (
        <p role="alert" className="rounded-md border border-danger/25 bg-danger/[0.06] p-3 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-name`} label="Full name" required error={fe("fullName")}>
          <input id={`${uid}-name`} name="fullName" autoComplete="off" data-autofocus className={inputClass} aria-invalid={Boolean(fe("fullName"))} />
        </Field>
        <Field id={`${uid}-email`} label="Email" required error={fe("email")} hint="They log in with this.">
          <input id={`${uid}-email`} name="email" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" className={inputClass} aria-invalid={Boolean(fe("email"))} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-semibold text-ink">
          Type of account <span className="text-danger">*</span>
        </legend>
        <p className="-mt-1 mb-3 text-sm text-slate">Tick every role they hold, for example a judge who is also on the Academic Team.</p>
        <RoleCheckboxes initial={["delegate"]} canLead={canLead} compact onChange={setTypes} />
        {fe("types") && <p className="mt-2 text-sm font-medium text-danger">{fe("types")}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-uni`} label={staffish && !presenting ? "University or organisation" : "University"} error={fe("institution")}>
          <input id={`${uid}-uni`} name="institution" autoComplete="off" className={inputClass} />
        </Field>
        {staffish ? (
          <Field id={`${uid}-pos`} label="Position or title" error={fe("position")} hint="For example Consultant Cardiologist, or Head of Publicity.">
            <input id={`${uid}-pos`} name="position" autoComplete="off" className={inputClass} />
          </Field>
        ) : (
          <Field id={`${uid}-year`} label="Year of study" error={fe("yearOfStudy")}>
            <input id={`${uid}-year`} name="yearOfStudy" placeholder="e.g. Year 3" autoComplete="off" className={inputClass} />
          </Field>
        )}
        {presenting && (
          <Field id={`${uid}-title`} label="Presentation title" error={fe("presentationTitle")} className="sm:col-span-2">
            <input id={`${uid}-title`} name="presentationTitle" autoComplete="off" className={inputClass} />
          </Field>
        )}
      </div>

      <div className="rounded-lg border border-navy/10 bg-paper/60 p-4">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" name="notify" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-navy" />
          <span>
            <span className="font-semibold text-ink">Email them how to log in</span>
            <span className="block">A branded welcome email with their login details, or a link to set up their account.</span>
          </span>
        </label>
        {notify && (
          <Field id={`${uid}-note`} label="A note from you" error={fe("note")} className="mt-4">
            <textarea id={`${uid}-note`} name="note" rows={2} maxLength={1500} className={inputClass} placeholder="For example: thank you for judging on the day." />
          </Field>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700 disabled:opacity-60 sm:w-auto"
      >
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <UserPlus aria-hidden className="size-4" />} Create account
      </button>
      <p className="text-xs text-slate">
        The account is approved straight away with these roles, and they appear on the selected list. Change what each type can open on the{" "}
        <Link href="/admin/platform" className="font-semibold text-navy underline underline-offset-4">platform dashboard</Link>.
      </p>
    </form>
  );
}

/** A "Create account" button that opens the form over the page (a bottom sheet on phones). */
export function CreateAccountButton({ canLead, className, label = "Create account" }: { canLead: boolean; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const title = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] bg-navy px-5 text-sm font-semibold text-paper hover:bg-navy-700", className)}
      >
        <UserPlus aria-hidden className="size-4" /> {label}
      </button>
      <Overlay open={open} onClose={close} labelledBy={title}>
        <div className="overflow-y-auto overscroll-contain p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:p-7">
          <p className="eyebrow flex items-center gap-1.5 text-navy"><UserPlus aria-hidden className="size-4" /> New account</p>
          <h2 id={title} className="mt-2 font-display text-2xl text-ink">Create an account</h2>
          <p className="mt-1 mb-5 text-sm text-slate-700">
            Any type: delegate, presenter, speaker, judge or committee. <ArrowRight aria-hidden className="inline size-3.5" /> They&apos;re approved straight away.
          </p>
          <CreateAccountForm canLead={canLead} onDone={close} />
        </div>
      </Overlay>
    </>
  );
}
