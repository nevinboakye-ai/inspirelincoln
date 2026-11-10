"use client";
import { submitWithoutReset } from "@/lib/use-action-form";
import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { saveSettings, setCurrentEdition } from "@/app/admin/actions";
import { Field, inputClass } from "@/components/forms/field";
import { ResultBanner } from "@/components/portal/profile-forms";
import { toZonedInputValue } from "@/lib/time";
import { btn } from "./ui";

type Row = Record<string, unknown>;

export function SettingsForm({ row }: { row: Row }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  const cfg = (row.abstract_config ?? {}) as Row;
  const fe = (k: string) => state?.fieldErrors?.[k];
  const s = (k: string) => (row[k] == null ? "" : String(row[k]));
  const L = (v: unknown) => (Array.isArray(v) ? v.join("\n") : "");
  const input = (k: string, label: string, o: { type?: string; hint?: string; required?: boolean; def?: string; wide?: boolean } = {}) => (
    <Field id={k} label={label} hint={o.hint} required={o.required} error={fe(k)} className={o.wide ? "sm:col-span-2" : ""}>
      <input id={k} name={k} type={o.type ?? "text"} defaultValue={o.def ?? s(k)} className={inputClass} aria-invalid={Boolean(fe(k))} />
    </Field>
  );
  const area = (k: string, label: string, def: string, hint?: string) => (
    <Field id={k} label={label} hint={hint} error={fe(k)} className="sm:col-span-2">
      <textarea id={k} name={k} rows={4} defaultValue={def} className={inputClass} />
    </Field>
  );
  const check = (k: string, label: string, on: boolean, hint?: string) => (
    <label className="flex items-start gap-3 text-sm text-slate-700 sm:col-span-2">
      <input type="checkbox" name={k} defaultChecked={on} className="mt-0.5 size-5 shrink-0 accent-electric-600" />
      <span><span className="font-medium text-ink">{label}</span>{hint && <span className="block text-slate">{hint}</span>}</span>
    </label>
  );
  const section = (title: string, children: React.ReactNode) => (
    <fieldset className="rounded-xl border border-navy/10 bg-white p-6 sm:p-8">
      <legend className="sr-only">{title}</legend>
      <h2 aria-hidden className="mb-5 font-display text-lg font-semibold text-ink">{title}</h2>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );

  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-6">
      <ResultBanner state={state} />
      <input type="hidden" name="id" value={s("id")} />
      {section("Status and registration", <>
        <Field id="status" label="Conference status" error={fe("status")} hint="Controls calls to action across the site.">
          <select id="status" name="status" defaultValue={s("status")} className={inputClass}>
            <option value="">Not set (no registration call to action)</option>
            <option value="registration_soon">Registration opening soon</option>
            <option value="registration_open">Registration open</option>
            <option value="registration_closed">Registration closed</option>
            <option value="underway">Conference underway</option>
            <option value="concluded">Conference concluded</option>
          </select>
        </Field>
        {input("registration_url", "Registration link", { type: "url", hint: "Must start with https://" })}
        {input("registration_note", "Registration note", { wide: true, hint: "Short note shown next to the registration button, e.g. pricing or eligibility." })}
        {check("event_day_mode", "Event-day mode", Boolean(row.event_day_mode), "Shows live 'now and next', the day-of page and quick links on the homepage.")}
        {check("post_event_mode", "Post-conference mode", Boolean(row.post_event_mode), "Switches the homepage to a thank-you and highlights state.")}
      </>)}
      {section("Event details", <>
        {input("name", "Conference name", { required: true, wide: true })}
        {input("theme", "Theme", { required: true, wide: true })}
        {area("theme_statement", "Theme statement", s("theme_statement"))}
        {input("event_date", "Date", { type: "date", required: true })}
        {input("expected_attendance", "Expected attendance", { type: "number", hint: "Shown as a projected figure." })}
        {input("start_time", "Start time (UK)", { type: "time", def: s("start_time").slice(0, 5), hint: "Leave empty until confirmed." })}
        {input("end_time", "End time (UK)", { type: "time", def: s("end_time").slice(0, 5) })}
      </>)}
      {section("Venue", <>
        {input("venue_name", "Venue", { required: true })}
        {input("venue_institution", "Institution")}
        {input("venue_address", "Address", { wide: true })}
        {area("venue_notes", "Venue notes", s("venue_notes"), "Arrival, accessibility or parking notes.")}
      </>)}
      {section("Posters", <>
        {input("poster_deadline", "Poster upload deadline", { type: "date" })}
        {area("poster_requirements", "Poster requirements", L(row.poster_requirements), "One per line.")}
      </>)}
      {section("Abstract submissions", <>
        {check("submissions_open", "Accept new abstract submissions", Boolean(cfg.submissionsOpen))}
        {input("opens_at", "Opens (UK time)", { type: "datetime-local", def: toZonedInputValue(cfg.opensAt as string | null), hint: "Displayed for information." })}
        {input("closes_at", "Closes (UK time)", { type: "datetime-local", def: toZonedInputValue(cfg.closesAt as string | null), hint: "Close submissions by unticking the box above." })}
        {input("section_word_limit", "Word limit per section", { type: "number", def: String(cfg.sectionWordLimit ?? 150) })}
        {input("total_word_limit", "Total word limit", { type: "number", def: String(cfg.totalWordLimit ?? 300) })}
        {check("allow_files", "Allow a supporting PDF", Boolean(cfg.allowFiles))}
        {input("max_file_mb", "Maximum file size (MB)", { type: "number", def: String(cfg.maxFileMb ?? 10) })}
        {area("categories", "Research categories", L(cfg.categories), "One per line.")}
        {area("presentation_types", "Presentation types", L(cfg.presentationTypes), "One per line.")}
        {area("eligibility", "Eligibility", L(cfg.eligibility), "One per line.")}
        {area("formatting", "Formatting guidance", L(cfg.formatting), "One per line.")}
      </>)}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <button type="submit" disabled={pending} className={`${btn.primary} shadow-lg`}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />} Save settings
        </button>
      </div>
    </form>
  );
}

export function CurrentEditionForm({ editions, current }: { editions: { id: string; name: string }[]; current: string }) {
  const [state, action, pending] = useActionState(setCurrentEdition, null);
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-wrap items-end gap-3">
      <ResultBanner state={state} />
      <Field id="edition" label="Current edition">
        <select id="edition" name="edition" defaultValue={current} className={inputClass}>
          {editions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </Field>
      <button type="submit" disabled={pending} className={btn.secondary}>Switch</button>
    </form>
  );
}
