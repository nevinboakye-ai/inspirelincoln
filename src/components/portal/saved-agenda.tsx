"use client";
import Link from "next/link";
import { AlertTriangle, BookmarkCheck } from "lucide-react";
import { useAgenda } from "@/components/programme/agenda-context";
import type { Session, Workshop } from "@/lib/types";
import { SESSION_CATEGORY_LABEL } from "@/lib/types";
import { findConflicts, formatTime } from "@/lib/time";

export function SavedAgenda({ sessions, workshops }: { sessions: Session[]; workshops: Workshop[] }) {
  const agenda = useAgenda();
  const saved = sessions.filter((s) => agenda.sessions.has(s.id));
  const savedW = workshops.filter((w) => agenda.workshops.has(w.id));
  const conflicts = findConflicts(saved);
  if (!agenda.ready) return <p className="text-sm text-slate">Loading your agenda…</p>;
  return (
    <div className="space-y-6">
      {saved.length === 0 ? (
        <p className="text-slate-700">
          No sessions saved yet.{" "}
          <Link href="/programme" className="font-medium text-electric-600 underline underline-offset-4">Browse the programme</Link>
        </p>
      ) : (
        <ul className="divide-y divide-navy/10">
          {saved.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 py-3">
              <Link href={`/programme?session=${s.slug}`} className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate">
                  {s.startsAt ? formatTime(s.startsAt) : "Time TBC"} · {SESSION_CATEGORY_LABEL[s.category]}
                </span>
                <span className="block truncate font-medium text-ink">{s.title}</span>
              </Link>
              {conflicts.has(s.id) && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-warning">
                  <AlertTriangle aria-hidden className="size-3.5" /> Clash
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {savedW.length > 0 && (
        <div>
          <p className="eyebrow text-slate">Saved workshops</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {savedW.map((w) => (
              <li key={w.id}>
                <Link href={`/workshops/${w.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-paper-200 px-3 py-1.5 text-sm text-ink">
                  <BookmarkCheck aria-hidden className="size-3.5 text-electric-600" /> {w.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/programme?view=agenda" className="inline-flex min-h-11 items-center rounded-full border border-navy/15 px-4 text-sm font-medium text-ink hover:border-navy/40">
        Manage agenda &amp; export
      </Link>
    </div>
  );
}
