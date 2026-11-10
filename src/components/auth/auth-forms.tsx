"use client";
import { submitWithoutReset } from "@/lib/use-action-form";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { activateAccount, requestReset, signIn, updatePassword, type AuthState } from "@/app/auth/actions";
import { Field, inputClass } from "@/components/forms/field";

function Status({ state }: { state: AuthState }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="mb-6 rounded-md border border-danger/25 bg-danger/[0.06] p-4 text-sm font-medium text-danger">{state.error}</p>;
  if (state.message) return <p role="status" className="mb-6 rounded-md border border-success/25 bg-success/[0.06] p-4 text-sm font-medium text-success">{state.message}</p>;
  return null;
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-navy font-ui font-semibold text-paper hover:bg-navy-700 disabled:opacity-60">
      {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

const fe = (s: AuthState, k: string) => s?.fieldErrors?.[k];
const inv = (s: AuthState, k: string) => ({ "aria-invalid": Boolean(fe(s, k)), "aria-describedby": fe(s, k) ? `${k}-error` : undefined });

export function SignInForm({ next, disabled }: { next: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <Status state={state} />
      <input type="hidden" name="next" value={next} />
      <Field id="email" label="Email" required error={fe(state, "email")}>
        <input id="email" name="email" type="email" autoComplete="email" className={inputClass} {...inv(state, "email")} />
      </Field>
      <Field id="password" label="Password" required error={fe(state, "password")}>
        <input id="password" name="password" type="password" autoComplete="current-password" className={inputClass} {...inv(state, "password")} />
      </Field>
      <div className="text-right text-sm">
        <Link href="/auth/reset" className="font-medium text-electric-600 underline underline-offset-4">Forgotten your password?</Link>
      </div>
      <fieldset disabled={disabled}>
        <Submit pending={pending}>Log in</Submit>
      </fieldset>
    </form>
  );
}

export function ResetForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(requestReset, null);
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <Status state={state} />
      <Field id="email" label="Email" required error={fe(state, "email")}>
        <input id="email" name="email" type="email" autoComplete="email" className={inputClass} {...inv(state, "email")} />
      </Field>
      <fieldset disabled={disabled}>
        <Submit pending={pending}>Send reset link</Submit>
      </fieldset>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <Status state={state} />
      <Field id="password" label="New password" required error={fe(state, "password")} hint="At least 10 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" className={inputClass} {...inv(state, "password")} />
      </Field>
      <Field id="confirm" label="Confirm new password" required error={fe(state, "confirm")}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" className={inputClass} {...inv(state, "confirm")} />
      </Field>
      <Submit pending={pending}>Update password</Submit>
    </form>
  );
}

export function ActivateForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(activateAccount, null);
  if (state?.message)
    return (
      <div role="status" className="rounded-md border border-success/25 bg-success/[0.06] p-5 text-sm text-ink">
        <p className="font-semibold">Check your inbox</p>
        <p className="mt-2 text-slate-700">
          We&apos;ve sent a link to <strong className="break-all">{state.message}</strong>. Open it to confirm your email and you&apos;ll go straight to My Hub.
          It can take a few minutes, so check your junk folder too.
        </p>
      </div>
    );
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <Status state={state} />
      <Field id="email" label="Email you applied with" required error={fe(state, "email")} hint="Usually your university email.">
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" className={inputClass} {...inv(state, "email")} />
      </Field>
      <Field id="password" label="Choose a password" required error={fe(state, "password")} hint="At least 10 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" className={inputClass} {...inv(state, "password")} />
      </Field>
      <Field id="confirm" label="Confirm password" required error={fe(state, "confirm")}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" className={inputClass} {...inv(state, "confirm")} />
      </Field>
      <div>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" name="privacyAck" className="mt-0.5 size-5 shrink-0 accent-navy" {...inv(state, "privacyAck")} />
          <span>
            I have read the{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-electric-600 underline underline-offset-4">privacy notice</Link>{" "}
            (opens in a new tab).
          </span>
        </label>
        {fe(state, "privacyAck") && <p id="privacyAck-error" className="mt-2 text-sm font-medium text-danger">{fe(state, "privacyAck")}</p>}
      </div>
      <fieldset disabled={disabled}>
        <Submit pending={pending}>Set up my account</Submit>
      </fieldset>
    </form>
  );
}
