"use client";
import { Mic } from "lucide-react";
import { useState } from "react";
import { initials } from "@/lib/card";
import type { OralPresenter } from "@/lib/types";

/**
 * The delegates who presented their own research in the oral sessions. Kept
 * visibly apart from the invited speakers: its own section, heading and
 * card style, a round photo instead of a portrait, and no speaker page.
 */
export function OralPresenters({ presenters }: { presenters: OralPresenter[] }) {
  return (
    <section id="oral-presenters" aria-labelledby="oral-presenters-title" className="scroll-mt-24 border-t-4 border-gold bg-paper-200 py-16 sm:py-24">
      <div className="container-page">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end">
          <div>
            <p className="eyebrow text-gold-700">Student research</p>
            <h2 id="oral-presenters-title" className="mt-3 text-display-md font-normal text-ink">
              Oral <span className="italic">presenters</span>
            </h2>
          </div>
          <div className="rounded-[3px] border border-gold/50 bg-white/70 p-5 text-slate-700">
            <p className="leading-relaxed">
              Medical students selected through our abstract review to present their own research in the oral presentation sessions.
            </p>
            <p className="mt-3 text-sm font-semibold text-gold-700">
              They are delegates presenting their own work. They are not invited speakers and are not connected to the invited speaker programme.
            </p>
          </div>
        </div>
        <p className="mt-10 text-sm text-slate">
          {presenters.length} oral presenter{presenters.length === 1 ? "" : "s"}
        </p>
        <ul className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {presenters.map((p) => (
            <li key={p.id}>
              <PresenterCard p={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PresenterCard({ p }: { p: OralPresenter }) {
  const meta = [p.institution, p.yearOfStudy].filter(Boolean).join(", ");
  const where = [p.roomName, p.talk ? `talk ${p.talk}` : null].filter(Boolean).join(", ");
  return (
    <article className="flex h-full flex-col rounded-[3px] border border-navy/10 border-l-4 border-l-gold bg-white p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <Photo url={p.photoUrl} name={p.fullName} />
        <div className="min-w-0">
          <h3 className="font-display text-xl font-medium leading-tight text-ink">{p.fullName}</h3>
          {meta && <p className="mt-1 text-sm text-slate-700">{meta}</p>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-gold-700">
          <Mic aria-hidden className="size-3.5" />
          Oral presentation
        </span>
        {where && <span className="text-xs text-slate">{where}</span>}
      </div>
      {p.presentationTitle && <p className="mt-3 font-display text-lg italic leading-snug text-ink">&ldquo;{p.presentationTitle}&rdquo;</p>}
      {p.bio && <Bio text={p.bio} />}
    </article>
  );
}

/** Their profile photo. The link lasts an hour, so fall back to initials if it has run out. */
function Photo({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  const box = "size-20 shrink-0 rounded-full ring-2 ring-gold ring-offset-2 ring-offset-white";
  if (url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`Photo of ${name}`} loading="lazy" decoding="async" onError={() => setBroken(true)} className={`${box} object-cover`} />;
  }
  return (
    <span aria-hidden className={`${box} grid place-items-center bg-gold/20 font-ui text-lg font-semibold text-gold-700`}>
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
