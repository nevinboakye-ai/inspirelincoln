"use client";
import { useDeferredValue, useId, useMemo, useState, useTransition } from "react";
import { ChevronDown, Download, EyeOff, FileSpreadsheet, Loader2, Mail, NotebookPen, Search, Trash2 } from "lucide-react";
import { removeContact, updateContactNote } from "@/app/portal/card-actions";
import { cardRoles, downloadText, initials, toVCard, type CardData } from "@/lib/card";
import { inputClass } from "@/components/forms/field";
import { LinkedInMark, roleStripe } from "@/components/card/contact-card";
import { VCardButton } from "@/components/card/card-actions";
import { cn } from "@/lib/cn";

export type SavedContact = { contact_id: string; saved_at: string; note: string | null; shared: boolean; card: CardData | null };

const small = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] border border-navy/15 bg-white px-4 font-ui text-sm font-semibold text-ink hover:border-navy/40 disabled:opacity-60";
const savedOn = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });
const csvCell = (v: string | null | undefined) => {
  const s = (v ?? "").replace(/^[=+\-@\t\r]/, "'$&");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Everyone you've saved by scanning their Delegate Card. */
export function PeopleList({ initial }: { initial: SavedContact[] }) {
  const [people, setPeople] = useState(initial);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const query = useDeferredValue(q.trim().toLowerCase());
  const shown = useMemo(
    () =>
      people.filter(
        (p) => !query || [p.card?.full_name, p.card?.institution, p.card?.bio, p.note, ...(p.card ? cardRoles(p.card) : [])].some((v) => v?.toLowerCase().includes(query)),
      ),
    [people, query],
  );
  const sharing = people.filter((p) => p.card);

  const exportVcf = () =>
    downloadText(`inspire-people-ive-met.vcf`, sharing.map((p) => toVCard(p.card!, p.note)).join("\r\n"), "text/vcard;charset=utf-8");
  const exportCsv = () => {
    const head = ["Name", "Roles", "Medical school", "Year", "Email", "LinkedIn", "Presenting", "My note", "Saved on"];
    const rows = people.map((p) => [
      p.card?.full_name ?? "(no longer sharing)",
      p.card ? cardRoles(p.card).join("; ") : "",
      p.card?.institution,
      p.card?.year_of_study,
      p.card?.email,
      p.card?.linkedin_url,
      p.card?.presentation_title,
      p.note,
      savedOn(p.saved_at),
    ]);
    downloadText(`inspire-people-ive-met.csv`, "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  };

  if (!people.length) {
    return (
      <div className="rounded-xl border border-dashed border-navy/20 bg-white p-8 text-center sm:p-10">
        <NotebookPen aria-hidden className="mx-auto size-8 text-electric-600" />
        <h2 className="mt-3 font-display text-xl text-ink">No one saved yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-700">
          When you meet someone, point your phone camera at the QR code on the back of their Delegate Card, then tap <strong>Save to People I&apos;ve met</strong>. They&apos;ll appear here with your notes.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="people-h" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="people-h" className="font-display text-xl text-ink">
          Saved <span className="text-slate">({people.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportVcf} disabled={!sharing.length} className={small}>
            <Download aria-hidden className="size-4" /> All to phone contacts
          </button>
          <button type="button" onClick={exportCsv} className={small}>
            <FileSpreadsheet aria-hidden className="size-4" /> Spreadsheet
          </button>
        </div>
      </div>
      {people.length > 3 && (
        <label className="relative block">
          <span className="sr-only">Search people you&apos;ve met</span>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, school, role or your notes" className={`${inputClass} pl-10`} />
        </label>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {status || (query ? `${shown.length} shown` : "")}
      </p>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy/15 bg-white p-8 text-center text-slate-700">No one matches that search.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <Person
              key={p.contact_id}
              p={p}
              onNote={(note) => setPeople((all) => all.map((x) => (x.contact_id === p.contact_id ? { ...x, note } : x)))}
              onRemove={() => {
                setPeople((all) => all.filter((x) => x.contact_id !== p.contact_id));
                setStatus(`${p.card?.full_name ?? "Contact"} removed.`);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Person({ p, onNote, onRemove }: { p: SavedContact; onNote: (note: string | null) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.note ?? "");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = useId();
  const c = p.card;
  const name = c?.full_name ?? "Someone who's stopped sharing";
  const meta = c ? [c.institution, c.year_of_study].filter(Boolean).join(" · ") : null;

  const saveNote = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      try {
        const res = await updateContactNote({ id: p.contact_id, note: draft });
        if (!res?.ok) return setError(res?.error ?? "Couldn't save your note.");
        onNote(draft.trim() || null);
        setEditing(false);
      } catch {
        setError("Couldn't save your note. Check your connection.");
      }
    });
  };
  const remove = () =>
    start(async () => {
      setError(null);
      try {
        const res = await removeContact(p.contact_id);
        if (!res?.ok) return setError(res?.error ?? "Couldn't remove them.");
        onRemove();
      } catch {
        setError("Couldn't remove them. Check your connection.");
      }
    });

  return (
    <li className="overflow-hidden rounded-xl border border-navy/10 bg-white shadow-[0_1px_2px_rgba(12,24,44,0.06)]">
      <div className="flex">
        <span aria-hidden className={cn("w-1.5 shrink-0", c ? roleStripe(c.roles) : "bg-slate/30")} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3.5 p-4 sm:p-5">
            <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-full font-ui text-sm font-semibold", c ? "bg-navy text-cyan" : "bg-paper-200 text-slate")}>
              {c ? initials(c.full_name) : <EyeOff className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-ink">{name}</h3>
              {meta && <p className="text-sm text-slate-700">{meta}</p>}
              {c && <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold-700">{cardRoles(c).join(" · ")}</p>}
              <p className="mt-1 text-xs text-slate-700">Saved {savedOn(p.saved_at)}</p>
            </div>
            {c && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={`${id}-more`}
                className="-mr-1 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[3px] px-2 font-ui text-sm font-semibold text-electric-600 hover:bg-paper"
              >
                {open ? "Less" : "More"}
                <span className="sr-only"> about {name}</span>
                <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
              </button>
            )}
          </div>

          {c && open && (
            <div id={`${id}-more`} className="space-y-4 border-t border-navy/10 px-4 py-4 sm:px-5">
              {c.presentation_title && (
                <p className="text-sm">
                  <span className="eyebrow block text-slate">Presenting</span>
                  <span className="font-medium text-ink">{c.presentation_title}</span>
                </p>
              )}
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{c.bio || "They haven't added a bio."}</p>
              {(c.linkedin_url || c.email) && (
                <div className="flex flex-wrap gap-2">
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer nofollow" className={small}>
                      <LinkedInMark /> LinkedIn<span className="sr-only"> profile of {name} (opens in a new tab)</span>
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className={cn(small, "min-w-0 max-w-full")}>
                      <Mail aria-hidden className="size-4 shrink-0" /> <span className="truncate">{c.email}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-navy/10 bg-paper/50 px-4 py-3 sm:px-5">
            {editing ? (
              <form onSubmit={saveNote} className="space-y-2">
                <label htmlFor={`${id}-note`} className="text-sm font-semibold text-ink">
                  Your note about {c ? name : "them"}
                </label>
                <textarea id={`${id}-note`} rows={3} maxLength={500} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputClass} autoFocus aria-describedby={`${id}-nh`} />
                <p id={`${id}-nh`} className="text-xs text-slate-700">
                  Only you can see this. {500 - draft.length} characters left.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={pending} className={cn(small, "border-navy bg-navy text-paper hover:bg-navy-700")}>
                    {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save note
                  </button>
                  <button type="button" onClick={() => (setEditing(false), setDraft(p.note ?? ""))} className={small}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className={cn("min-w-0 flex-1 basis-60 whitespace-pre-line text-sm", p.note ? "text-ink" : "italic text-slate-700")}>
                  <span className="sr-only">Your note: </span>
                  {p.note || "No note yet."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(true)} className={small}>
                    <NotebookPen aria-hidden className="size-4" /> {p.note ? "Edit note" : "Add note"}
                  </button>
                  {c && <VCardButton card={c} note={p.note} className="min-h-11 px-4" />}
                  {confirm ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <button type="button" onClick={remove} disabled={pending} className={cn(small, "border-danger/30 text-danger hover:bg-danger/[0.05]")}>
                        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Yes, remove
                      </button>
                      <button type="button" onClick={() => setConfirm(false)} className={small}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirm(true)} className={cn(small, "text-danger")}>
                      <Trash2 aria-hidden className="size-4" /> Remove<span className="sr-only"> {name}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
            {!c && <p className="mt-2 text-xs text-slate-700">They&apos;ve turned off sharing or left, so only your note is kept.</p>}
            {error && (
              <p role="alert" className="mt-2 text-sm font-medium text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
