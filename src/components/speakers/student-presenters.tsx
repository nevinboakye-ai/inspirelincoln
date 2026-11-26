"use client";
import { AnimatePresence, m } from "motion/react";
import { ArrowUpRight, MapPin, Mic, Presentation } from "lucide-react";
import { useId, useState } from "react";
import { initials } from "@/lib/card";
import { cn } from "@/lib/cn";
import type { StudentPresenter } from "@/lib/types";
import { CardDeck } from "@/components/ui/card-deck";
import { Overlay } from "@/components/ui/overlay";

type Kind = StudentPresenter["kind"];

const KIND = {
  oral: {
    tab: "Oral presenters",
    short: "Talks",
    label: "Oral presentation",
    Icon: Mic,
    band: "from-gold-600 via-gold to-gold-300",
    pill: "bg-gold/15 text-gold-700",
    ring: "ring-gold",
    fallback: "bg-gold-300 text-midnight",
    dot: "bg-gold",
    count: (n: number) => `${n} talk${n === 1 ? "" : "s"}`,
  },
  poster: {
    tab: "Poster presenters",
    short: "Posters",
    label: "Poster presentation",
    Icon: Presentation,
    band: "from-midnight via-navy to-navy-600",
    pill: "bg-cyan/50 text-navy",
    ring: "ring-cyan",
    fallback: "bg-cyan text-navy",
    dot: "bg-navy",
    count: (n: number) => `${n} poster${n === 1 ? "" : "s"}`,
  },
} as const;

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The delegates who presented their own research, as cards. One group at a
 * time (tabs for talks and posters), so there's little to scroll: a swipeable
 * stack on phones and an animated grid on larger screens. Each card opens the
 * full profile.
 */
export function StudentPresenters({ presenters }: { presenters: StudentPresenter[] }) {
  const kinds = (["oral", "poster"] as const).filter((k) => presenters.some((p) => p.kind === k));
  const [kind, setKind] = useState<Kind>(kinds[0] ?? "oral");
  const [open, setOpen] = useState<StudentPresenter | null>(null);
  const people = presenters.filter((p) => p.kind === kind);
  const tabsId = useId();

  return (
    <section aria-label="Student presenters" className="relative overflow-hidden bg-paper pb-12 pt-4 sm:pb-24 sm:pt-12">
      <div aria-hidden className="grid-lines-light pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="container-page relative">
        {kinds.length > 1 && (
          <div role="tablist" aria-label="Presenters" className="mx-auto flex w-full max-w-md rounded-full border border-navy/10 bg-white p-1 shadow-sm md:mx-0">
            {kinds.map((k) => {
              const on = k === kind;
              const n = presenters.filter((p) => p.kind === k).length;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  id={`${tabsId}-${k}`}
                  aria-selected={on}
                  aria-controls={`${tabsId}-panel`}
                  onClick={() => setKind(k)}
                  className={cn("relative flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3 font-ui text-sm font-semibold transition-colors", on ? "text-paper" : "text-slate-700 hover:text-ink")}
                >
                  {on && <m.span layoutId={`${tabsId}-pill`} className="absolute inset-0 rounded-full bg-navy" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative sm:hidden">{KIND[k].short}</span>
                  <span className="relative hidden sm:inline">{KIND[k].tab}</span>
                  <span className={cn("relative rounded-full px-1.5 text-xs tabular-nums", on ? "bg-white/15" : "bg-navy/5")}>{n}</span>
                </button>
              );
            })}
          </div>
        )}

        <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${kind}`} className="mt-4 sm:mt-10">
          {/* Phones: one card at a time, swipe through the stack. */}
          <div className="md:hidden">
            <AnimatePresence mode="wait" initial={false}>
              <m.div key={kind} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3, ease: EASE }}>
                <CardDeck
                  label={KIND[kind].tab}
                  noun="presenter"
                  cards={people.map((p) => ({
                    key: `${kind}-${p.id}`,
                    label: p.fullName,
                    dot: KIND[kind].dot,
                    card: <PresenterCard p={p} onOpen={() => setOpen(p)} />,
                  }))}
                />
              </m.div>
            </AnimatePresence>
          </div>

          {/* Larger screens: the whole group at a glance. */}
          <AnimatePresence mode="wait" initial={false}>
            <m.ul
              key={kind}
              className="hidden gap-5 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            >
              {people.map((p) => (
                <m.li
                  key={`${kind}-${p.id}`}
                  variants={{ hidden: { opacity: 0, y: 28, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } } }}
                >
                  <PresenterCard p={p} onOpen={() => setOpen(p)} lift />
                </m.li>
              ))}
            </m.ul>
          </AnimatePresence>
        </div>
      </div>

      <Profile p={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function where(p: StudentPresenter) {
  return [p.roomName, p.talk ? `talk ${p.talk}` : null].filter(Boolean).join(", ");
}

/** A presenter as a card: a coloured band with their photo, then their name, university and title. */
function PresenterCard({ p, onOpen, lift = false }: { p: StudentPresenter; onOpen: () => void; lift?: boolean }) {
  const k = KIND[p.kind];
  const meta = [p.institution, p.yearOfStudy].filter(Boolean).join(", ");
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-[0_1px_2px_rgba(15,27,46,0.06),0_12px_32px_-16px_rgba(15,27,46,0.25)]",
        lift && "transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(15,27,46,0.06),0_24px_48px_-20px_rgba(15,27,46,0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      <div className={cn("relative h-20 bg-gradient-to-br sm:h-24", k.band)}>
        <div aria-hidden className="quarter-lattice absolute inset-0 opacity-40" />
        <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink shadow-sm backdrop-blur">
          <k.Icon aria-hidden className="size-3.5" />
          {p.kind === "oral" ? (p.talk ? `Talk ${p.talk}` : "Talk") : "Poster"}
        </span>
      </div>
      <div className="relative flex flex-1 flex-col px-5 pb-4 sm:pb-5">
        <Photo p={p} className="-mt-10 size-20 ring-4 sm:-mt-12 sm:size-24 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
        <h3 className="mt-3 font-display text-[1.35rem] font-medium leading-tight text-ink">{p.fullName}</h3>
        {meta && <p className="mt-1 text-sm text-slate-700">{meta}</p>}
        {where(p) && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate">
            <MapPin aria-hidden className="size-3.5" />
            {where(p)}
          </p>
        )}
        {p.presentationTitle && <p className="mt-3 line-clamp-3 font-display text-[1.05rem] italic leading-snug text-ink">&ldquo;{p.presentationTitle}&rdquo;</p>}
        <div className="mt-auto pt-3 sm:pt-4">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-navy/10 bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:border-navy/30 hover:bg-paper-200"
          >
            {p.bio ? "Read their profile" : "View profile"}
            <ArrowUpRight aria-hidden className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            <span className="sr-only">: {p.fullName}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

/** The full profile, over the page (a sheet from the bottom on phones). */
function Profile({ p, onClose }: { p: StudentPresenter | null; onClose: () => void }) {
  const titleId = useId();
  const k = p ? KIND[p.kind] : null;
  return (
    <Overlay open={Boolean(p)} onClose={onClose} labelledBy={titleId}>
      {p && k && (
        <div className="overflow-y-auto overscroll-contain">
          <div className={cn("relative h-32 bg-gradient-to-br", k.band)}>
            <div aria-hidden className="quarter-lattice absolute inset-0 opacity-40" />
          </div>
          <div className="px-6 pb-8">
            <m.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: EASE, delay: 0.05 }} className="-mt-16 w-fit">
              <Photo p={p} className="size-32 ring-4" />
            </m.div>
            <h2 id={titleId} className="mt-4 font-display text-3xl font-medium leading-tight text-ink">
              {p.fullName}
            </h2>
            <p className="mt-1 text-slate-700">{[p.institution, p.yearOfStudy].filter(Boolean).join(", ")}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]", k.pill)}>
                <k.Icon aria-hidden className="size-3.5" />
                {k.label}
              </span>
              {where(p) && (
                <span className="inline-flex items-center gap-1 text-sm text-slate">
                  <MapPin aria-hidden className="size-4" />
                  {where(p)}
                </span>
              )}
            </div>
            {p.presentationTitle && <p className="mt-5 font-display text-xl italic leading-snug text-ink">&ldquo;{p.presentationTitle}&rdquo;</p>}
            {p.bio && (
              <div className="mt-5 border-t border-navy/10 pt-5">
                <p className="eyebrow text-slate">About</p>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{p.bio}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Overlay>
  );
}

/** Their profile photo. The link lasts an hour, so fall back to initials if it has run out. */
function Photo({ p, className }: { p: StudentPresenter; className?: string }) {
  const [broken, setBroken] = useState(false);
  const k = KIND[p.kind];
  const box = cn("relative shrink-0 overflow-hidden rounded-full bg-white ring-offset-0", k.ring, className);
  if (p.photoUrl && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.photoUrl} alt={`Photo of ${p.fullName}`} loading="lazy" decoding="async" onError={() => setBroken(true)} className={cn(box, "object-cover")} />;
  }
  return (
    <span aria-hidden className={cn(box, "grid place-items-center font-display text-2xl font-semibold", k.fallback)}>
      {initials(p.fullName)}
    </span>
  );
}
