"use client";
import { Mic, Presentation } from "lucide-react";
import { useState } from "react";
import { initials } from "@/lib/card";
import { cn } from "@/lib/cn";
import type { StudentPresenter } from "@/lib/types";

const KIND = {
  oral: { group: "Oral presenters", label: "Oral presentation", Icon: Mic, accent: "border-l-gold", pill: "bg-gold/15 text-gold-700", ring: "ring-gold", fallback: "bg-gold/20 text-gold-700" },
  poster: { group: "Poster presenters", label: "Poster presentation", Icon: Presentation, accent: "border-l-navy-600", pill: "bg-cyan/50 text-navy", ring: "ring-navy-600", fallback: "bg-cyan/50 text-navy" },
} as const;

/**
 * The delegates who presented their own research, on the Presenters page:
 * oral presenters first, then poster presenters, each in their own group.
 */
export function StudentPresenters({ presenters }: { presenters: StudentPresenter[] }) {
  const groups = (["oral", "poster"] as const)
    .map((kind) => ({ kind, people: presenters.filter((p) => p.kind === kind) }))
    .filter((g) => g.people.length > 0);
  return (
    <section aria-label="Student presenters" className="bg-paper py-16 sm:py-24">
      <div className="container-page space-y-16 sm:space-y-20">
        {groups.map(({ kind, people }) => (
          <div key={kind} id={kind === "oral" ? "oral-presenters" : "poster-presenters"} className="scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-navy/10 pb-4">
              <h2 className="text-display-sm font-normal text-ink">{KIND[kind].group}</h2>
              <p className="text-sm text-slate">
                {people.length} {kind} presenter{people.length === 1 ? "" : "s"}
              </p>
            </div>
            <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {people.map((p) => (
                <li key={`${kind}-${p.id}`}>
                  <PresenterCard p={p} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function PresenterCard({ p }: { p: StudentPresenter }) {
  const k = KIND[p.kind];
  const meta = [p.institution, p.yearOfStudy].filter(Boolean).join(", ");
  const where = [p.roomName, p.talk ? `talk ${p.talk}` : null].filter(Boolean).join(", ");
  return (
    <article className={cn("flex h-full flex-col rounded-[3px] border border-l-4 border-navy/10 bg-white p-5 sm:p-6", k.accent)}>
      <div className="flex items-center gap-4">
        <Photo url={p.photoUrl} name={p.fullName} ring={k.ring} fallback={k.fallback} />
        <div className="min-w-0">
          <h3 className="font-display text-xl font-medium leading-tight text-ink">{p.fullName}</h3>
          {meta && <p className="mt-1 text-sm text-slate-700">{meta}</p>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]", k.pill)}>
          <k.Icon aria-hidden className="size-3.5" />
          {k.label}
        </span>
        {where && <span className="text-xs text-slate">{where}</span>}
      </div>
      {p.presentationTitle && <p className="mt-3 font-display text-lg italic leading-snug text-ink">&ldquo;{p.presentationTitle}&rdquo;</p>}
      {p.bio && <Bio text={p.bio} />}
    </article>
  );
}

/** Their profile photo. The link lasts an hour, so fall back to initials if it has run out. */
function Photo({ url, name, ring, fallback }: { url: string | null; name: string; ring: string; fallback: string }) {
  const [broken, setBroken] = useState(false);
  const box = cn("size-20 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-white", ring);
  if (url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`Photo of ${name}`} loading="lazy" decoding="async" onError={() => setBroken(true)} className={cn(box, "object-cover")} />;
  }
  return (
    <span aria-hidden className={cn(box, "grid place-items-center font-ui text-lg font-semibold", fallback)}>
      {initials(name)}
    </span>
  );
}

function Bio({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220;
  return (
    <div className="mt-4 border-t border-navy/10 pt-4">
      <p className={`whitespace-pre-line text-sm leading-relaxed text-slate-700 ${long && !open ? "line-clamp-4" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 min-h-11 text-sm font-semibold text-electric-600 underline-offset-4 hover:underline">
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
