"use client";
import { submitWithoutReset } from "@/lib/use-action-form";
import { useActionState, useState } from "react";
import { Loader2, Save, Send } from "lucide-react";
import { saveAbstract } from "@/app/portal/actions";
import { Field, inputClass } from "@/components/forms/field";
import { ResultBanner } from "./profile-forms";
import { ABSTRACT_SECTIONS, countWords } from "@/lib/validation/abstract";
import type { AbstractConfig } from "@/lib/types";
import { cn } from "@/lib/cn";

export interface AbstractValues {
  id?: string;
  presentingAuthor: string;
  email: string;
  university: string;
  programmeYear: string;
  title: string;
  coAuthors: string;
  category: string;
  presentationPreference: string;
  background: string;
  aim: string;
  methods: string;
  results: string;
  conclusion: string;
  consentData: boolean;
  declarationOriginal: boolean;
  consentShowcase: boolean;
  hasFile?: boolean;
}

const SECTION_LABEL: Record<(typeof ABSTRACT_SECTIONS)[number], string> = {
  background: "Background",
  aim: "Aim",
  methods: "Methods",
  results: "Results",
  conclusion: "Conclusion",
};

/** Abstract submission form with live word counts. All limits are enforced again on the server. */
export function AbstractForm({ initial, config }: { initial: AbstractValues; config: AbstractConfig }) {
  const [v, setV] = useState(initial);
  const [state, action, pending] = useActionState(saveAbstract, null);
  const set = <K extends keyof AbstractValues>(k: K, val: AbstractValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const fe = (k: string) => state?.fieldErrors?.[k];
  const total = ABSTRACT_SECTIONS.reduce((n, k) => n + countWords(v[k]), 0);
  const id = state?.id ?? v.id;

  const text = (k: keyof AbstractValues, label: string, opts: { required?: boolean; hint?: string; type?: string; autoComplete?: string } = {}) => (
    <Field id={k} label={label} required={opts.required} error={fe(k)} hint={opts.hint}>
      <input
        id={k}
        name={k}
        type={opts.type ?? "text"}
        autoComplete={opts.autoComplete}
        value={String(v[k] ?? "")}
        onChange={(e) => set(k, e.target.value as never)}
        className={inputClass}
        aria-invalid={Boolean(fe(k))}
        aria-describedby={fe(k) ? `${k}-error` : undefined}
      />
    </Field>
  );

  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-10">
      <ResultBanner state={state} />
      {id && <input type="hidden" name="id" value={id} />}

      <fieldset className="space-y-5">
        <legend className="mb-4 font-display text-xl font-semibold text-ink">Presenting author</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {text("presentingAuthor", "Presenting author's name", { required: true, autoComplete: "name" })}
          {text("email", "Email", { required: true, type: "email", autoComplete: "email" })}
          {text("university", "University", { required: true, autoComplete: "organization" })}
          {text("programmeYear", "Programme and year of study", { required: true, hint: "For example, MBChB Year 3" })}
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-4 font-display text-xl font-semibold text-ink">Your research</legend>
        {text("title", "Abstract title", { required: true })}
        <Field id="coAuthors" label="Co-authors" hint="Names and affiliations, separated by commas or new lines." error={fe("coAuthors")}>
          <textarea id="coAuthors" name="coAuthors" rows={3} value={v.coAuthors} onChange={(e) => set("coAuthors", e.target.value)} className={inputClass} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="category" label="Research category" required error={fe("category")}>
            <select id="category" name="category" value={v.category} onChange={(e) => set("category", e.target.value)} className={inputClass} aria-invalid={Boolean(fe("category"))}>
              <option value="">Choose a category</option>
              {config.categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field id="presentationPreference" label="Presentation preference">
            <select id="presentationPreference" name="presentationPreference" value={v.presentationPreference} onChange={(e) => set("presentationPreference", e.target.value)} className={inputClass}>
              <option value="">No preference</option>
              {config.presentationTypes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 font-display text-xl font-semibold text-ink">Abstract</legend>
        <p className="text-sm text-slate-700">
          Up to {config.sectionWordLimit} words per section and {config.totalWordLimit} words in total. Do not include identifiable patient information.
        </p>
        <p aria-live="polite" className={cn("sticky top-[calc(var(--header-h)+8px)] z-10 w-fit rounded-full px-4 py-2 text-sm font-semibold shadow-sm", total > config.totalWordLimit ? "bg-danger text-white" : "bg-navy text-paper")}>
          {total} / {config.totalWordLimit} words
        </p>
        {ABSTRACT_SECTIONS.map((k) => {
          const n = countWords(v[k]);
          const over = n > config.sectionWordLimit;
          return (
            <Field key={k} id={k} label={SECTION_LABEL[k]} required error={fe(k)}>
              <textarea
                id={k}
                name={k}
                rows={k === "methods" || k === "results" ? 6 : 4}
                value={v[k]}
                onChange={(e) => set(k, e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(fe(k)) || over}
                aria-describedby={`${k}-count${fe(k) ? ` ${k}-error` : ""}`}
              />
              <p id={`${k}-count`} className={cn("mt-1 text-right text-xs", over ? "font-semibold text-danger" : "text-slate")}>
                {n} / {config.sectionWordLimit} words
              </p>
            </Field>
          );
        })}
      </fieldset>

      {config.allowFiles && (
        <Field id="file" label="Supporting file" hint={`Optional. PDF only, up to ${config.maxFileMb} MB.${v.hasFile ? " A file is already attached; uploading a new one replaces it." : ""}`} error={fe("file")}>
          <input id="file" name="file" type="file" accept="application/pdf" className="block w-full text-sm text-slate-700 file:mr-4 file:min-h-11 file:rounded-full file:border-0 file:bg-navy file:px-5 file:font-semibold file:text-paper" />
        </Field>
      )}

      <fieldset className="space-y-4 rounded-xl border border-navy/10 bg-paper p-6">
        <legend className="px-2 font-display text-lg font-semibold text-ink">Consent and declaration</legend>
        {(
          [
            ["consentData", "I consent to INSPIRE storing and processing this submission, including sharing it with reviewers, to run the conference.", true],
            ["declarationOriginal", "I declare that this work is original, that all co-authors have agreed to its submission, and that it contains no identifiable patient data.", true],
            ["consentShowcase", "If accepted, INSPIRE may publish my title, authors and a summary in the public research showcase. (Optional; you can withdraw this later.)", false],
          ] as const
        ).map(([k, label, req]) => (
          <div key={k}>
            <label className="flex items-start gap-3 text-[0.95rem] text-slate-700">
              <input type="checkbox" name={k} checked={v[k]} onChange={(e) => set(k, e.target.checked)} className="mt-1 size-5 shrink-0 accent-electric-600" aria-invalid={Boolean(fe(k))} aria-describedby={fe(k) ? `${k}-error` : undefined} />
              <span>
                {label} {req && <span className="text-danger">*</span>}
              </span>
            </label>
            {fe(k) && <p id={`${k}-error`} className="ml-8 mt-1 text-sm font-medium text-danger">{fe(k)}</p>}
          </div>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="draft" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-navy/20 px-6 font-display font-semibold text-ink hover:border-navy/40 disabled:opacity-60">
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />} Save draft
        </button>
        <button type="submit" name="intent" value="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-6 font-display font-semibold text-paper hover:bg-navy-700 disabled:opacity-60">
          <Send aria-hidden className="size-4" /> Submit abstract
        </button>
      </div>
      <p className="text-sm text-slate">Once submitted, your abstract is locked for review. You can still withdraw it.</p>
    </form>
  );
}
