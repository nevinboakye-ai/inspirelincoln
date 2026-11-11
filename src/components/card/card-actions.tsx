"use client";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { ArrowRight, BookmarkCheck, BookmarkPlus, CheckCircle2, Contact, Loader2, RotateCcw, ScanLine, TriangleAlert, UserCheck } from "lucide-react";
import { saveContact, updateContactNote } from "@/app/portal/card-actions";
import { checkInPerson, undoCheckIn } from "@/app/admin/checkin/actions";
import { downloadText, fileSafe, toVCard, type CardData, type CheckInOutcome, type CheckinInfo } from "@/lib/card";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";

const NOTE_MAX = 500;
const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] bg-navy px-5 font-ui text-sm font-semibold text-paper hover:bg-navy-700 disabled:opacity-60";
const secondary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] border border-navy/15 bg-white px-5 font-ui text-sm font-semibold text-ink hover:border-navy/40 disabled:opacity-60";

export function VCardButton({ card, note, className }: { card: CardData; note?: string | null; className?: string }) {
  return (
    <button type="button" onClick={() => downloadText(`${fileSafe(card.full_name)}.vcf`, toVCard(card, note), "text/vcard;charset=utf-8")} className={cn(secondary, className)}>
      <Contact aria-hidden className="size-4" /> Add to phone contacts
    </button>
  );
}

/** Save someone to People I've met, with a private note. */
export function SaveContact({ code, card, saved: wasSaved, note: savedNote }: { code: string; card: CardData; saved: boolean; note: string | null }) {
  const [saved, setSaved] = useState(wasSaved);
  const [note, setNote] = useState(savedNote ?? "");
  const [lastNote, setLastNote] = useState(savedNote ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const id = useId();
  const first = card.full_name?.split(" ")[0] ?? "them";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      try {
        const res = saved ? await updateContactNote({ id: card.id, note }) : await saveContact({ code, note });
        if (res?.ok) {
          setSaved(true);
          setLastNote(note.trim());
          setMsg({ ok: true, text: saved ? (res.message ?? "Saved.") : `${first} is saved to People I've met.` });
        } else setMsg({ ok: false, text: res?.error ?? "That didn't work. Please try again." });
      } catch {
        setMsg({ ok: false, text: "That didn't work. Check your connection and try again." });
      }
    });
  };

  const changed = note.trim() !== lastNote;
  return (
    <form onSubmit={submit} className="space-y-4 border-t border-navy/10 bg-paper/60 px-6 py-6 sm:px-8" aria-describedby={`${id}-status`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-full", saved ? "bg-success/10 text-success" : "bg-navy/5 text-navy")}>
          {saved ? <BookmarkCheck className="size-5" /> : <BookmarkPlus className="size-5" />}
        </span>
        <div>
          <h2 className="font-display text-lg text-ink">{saved ? "In your People I've met" : `Save ${first} for later`}</h2>
          <p className="text-sm text-slate-700">{saved ? "Add or change your note any time." : "Keep their card with a note, so you can follow up after the conference."}</p>
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-note`} className="text-sm font-semibold text-ink">
          Private note <span className="font-normal text-slate">(optional)</span>
        </label>
        <textarea
          id={`${id}-note`}
          rows={3}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Where you met, what you talked about"
          className={cn(inputClass, "mt-1.5")}
          aria-describedby={`${id}-hint`}
        />
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-700">
          Only you can see this. {NOTE_MAX - note.length} characters left.
        </p>
      </div>
      <p id={`${id}-status`} role="status" aria-live="polite" className={cn("text-sm font-medium empty:hidden", msg?.ok ? "text-success" : "text-danger")}>
        {msg?.text}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="submit" disabled={pending || (saved && !changed)} className={primary}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : saved ? null : <BookmarkPlus aria-hidden className="size-4" />}
          {saved ? (changed ? "Save note" : "Note saved") : "Save to People I've met"}
        </button>
        <VCardButton card={card} note={lastNote} />
        {saved && (
          <Link href="/portal/people" className="inline-flex min-h-12 items-center justify-center gap-1.5 px-2 font-ui text-sm font-semibold text-electric-600 underline-offset-4 hover:underline">
            People I&apos;ve met <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </form>
  );
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });

/** Why someone can't be checked in, in words for the desk. */
export function outcomeText(o: CheckInOutcome, name: string) {
  switch (o.result) {
    case "checked_in":
      return `${name} is checked in. Welcome them in.`;
    case "already":
      return `${name} was already checked in${o.person?.checked_in_at ? ` at ${time(o.person.checked_in_at)}` : ""}${o.person?.checked_in_by ? ` by ${o.person.checked_in_by}` : ""}.`;
    case "not_approved":
      return `${name}'s account isn't approved (${o.person?.account_status ?? "pending"}), so they don't have a confirmed place. Send them to the help desk.`;
    case "no_event":
      return "No conference is set as the current one, so no one can be checked in yet.";
    case "unknown":
      return "We don't recognise this code. It may have been replaced with a newer one. Search by name instead.";
    case "undone":
      return `${name}'s check-in has been undone.`;
    default:
      return `${name}'s registration is ${o.result.replace("registration_", "")}, not confirmed. Send them to the help desk.`;
  }
}

/** Shown to check-in staff when they scan someone's card with their phone camera. */
export function CheckInPanel({ info }: { info: CheckinInfo }) {
  const [person, setPerson] = useState(info);
  const [outcome, setOutcome] = useState<CheckInOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = person.full_name ?? "This person";
  const first = person.full_name?.split(" ")[0] ?? "them";
  const inAt = person.checked_in_at;
  const approved = person.account_status === "approved";

  const run = (fn: () => Promise<{ ok: true; data: CheckInOutcome } | { ok: false; error: string }>) =>
    start(async () => {
      setError(null);
      try {
        const res = await fn();
        if (!res.ok) return setError(res.error);
        setOutcome(res.data);
        if (res.data.person) setPerson((p) => ({ ...p, ...res.data.person }));
        if (res.data.result === "checked_in") navigator.vibrate?.(60);
      } catch {
        setError("Check-in didn't go through. Check your connection and try again.");
      }
    });

  const good = outcome?.result === "checked_in";
  return (
    <section aria-labelledby="desk-h" className="overflow-hidden rounded-2xl border-2 border-electric-600/30 bg-white">
      <div className="flex items-center justify-between gap-3 bg-electric-600/[0.07] px-5 py-3">
        <h2 id="desk-h" className="flex items-center gap-2 font-ui text-sm font-semibold text-ink">
          <ScanLine aria-hidden className="size-4 text-electric-600" /> Check-in desk
        </h2>
        <Link href="/admin/checkin" className="text-sm font-semibold text-electric-600 underline-offset-4 hover:underline">
          Open the scanner
        </Link>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-ink">{name}</span>
          {person.institution ? `, ${person.institution}` : ""}
        </p>
        <div role="status" aria-live="polite" className="empty:hidden">
          {error ? (
            <p className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger/[0.06] p-3 text-sm font-medium text-danger">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          ) : outcome ? (
            <p className={cn("flex items-start gap-2 rounded-md border p-3 text-sm font-medium", good || outcome.result === "undone" ? "border-success/30 bg-success/[0.07] text-success" : "border-warning/30 bg-warning/[0.07] text-ink")}>
              {good ? <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /> : <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />}
              {outcomeText(outcome, first)}
            </p>
          ) : null}
        </div>
        {!outcome && (
          <p className="text-sm text-slate-700">
            {!approved
              ? `Their account is ${person.account_status}, so they don't have a confirmed place yet.`
              : inAt
                ? `Checked in at ${time(inAt)} on ${day(inAt)}${person.checked_in_by ? ` by ${person.checked_in_by}` : ""}.`
                : "Not checked in yet."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {approved && !inAt && (
            <button type="button" onClick={() => run(() => checkInPerson(person.id))} disabled={pending} className={cn(primary, "min-h-14 flex-1 bg-success text-base hover:bg-success/90 sm:flex-none")}>
              {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <UserCheck aria-hidden className="size-5" />} Check in {first}
            </button>
          )}
          {inAt && (
            <button type="button" onClick={() => run(() => undoCheckIn(person.id))} disabled={pending} className={secondary}>
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />} Undo check-in
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
