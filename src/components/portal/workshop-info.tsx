"use client";
import Link from "next/link";
import { ArrowRight, Check, Pencil, Target, UserRound, Users } from "lucide-react";
import { WorkshopTextEditor } from "@/components/conference/workshop-text-editor";
import { workshopColour } from "@/lib/workshops/colours";

export type InfoWorkshop = {
  id: string;
  number: number;
  slug: string;
  title: string;
  strapline: string | null;
  summary: string | null;
  description: string | null;
  topics: string[];
  outcomes: string[];
  audience: string | null;
  facilitator: string | null;
  room: string | null;
};

/** The overlaid card with everything about one workshop, and an editor for committee members. */
export function WorkshopInfo({
  w,
  titleId,
  editing,
  canEdit,
  onEdit,
  onDoneEditing,
  note,
}: {
  w: InfoWorkshop;
  titleId: string;
  editing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDoneEditing: () => void;
  /** A line about this person and the workshop, such as where they ranked it. */
  note?: string | null;
}) {
  const c = workshopColour(w.number);
  return (
    <>
      <div className="relative shrink-0 px-6 pb-5 pt-6 pr-16 text-white" style={{ background: c.solid }}>
        <p className="font-ui text-xs font-semibold uppercase tracking-[0.16em] text-white">
          Workshop {w.number}
          {w.room ? ` · ${w.room}` : ""}
        </p>
        <h3 id={titleId} className="mt-2 font-display text-2xl leading-tight">
          {editing ? `Edit ${w.title}` : w.title}
        </h3>
        {!editing && w.strapline && <p className="mt-1.5 text-white">{w.strapline}</p>}
      </div>
      <div tabIndex={0} aria-label="Workshop details" className="min-h-0 flex-1 overflow-y-auto px-6 py-5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-electric/30">
        {editing ? (
          <WorkshopTextEditor workshop={w} onDone={onDoneEditing} onCancel={onDoneEditing} />
        ) : (
          <div className="space-y-5 text-[0.95rem] leading-relaxed text-slate-700">
            {(w.description || w.summary) && <p className="text-ink">{w.description || w.summary}</p>}
            {w.topics.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 font-semibold text-ink">
                  <Target aria-hidden className="size-4" style={{ color: c.solid }} /> What you&apos;ll cover
                </h4>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {w.topics.map((t) => (
                    <li key={t} className="rounded-full px-3 py-1 text-sm text-ink" style={{ background: c.tint }}>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {w.outcomes.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink">You&apos;ll leave able to</h4>
                <ul className="mt-2 space-y-1.5">
                  {w.outcomes.map((o) => (
                    <li key={o} className="flex gap-2">
                      <Check aria-hidden className="mt-1 size-4 shrink-0" style={{ color: c.solid }} />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {w.audience && (
              <p className="flex gap-2">
                <Users aria-hidden className="mt-1 size-4 shrink-0" style={{ color: c.solid }} />
                <span>
                  <span className="font-semibold text-ink">Who it&apos;s for: </span>
                  {w.audience}
                </span>
              </p>
            )}
            <p className="flex gap-2">
              <UserRound aria-hidden className="mt-1 size-4 shrink-0" style={{ color: c.solid }} />
              <span>
                <span className="font-semibold text-ink">Facilitator: </span>
                {w.facilitator ?? "To be announced"}
              </span>
            </p>
          </div>
        )}
      </div>
      {!editing && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-navy/10 px-6 py-4">
          {note && <p className="w-full text-sm font-semibold text-ink">{note}</p>}
          <Link href={`/workshops/${w.slug}`} className="inline-flex min-h-12 items-center gap-1 px-1 text-sm font-semibold text-electric-600 underline-offset-4 hover:underline">
            Full workshop page <ArrowRight aria-hidden className="size-3.5" />
          </Link>
          {canEdit && (
            <button type="button" onClick={onEdit} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-[3px] border border-navy/20 px-4 text-sm font-semibold text-ink hover:bg-paper-200">
              <Pencil aria-hidden className="size-4" /> Edit wording
            </button>
          )}
        </div>
      )}
    </>
  );
}
