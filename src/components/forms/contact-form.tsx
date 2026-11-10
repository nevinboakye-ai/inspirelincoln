"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { contactSchema, ENQUIRY_CATEGORIES, type ContactInput, type EnquiryCategory } from "@/lib/validation/contact";
import { submitContact, type ContactResult } from "@/app/contact/actions";
import { Field, describedBy, inputClass } from "./field";

export function ContactForm({ initialCategory, active }: { initialCategory?: EnquiryCategory; active: boolean }) {
  const [result, setResult] = useState<ContactResult | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { category: initialCategory ?? "general", website: "" },
    mode: "onTouched",
  });

  useEffect(() => setValue("startedAt", Date.now()), [setValue]);

  const onSubmit = async (values: ContactInput) => {
    const res = await submitContact(values);
    setResult(res);
    if (!res.ok && res.fieldErrors) {
      for (const [k, v] of Object.entries(res.fieldErrors)) setError(k as keyof ContactInput, { message: v });
    }
    if (res.ok) reset({ category: values.category, website: "", startedAt: Date.now() });
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  if (result?.ok) {
    return (
      <motion.div ref={summaryRef} tabIndex={-1} role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-success/25 bg-success/[0.06] p-8 outline-none">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }} className="inline-flex">
          <CheckCircle2 aria-hidden className="size-10 text-success" />
        </motion.span>
        <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Thank you. Your message has been received.</h2>
        <p className="mt-2 text-slate-700">
          {result.emailed
            ? "The team has been notified by email and will reply to the address you provided."
            : "Your message has been stored securely for the team, who will reply to the address you provided. Email notifications are not active yet, so replies may take a little longer."}
        </p>
        <button type="button" onClick={() => setResult(null)} className="mt-6 text-sm font-semibold text-electric-600 underline underline-offset-4">
          Send another message
        </button>
      </motion.div>
    );
  }

  const errCount = Object.keys(errors).filter((k) => k !== "website" && k !== "startedAt").length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div ref={summaryRef} tabIndex={-1} className="outline-none" aria-live="assertive">
        {result && !result.ok && (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger/[0.06] p-4 text-sm font-medium text-danger">
            {result.error}
          </p>
        )}
        {!result && errCount > 0 && (
          <p className="rounded-md border border-danger/25 bg-danger/[0.06] p-4 text-sm font-medium text-danger">
            Please fix {errCount} field{errCount === 1 ? "" : "s"} below.
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="name" label="Name" required error={errors.name?.message}>
          <input id="name" autoComplete="name" className={inputClass} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy("name", errors.name?.message)} {...register("name")} />
        </Field>
        <Field id="email" label="Email" required error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className={inputClass} aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email", errors.email?.message)} {...register("email")} />
        </Field>
      </div>
      <Field id="category" label="Enquiry category" required error={errors.category?.message}>
        <select id="category" className={inputClass} aria-invalid={Boolean(errors.category)} {...register("category")}>
          {Object.entries(ENQUIRY_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field id="subject" label="Subject" required error={errors.subject?.message}>
        <input id="subject" className={inputClass} aria-invalid={Boolean(errors.subject)} aria-describedby={describedBy("subject", errors.subject?.message)} {...register("subject")} />
      </Field>
      <Field id="message" label="Message" required error={errors.message?.message} hint="Please don't include sensitive personal or medical information.">
        <textarea id="message" rows={7} className={inputClass} aria-invalid={Boolean(errors.message)} aria-describedby={describedBy("message", errors.message?.message, true)} {...register("message")} />
      </Field>

      {/* Honeypot: hidden from people and assistive technology. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <div>
        <label className="flex items-start gap-3 text-[0.95rem] text-slate-700">
          <input type="checkbox" className="mt-1 size-5 shrink-0 accent-electric-600" aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "consent-error" : undefined} {...register("consent")} />
          <span>
            I agree that INSPIRE may store and use my details to respond to this enquiry, as described in the{" "}
            <a href="/privacy" className="font-medium text-electric-600 underline underline-offset-4">
              privacy policy
            </a>
            . <span className="text-danger">*</span>
          </span>
        </label>
        {errors.consent && (
          <p id="consent-error" className="mt-2 text-sm font-medium text-danger">
            {errors.consent.message}
          </p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting || !active} className="inline-flex min-h-14 items-center gap-2 rounded-full bg-navy px-8 font-display font-semibold text-paper transition-colors hover:bg-navy-700 disabled:opacity-60">
        {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
        {isSubmitting ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
