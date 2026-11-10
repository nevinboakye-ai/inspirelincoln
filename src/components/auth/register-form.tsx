"use client";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, MailCheck } from "lucide-react";
import { signUp, type AuthState } from "@/app/auth/actions";
import { Field, inputClass } from "@/components/forms/field";
import { submitWithoutReset } from "@/lib/use-action-form";
import { ACCOUNT_TYPE_BLURB, ACCOUNT_TYPE_LABEL, CAREER_STAGES, COMMITTEE_TYPES, HEARD_ABOUT, submissionKindFor } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";
import { cn } from "@/lib/cn";

const GROUPS: { title: string; types: AccountType[] }[] = [
  { title: "Attending", types: ["delegate"] },
  { title: "Presenting", types: ["oral_presenter", "poster_presenter"] },
  { title: "INSPIRE committee", types: ["supporting_committee", "executive_committee", "vice_president", "president"] },
];

const STEPS = ["How you're joining", "About you", "Your choices"] as const;
const STEP_FIELDS: string[][] = [
  ["accountType"],
  ["fullName", "email", "password", "institution", "careerStage", "programme", "committeePosition", "presentationTitle", "heardAbout"],
  ["photoOptOut", "marketingOptIn", "privacyAck"],
];

type Values = Record<string, string>;

function validateStep(step: number, v: Values, type: AccountType | null): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0 && !type) e.accountType = "Choose how you're joining INSPIRE.";
  if (step === 1) {
    if ((v.fullName ?? "").trim().length < 2) e.fullName = "Enter your full name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v.email ?? "").trim())) e.email = "Enter a valid email address.";
    if ((v.password ?? "").length < 10) e.password = "Use at least 10 characters.";
    if ((v.institution ?? "").trim().length < 2) e.institution = "Enter your university or organisation.";
    if (!v.careerStage) e.careerStage = "Choose your stage.";
    if (type && COMMITTEE_TYPES.includes(type) && (v.committeePosition ?? "").trim().length < 2)
      e.committeePosition = "Enter your committee position, for example Head of Events.";
    if (type && submissionKindFor(type) && (v.presentationTitle ?? "").trim().length < 5) e.presentationTitle = "Enter the title of your presentation.";
  }
  if (step === 2 && v.privacyAck !== "on") e.privacyAck = "Please confirm you have read the privacy notice.";
  return e;
}

export function RegisterForm({ next, disabled }: { next: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, null);
  const [step, setStep] = useState(0);
  const [type, setType] = useState<AccountType | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Server errors: show them and jump back to the first step that has one.
  useEffect(() => {
    if (!state?.fieldErrors) return;
    setErrors(state.fieldErrors);
    const first = STEP_FIELDS.findIndex((fields) => fields.some((f) => state.fieldErrors?.[f]));
    if (first >= 0) setStep(first);
  }, [state]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const read = (): Values => {
    const fd = new FormData(formRef.current!);
    const out: Values = {};
    fd.forEach((val, key) => {
      if (typeof val === "string") out[key] = val;
    });
    return out;
  };

  const goNext = () => {
    const e = validateStep(step, read(), type);
    setErrors(e);
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const isCommittee = type ? COMMITTEE_TYPES.includes(type) : false;
  const kind = type ? submissionKindFor(type) : null;
  const fe = (k: string) => errors[k];
  const inv = (k: string) => ({ "aria-invalid": Boolean(fe(k)), "aria-describedby": fe(k) ? `${k}-error` : undefined });

  const summary = useMemo(() => (type ? ACCOUNT_TYPE_LABEL[type] : null), [type]);

  if (state?.message) {
    return (
      <div role="status" className="rounded-[3px] border border-navy/10 bg-white p-6 sm:p-8">
        <MailCheck aria-hidden className="size-8 text-electric-600" />
        <h2 className="mt-4 font-display text-2xl text-ink">Check your inbox</h2>
        <p className="mt-3 leading-relaxed text-slate-700">
          We&apos;ve sent a link to <strong className="text-ink">{state.message}</strong>. Open it on this device to verify your email address.
        </p>
        <ol className="mt-6 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> Verify your email using the link.</li>
          <li className="flex gap-3"><span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-navy/30 text-[0.6rem]">2</span> The executive committee reviews your account. We&apos;ll email you when it&apos;s approved, or if you&apos;re placed on the waitlist.</li>
          <li className="flex gap-3"><span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-navy/30 text-[0.6rem]">3</span> Log in any time to see where things are.</li>
        </ol>
        <p className="mt-6 text-sm text-slate">No email after a few minutes? Check your spam or junk folder.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submitWithoutReset(action)} noValidate className="space-y-8">
      <input type="hidden" name="next" value={next} />

      {/* Progress */}
      <ol aria-label="Registration steps" className="grid grid-cols-3 gap-2">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <span className={cn("block h-1 rounded-full", i <= step ? "bg-navy" : "bg-navy/15")} />
            <span className={cn("mt-2 block font-ui text-[0.7rem] font-semibold uppercase tracking-[0.14em]", i === step ? "text-ink" : "text-slate")}>
              <span className="sr-only">Step {i + 1} of {STEPS.length}: </span>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {state?.error && (
        <p role="alert" className="rounded-[3px] border border-danger/25 bg-danger/[0.06] p-4 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}

      <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl text-ink outline-none">
        {step === 0 ? "How are you joining INSPIRE?" : step === 1 ? "Tell us about you" : "A few choices, then you're done"}
      </h2>

      {/* Step 1: account type */}
      <fieldset hidden={step !== 0} aria-describedby={fe("accountType") ? "accountType-error" : undefined}>
        <legend className="sr-only">Account type</legend>
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate">{g.title}</p>
              <div className="mt-2 grid gap-2">
                {g.types.map((t) => (
                  <label
                    key={t}
                    className={cn(
                      "flex cursor-pointer items-start gap-4 rounded-[3px] border bg-white p-4 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-electric/20",
                      type === t ? "border-navy ring-1 ring-navy" : "border-navy/15 hover:border-navy/40",
                    )}
                  >
                    <input type="radio" name="accountType" value={t} checked={type === t} onChange={() => setType(t)} className="mt-1 size-5 shrink-0 accent-navy" />
                    <span>
                      <span className="block font-semibold text-ink">{ACCOUNT_TYPE_LABEL[t]}</span>
                      <span className="mt-0.5 block text-sm text-slate-700">{ACCOUNT_TYPE_BLURB[t]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {fe("accountType") && <p id="accountType-error" className="mt-3 text-sm font-medium text-danger">{fe("accountType")}</p>}
        <p className="mt-5 text-sm text-slate">Committee and presenter accounts are checked by the executive committee before they are switched on.</p>
      </fieldset>

      {/* Step 2: about you */}
      <div hidden={step !== 1} className="space-y-5">
        {summary && (
          <p className="flex items-center justify-between gap-3 rounded-[3px] bg-paper-200 px-4 py-3 text-sm text-slate-700">
            <span>Joining as <strong className="text-ink">{summary}</strong></span>
            <button type="button" onClick={() => setStep(0)} className="min-h-10 font-semibold text-electric-600 underline underline-offset-4">Change</button>
          </p>
        )}
        <Field id="fullName" label="Full name" required error={fe("fullName")}>
          <input id="fullName" name="fullName" autoComplete="name" className={inputClass} {...inv("fullName")} />
        </Field>
        <Field id="email" label="Email" required error={fe("email")} hint="Your university email is best. We'll send a link to verify it.">
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" className={inputClass} {...inv("email")} />
        </Field>
        <Field id="password" label="Password" required error={fe("password")} hint="At least 10 characters.">
          <input id="password" name="password" type="password" autoComplete="new-password" className={inputClass} {...inv("password")} />
        </Field>
        <Field id="institution" label="University or organisation" required error={fe("institution")}>
          <input id="institution" name="institution" autoComplete="organization" placeholder="e.g. University of Lincoln" className={inputClass} {...inv("institution")} />
        </Field>
        <Field id="careerStage" label="Your stage" required error={fe("careerStage")}>
          <select id="careerStage" name="careerStage" defaultValue="" className={inputClass} {...inv("careerStage")}>
            <option value="" disabled>Choose one</option>
            {CAREER_STAGES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field id="programme" label="Course or specialty" error={fe("programme")}>
          <input id="programme" name="programme" placeholder="e.g. Medicine MBChB" className={inputClass} {...inv("programme")} />
        </Field>
        {isCommittee && (
          <Field id="committeePosition" label="Committee position" required error={fe("committeePosition")} hint="As the committee knows it, so we can check it quickly.">
            <input id="committeePosition" name="committeePosition" placeholder="e.g. Head of Events" className={inputClass} {...inv("committeePosition")} />
          </Field>
        )}
        {kind && (
          <Field id="presentationTitle" label={kind === "slides" ? "Title of your talk" : "Title of your poster"} required error={fe("presentationTitle")} hint="As it appears on your acceptance.">
            <textarea id="presentationTitle" name="presentationTitle" rows={2} className={inputClass} {...inv("presentationTitle")} />
          </Field>
        )}
        <Field id="heardAbout" label="How did you hear about INSPIRE?" error={fe("heardAbout")}>
          <select id="heardAbout" name="heardAbout" defaultValue="" className={inputClass}>
            <option value="">Prefer not to say</option>
            {HEARD_ABOUT.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </Field>
      </div>

      {/* Step 3: choices and privacy */}
      <div hidden={step !== 2} className="space-y-6">
        <div className="rounded-[3px] border border-navy/10 bg-white p-5 text-sm leading-relaxed text-slate-700">
          <p className="font-semibold text-ink">How we use your details</p>
          <p className="mt-2">
            We use what you&apos;ve told us to run your account, check who is attending and organise the day. Only the INSPIRE committee
            sees it, and we never sell it. You can download or delete your data from your account at any time.
          </p>
          <p className="mt-2">
            If you have access or dietary needs, you can add them after signing in. We ask for your explicit permission first, because
            that is sensitive information.
          </p>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-ink">Optional</legend>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" name="photoOptOut" className="mt-0.5 size-5 shrink-0 accent-navy" />
            <span>
              <span className="font-medium text-ink">I&apos;d prefer not to be photographed.</span> We take photographs on the day. If you tick this,
              we&apos;ll give you a lanyard so our photographers know.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" name="marketingOptIn" className="mt-0.5 size-5 shrink-0 accent-navy" />
            <span>
              <span className="font-medium text-ink">Email me about future INSPIRE events.</span> At most a few emails a year. You can stop them at any
              time from your account or any email.
            </span>
          </label>
        </fieldset>

        <div>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" name="privacyAck" className="mt-0.5 size-5 shrink-0 accent-navy" {...inv("privacyAck")} />
            <span>
              I have read the{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-electric-600 underline underline-offset-4">
                privacy notice<span className="sr-only"> (opens in a new tab)</span>
              </Link>{" "}
              and understand how INSPIRE uses my details. <span className="text-danger">*</span>
            </span>
          </label>
          {fe("privacyAck") && <p id="privacyAck-error" className="mt-2 text-sm font-medium text-danger">{fe("privacyAck")}</p>}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="inline-flex min-h-12 items-center gap-2 rounded-[3px] border border-navy/15 px-5 font-ui font-semibold text-ink hover:border-navy/40">
            <ArrowLeft aria-hidden className="size-4" /> Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} className="ml-auto inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700 sm:flex-none">
            Continue <ArrowRight aria-hidden className="size-4" />
          </button>
        ) : (
          <fieldset disabled={disabled || pending} className="ml-auto flex-1 sm:flex-none">
            <button
              type="submit"
              onClick={(e) => {
                const errs = validateStep(2, read(), type);
                if (Object.keys(errs).length) {
                  e.preventDefault();
                  setErrors(errs);
                }
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700 disabled:opacity-60"
            >
              {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Create account
            </button>
          </fieldset>
        )}
      </div>
    </form>
  );
}
