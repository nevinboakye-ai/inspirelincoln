"use client";
import { useRouter } from "next/navigation";
import { Accessibility, CircleHelp, Loader2, Mic2, MoreHorizontal, SendHorizontal, Wrench, HandHelping } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { openEnquiry } from "@/app/portal/enquiry-actions";
import { Field, describedBy, inputClass } from "@/components/forms/field";
import { submitWithoutReset } from "@/lib/use-action-form";
import { cn } from "@/lib/cn";
import { BODY_MAX, ENQUIRY_TOPICS, SUBJECT_MAX, type EnquiryTopic } from "@/lib/enquiries";
import { viewingAs } from "@/lib/view-as-client";

const ICONS: Record<EnquiryTopic, typeof CircleHelp> = {
  question: CircleHelp,
  request: HandHelping,
  technical: Wrench,
  access: Accessibility,
  presenting: Mic2,
  other: MoreHorizontal,
};

/** Start a new conversation with the committee. */
export function NewEnquiry({ initialTopic }: { initialTopic?: EnquiryTopic }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(openEnquiry, null);
  const [topic, setTopic] = useState<EnquiryTopic | "">(initialTopic ?? "");
  const [body, setBody] = useState("");
  const [blocked, setBlocked] = useState<string | null>(null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  useEffect(() => {
    if (state?.ok) router.push(`/portal/enquiries/${state.id}`);
  }, [state, router]);

  const error = blocked ?? (state && !state.ok ? state.error : null);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        if (viewingAs()) {
          e.preventDefault();
          setBlocked("You're viewing as someone else, so sending is switched off.");
          return;
        }
        setBlocked(null);
        submitWithoutReset(action)(e);
      }}
      className="space-y-6"
    >
      <fieldset aria-describedby={fe("topic") ? "topic-error" : undefined}>
        <legend className="mb-3 text-sm font-semibold text-ink">
          What&apos;s it about?<span className="text-danger"> *</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(ENQUIRY_TOPICS) as EnquiryTopic[]).map((k) => {
            const Icon = ICONS[k];
            const on = topic === k;
            return (
              <label
                key={k}
                className={cn(
                  "flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-electric-600",
                  on ? "border-navy bg-navy/[0.04] ring-1 ring-navy" : "border-navy/12 hover:border-navy/35",
                )}
              >
                <input type="radio" name="topic" value={k} checked={on} onChange={() => setTopic(k)} className="sr-only" />
                <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full transition-colors", on ? "bg-navy text-paper" : "bg-cyan/20 text-navy")}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{ENQUIRY_TOPICS[k].label}</span>
                  <span className="block text-xs leading-snug text-slate-700">{ENQUIRY_TOPICS[k].hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        {fe("topic") && (
          <p id="topic-error" className="mt-2 text-sm font-medium text-danger">
            {fe("topic")}
          </p>
        )}
      </fieldset>

      <Field id="subject" label="Subject" required error={fe("subject")}>
        <input
          id="subject"
          name="subject"
          maxLength={SUBJECT_MAX}
          autoComplete="off"
          placeholder="For example, step-free route to the lecture theatre"
          className={inputClass}
          aria-invalid={Boolean(fe("subject"))}
          aria-describedby={describedBy("subject", fe("subject"))}
        />
      </Field>

      <Field id="body" label="Your message" required error={fe("body")} hint="Include anything that will help the committee answer in one go.">
        <textarea
          id="body"
          name="body"
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={BODY_MAX}
          className={cn(inputClass, "min-h-40")}
          aria-invalid={Boolean(fe("body"))}
          aria-describedby={describedBy("body", fe("body"), true)}
        />
        {body.length > BODY_MAX - 400 && <p className="mt-1.5 text-right text-xs tabular-nums text-slate">{BODY_MAX - body.length} characters left</p>}
      </Field>

      {error && (
        <p role="alert" className="rounded-md border border-danger/25 bg-danger/[0.05] p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700 disabled:opacity-60">
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <SendHorizontal aria-hidden className="size-4" />} Send to the committee
      </button>
    </form>
  );
}
