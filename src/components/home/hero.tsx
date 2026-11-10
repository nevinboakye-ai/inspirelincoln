"use client";
import { m, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { Countdown } from "@/components/visual/countdown";
import { PulseLine } from "@/components/motion/effects";
import { CONFERENCE_STATUS_LABEL, type ConferenceStatus } from "@/lib/types";


/** Splits the theme into "headline: rest" so the subtitle can be set in italic. */
function splitTheme(theme: string) {
  const i = theme.indexOf(":");
  if (i === -1) return { lead: theme, rest: "" };
  return { lead: theme.slice(0, i).trim(), rest: theme.slice(i + 1).trim() };
}

export function Hero({
  year,
  theme,
  dateLabel,
  venue,
  startIso,
  endIso,
  hasConfirmedTime,
  status,
}: {
  year: number;
  theme: string;
  dateLabel: string;
  venue: string;
  startIso: string;
  endIso: string;
  hasConfirmedTime: boolean;
  status: ConferenceStatus | null;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const crestY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 90]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 40]);
  const { lead, rest } = splitTheme(theme);

  return (
    <section ref={ref} aria-labelledby="hero-title" className="surface-midnight noise relative isolate overflow-hidden pt-[calc(var(--header-h)+3rem)]">
      {/* Heraldic quartering: a cross of hairlines that the crest sits on. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="animate-drift absolute -inset-[10%] bg-[radial-gradient(ellipse_60%_70%_at_72%_42%,rgba(58,95,148,0.38),transparent_70%)]" />
        <div className="absolute inset-y-0 left-[58%] hidden w-px bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />
        <div className="quarter-lattice absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_70%_45%,black,transparent_70%)]" />
      </div>

      <div className="container-page relative">
        {/* Dateline, set like the masthead of a journal */}
        <div
          className="enter-fade flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-y border-white/15 py-3 font-ui text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-paper/75"
        >
          <span className="hidden sm:inline">National Medical Research Conference</span>
          <span>{dateLabel}</span>
          {status && <span className="text-cyan">{CONFERENCE_STATUS_LABEL[status]}</span>}
        </div>

        <div className="grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:pb-24">
          <m.div style={{ y: textY }} className="lg:col-span-7">
            <p className="eyebrow text-cyan">INSPIRE {year}</p>
            <h1 id="hero-title" className="mt-6 text-display-xl font-normal">
              <span className="block overflow-hidden pb-[0.08em]">
                <span className="enter-rise block [animation-delay:50ms]">{lead}</span>
              </span>
              {rest && (
                <span className="block overflow-hidden pb-[0.12em]">
                  <span className="enter-rise block text-[0.58em] font-light italic leading-[1.05] text-cyan [animation-delay:150ms]">
                    {rest}
                  </span>
                </span>
              )}
            </h1>

            <p
              className="enter-up mt-8 [animation-delay:280ms] max-w-xl text-lg leading-relaxed text-paper/75"
            >
              A day for medical students to present research, learn from clinicians and researchers, and take a first
              step into academic medicine. Hosted at Lincoln Medical School.
            </p>

            <div className="enter-up mt-10 flex flex-wrap gap-3 [animation-delay:340ms]">
              <Link
                href="/signup"
                className="shine group inline-flex min-h-14 items-center gap-3 bg-paper px-7 font-ui font-semibold text-navy transition-colors hover:bg-white"
              >
                Register
                <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/programme"
                className="inline-flex min-h-14 items-center gap-2 border border-white/30 px-7 font-ui font-medium text-paper transition-colors hover:border-white/70 hover:bg-white/5"
              >
                The programme
              </Link>
              <Link
                href="/map"
                className="inline-flex min-h-14 items-center gap-2 px-3 font-ui font-medium text-paper underline decoration-white/30 underline-offset-[6px] transition-colors hover:decoration-white"
              >
                Campus map
              </Link>
            </div>
          </m.div>

          <m.div style={{ y: crestY }} className="relative mx-auto w-[min(62vw,300px)] lg:col-span-5 lg:w-[min(30vw,360px)]">
            <CrestReveal />
          </m.div>
        </div>

        <PulseLine className="-mb-2 -mt-6 h-16 w-full sm:h-20 lg:-mt-10" />

        <div
          className="enter-up grid gap-8 pb-14 [animation-delay:450ms] md:grid-cols-12 md:items-end"
        >
          <dl className="grid grid-cols-2 gap-6 font-ui text-sm md:col-span-5">
            <div>
              <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-paper/65">Date</dt>
              <dd className="mt-2 font-display text-xl text-paper">{dateLabel}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-paper/65">Venue</dt>
              <dd className="mt-2 font-display text-xl text-paper">{venue}</dd>
            </div>
          </dl>
          <div className="md:col-span-7">
            <Countdown startIso={startIso} endIso={endIso} hasConfirmedTime={hasConfirmedTime} year={year} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** The crest, revealed one quarter at a time, with a slow outline drawn around it. */
function CrestReveal() {
  const quarters = [
    "inset(0 50% 50% 0)",
    "inset(0 0 50% 50%)",
    "inset(50% 50% 0 0)",
    "inset(50% 0 0 50%)",
  ];
  return (
    <div className="relative aspect-[338/397]">
      <div aria-hidden className="absolute -inset-[10%] rounded-full border border-white/10" />
      <div aria-hidden className="absolute -inset-[22%] rounded-full border border-dashed border-white/[0.07]" />
      {quarters.map((clip, i) => (
        <div key={clip} aria-hidden className="enter-pop absolute inset-0" style={{ clipPath: clip, animationDelay: `${200 + i * 110}ms` }}>
          <Image src="/brand/crest-white.png" alt="" fill priority sizes="360px" className="object-contain" />
        </div>
      ))}
      <span className="sr-only">The INSPIRE crest: a shield quartered with an open book, the rod of Asclepius twice, and an atom.</span>
    </div>
  );
}
