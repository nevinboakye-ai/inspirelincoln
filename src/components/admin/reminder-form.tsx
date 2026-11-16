"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { CalendarClock, Eye, Loader2, Send, X } from "lucide-react";
import { listReminderRecipients, previewReminder, sendReminders, type ReminderRow } from "@/app/admin/reminder-actions";
import type { ActionResult } from "@/app/portal/actions";
import { ResultBanner } from "@/components/portal/profile-forms";
import { Field, inputClass } from "@/components/forms/field";
import { Badge } from "@/components/ui/badge";
import { submitWithoutReset } from "@/lib/use-action-form";
import { REMINDER_KINDS, formatDeadline, type ReminderKind, type TaskKey } from "@/lib/email/reminders";
import { cn } from "@/lib/cn";
import { btn } from "./ui";

/** Short names for the task chips in the list. */
const CHIP: Record<TaskKey, string> = {
  sign_in: "Sign in",
  attend: "Confirm attending",
  upload: "Upload",
  resubmit: "Re-upload",
  bio: "Bio",
  bio_short: "Bio too short",
  photo: "Photo",
  details: "University",
  workshops: "Workshops",
  travel: "Travel",
};

/**
 * Deadline reminders: pick which reminder, set the deadline, check who gets
 * it and what each person's list says, preview, then send. Each person only
 * sees their own outstanding tasks.
 */
export function ReminderForm() {
  const [kind, setKind] = useState<ReminderKind>("final");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("21:00");
  const [note, setNote] = useState("");
  const [people, setPeople] = useState<ReminderRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<{ who: string; subject: string; html: string } | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionResult, FormData>(sendReminders, null);

  useEffect(() => {
    let live = true;
    listReminderRecipients(kind).then((r) => {
      if (!live) return;
      setLoading(false);
      setPeople(r.ok ? r.people : []);
      setLoadError(r.ok ? null : r.error);
      if (r.ok && r.suggested) setDate((d) => d || r.suggested!.date);
      if (r.ok && r.suggested) setTime((t) => (t === "21:00" ? r.suggested!.time : t));
    });
    return () => {
      live = false;
    };
  }, [kind, state]);

  const all = useMemo(() => people ?? [], [people]);
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((p) => [p.name, p.email, p.detail].some((v) => v.toLowerCase().includes(q))) : all;
  const sending = all.filter((p) => !excluded.has(p.email));
  const deadline = date ? formatDeadline(date, time) : null;
  const counts = useMemo(() => {
    const c = new Map<TaskKey, number>();
    for (const p of all) if (!excluded.has(p.email)) for (const t of p.tasks) c.set(t.key, (c.get(t.key) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [all, excluded]);

  const flip = (email: string) => {
    const next = new Set(excluded);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setExcluded(next);
    setConfirming(false);
  };

  const show = async (email: string | null, who: string) => {
    setPreviewing(email ?? "sample");
    const r = await previewReminder({ kind, email, date, time, note });
    setPreviewing(null);
    if (r.ok) setPreview({ who, subject: r.subject, html: r.html });
    else setLoadError(r.error);
  };

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-6" onChange={() => setConfirming(false)}>
      <ResultBanner state={state} />
      <input type="hidden" name="kind" value={kind} />
      {[...excluded].map((e) => <input key={e} type="hidden" name="exclude" value={e} />)}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Which reminder?</legend>
        <div className="grid gap-2 lg:grid-cols-3">
          {REMINDER_KINDS.map((k) => (
            <label
              key={k.id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-4 text-sm transition-colors",
                kind === k.id ? "border-navy bg-paper ring-1 ring-navy" : "border-navy/15 bg-white hover:border-navy/40",
              )}
            >
              <input type="radio" name="reminder-kind" checked={kind === k.id} onChange={() => {
                  setKind(k.id);
                  setLoading(true);
                  setExcluded(new Set());
                  setPreview(null);
                }} className="mt-0.5 size-4 shrink-0 accent-navy" />
              <span>
                <span className="block font-semibold text-ink">{k.name}</span>
                <span className="text-slate-700">{k.use}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-lg border border-gold-600/40 bg-gold/10 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CalendarClock aria-hidden className="size-4 text-gold-700" /> Deadline
        </p>
        <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-3 sm:max-w-md">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">Date</span>
            <input type="date" name="date" required value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputClass, "py-2.5")} aria-invalid={Boolean(state?.fieldErrors?.date)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">Time (UK)</span>
            <input type="time" name="time" value={time} onChange={(e) => setTime(e.target.value)} className={cn(inputClass, "py-2.5")} />
          </label>
        </div>
        <p className="mt-2 text-sm text-slate-700" aria-live="polite">
          {deadline ? <>Emails will say: <strong className="text-ink">Please complete by {deadline}</strong></> : "Choose the date people need to finish by."}
        </p>
        {state?.fieldErrors?.date && <p className="mt-2 text-sm font-medium text-danger">{state.fieldErrors.date}</p>}
      </div>

      <Field id="reminder-note" label="Add a line from the committee" error={state?.fieldErrors?.note} hint="Shown in everyone's email after the introduction. For example, a reason it matters this year.">
        <textarea id="reminder-note" name="note" rows={3} maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </Field>

      <section aria-labelledby="reminder-recipients" className="rounded-xl border border-navy/15 bg-paper/60">
        <div className="p-4" aria-live="polite">
          <h3 id="reminder-recipients" className="font-semibold text-ink">
            {people === null ? "Finding who still has tasks to do" : `${sending.length} ${sending.length === 1 ? "person" : "people"} will get this`}
            {loading && <Loader2 aria-label="Updating" className="ml-2 inline size-4 animate-spin text-slate" />}
          </h3>
          {people !== null && !loadError && (
            <p className="mt-1 text-sm text-slate-700">
              {all.length ? "Each email lists only that person's own tasks. Untick anyone you want to leave out." : kind === "final" ? "Everyone with a place has finished their tasks. Nobody needs this reminder." : kind === "sign_in" ? "Everyone with a place has signed in. Nobody needs this reminder." : "Every presenter has finished their tasks. Nobody needs this reminder."}
            </p>
          )}
          {counts.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tasks outstanding">
              {counts.map(([k, n]) => (
                <li key={k}><Badge tone={k === "sign_in" || k === "upload" || k === "resubmit" ? "warning" : "neutral"}>{CHIP[k]}: {n}</Badge></li>
              ))}
            </ul>
          )}
        </div>
        {loadError && <p className="px-4 pb-4 text-sm font-medium text-danger">{loadError}</p>}
        {all.length > 0 && (
          <div className="border-t border-navy/10">
            <div className="flex flex-wrap items-center gap-2 p-3">
              <label htmlFor="reminder-search" className="sr-only">Search the list</label>
              <input
                id="reminder-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder="Search by name, email or university"
                className="min-h-10 min-w-0 flex-1 rounded-[3px] border border-navy/15 bg-white px-3 text-sm"
              />
              {excluded.size > 0 && (
                <button type="button" onClick={() => setExcluded(new Set())} className="min-h-10 px-2 text-sm font-semibold text-electric-600">Tick everyone again</button>
              )}
            </div>
            <ul className="max-h-[28rem] divide-y divide-navy/5 overflow-y-auto bg-white">
              {shown.map((p) => {
                const on = !excluded.has(p.email);
                return (
                  <li key={p.email} className={cn("flex items-start gap-3 px-4 py-3", !on && "bg-paper/70")}>
                    <input type="checkbox" checked={on} onChange={() => flip(p.email)} aria-label={`Send to ${p.name}`} className="mt-1 size-4 shrink-0 accent-navy" />
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-medium text-ink", !on && "text-slate line-through")}>
                        {p.name}
                        {!p.joined && <Badge tone="warning" className="ml-2 align-middle">No account yet</Badge>}
                      </p>
                      <p className="break-all text-xs text-slate">{[p.email, p.detail].filter(Boolean).join(" · ")}</p>
                      <ul className="mt-2 flex flex-wrap gap-1" aria-label="Outstanding tasks">
                        {p.tasks.map((t) => (
                          <li key={t.key + t.title} className="rounded-full bg-paper-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">{CHIP[t.key]}</li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => show(p.email, p.name)}
                      disabled={previewing !== null}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-[3px] px-2 text-sm font-semibold text-electric-600 hover:bg-paper disabled:opacity-60"
                    >
                      {previewing === p.email ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Eye aria-hidden className="size-4" />}
                      <span className="sr-only sm:not-sr-only">Preview</span>
                    </button>
                  </li>
                );
              })}
              {!shown.length && <li className="px-4 py-6 text-center text-sm text-slate-700">Nobody in the list matches &ldquo;{query}&rdquo;.</li>}
            </ul>
          </div>
        )}
      </section>

      {preview ? (
        <section aria-label="Email preview" className="overflow-hidden rounded-xl border border-navy/15 bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-navy/10 bg-paper p-3">
            <div className="min-w-0 text-sm">
              <p className="text-slate">Preview for {preview.who}</p>
              <p className="font-semibold text-ink">{preview.subject}</p>
            </div>
            <button type="button" onClick={() => setPreview(null)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-[3px] text-slate-700 hover:bg-white" aria-label="Close preview">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <iframe title={`Email preview for ${preview.who}`} srcDoc={preview.html} sandbox="" className="h-[42rem] w-full bg-paper" />
        </section>
      ) : (
        <button type="button" onClick={() => show(null, "a sample person")} disabled={previewing !== null} className={btn.secondary}>
          {previewing === "sample" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Eye aria-hidden className="size-4" />} Preview the email
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-navy/10 pt-5">
        <button name="intent" value="test" disabled={pending || !date} className={btn.secondary}>Send me a test</button>
        {confirming ? (
          <>
            <button name="intent" value="send" disabled={pending || !sending.length || !date} className={btn.primary}>
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />} Yes, send to {sending.length} {sending.length === 1 ? "person" : "people"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-11 px-3 text-sm font-medium text-slate-700">Cancel</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} disabled={pending || !sending.length || !date} className={btn.primary}>
            <Send aria-hidden className="size-4" /> Send to {sending.length} {sending.length === 1 ? "person" : "people"}
          </button>
        )}
      </div>
      {confirming && (
        <p className="text-sm text-slate-700">
          Emails can&apos;t be recalled. Anyone who hasn&apos;t signed in gets their login details, with a new temporary password if they haven&apos;t chosen their own, and people on the selected list without an account get one.
        </p>
      )}
    </form>
  );
}
