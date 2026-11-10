"use client";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowDown, ArrowRight, CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { NeuralField } from "@/components/visual/neural-field";
import { Countdown } from "@/components/visual/countdown";
import { CONFERENCE_STATUS_LABEL, type ConferenceStatus } from "@/lib/types";

const ease = [0.16, 1, 0.3, 1] as const;

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
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const fieldScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);

  const headline = ["THE FUTURE", "OF MEDICINE", "STARTS HERE."];

  return (
    <section ref={ref} aria-labelledby="hero-title" className="surface-midnight noise relative isolate flex min-h-[100svh] items-end overflow-hidden pb-16 pt-32 sm:pb-20">
      {/* Layered light and depth */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_30%,rgba(52,120,246,0.28),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_15%_80%,rgba(133,120,249,0.18),transparent_70%)]" />
        <div className="grid-lines absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <motion.div style={{ scale: fieldScale }} className="absolute inset-0">
          <NeuralField />
        </motion.div>
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-midnight to-transparent" />
      </div>

      <motion.div style={{ y: contentY, opacity: contentOpacity }} className="container-page relative w-full">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="eyebrow flex flex-wrap items-center gap-3 text-cyan"
        >
          <span aria-hidden className="h-px w-10 bg-cyan/60" />
          INSPIRE National Medical Research Conference {year}
          {status && (
            <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-0.5 text-[0.65rem] tracking-[0.14em] text-cyan">
              {CONFERENCE_STATUS_LABEL[status]}
            </span>
          )}
        </motion.p>

        <h1 id="hero-title" className="mt-8 text-display-xl font-semibold">
          {headline.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className={i === 2 ? "block bg-gradient-to-r from-paper via-cyan-300 to-violet-300 bg-clip-text text-transparent" : "block"}
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-end">
          <motion.div
            className="lg:col-span-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.6, ease }}
          >
            <p className="font-display text-xl font-medium text-paper sm:text-2xl">{theme}</p>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-paper/70">
              Join the next generation of clinicians, researchers and innovators for a day of discovery, collaboration and
              scientific ambition.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper/80">
              <li className="flex items-center gap-2">
                <CalendarDays aria-hidden className="size-4 text-cyan" /> {dateLabel}
              </li>
              <li className="flex items-center gap-2">
                <MapPin aria-hidden className="size-4 text-cyan" /> {venue}
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/conference"
                className="group inline-flex min-h-14 items-center gap-2 rounded-full bg-cyan px-7 font-display font-semibold text-midnight transition-[background-color,box-shadow] hover:bg-cyan-300 hover:shadow-[0_12px_40px_-10px_rgba(57,213,242,0.7)]"
              >
                Explore the Conference
                <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/programme"
                className="inline-flex min-h-14 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 font-display font-medium text-paper backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-white/10"
              >
                View the Programme
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="lg:col-span-6 lg:justify-self-end"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.8, ease }}
          >
            <Countdown startIso={startIso} endIso={endIso} hasConfirmedTime={hasConfirmedTime} year={year} />
          </motion.div>
        </div>
      </motion.div>

      <a
        href="#introduction"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-paper/65 transition-colors hover:text-paper md:flex"
      >
        Scroll
        <span className="relative flex h-10 w-6 justify-center rounded-full border border-white/20">
          <motion.span
            className="mt-2 block size-1 rounded-full bg-cyan"
            animate={{ y: [0, 14, 0], opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
        <ArrowDown aria-hidden className="sr-only" />
      </a>
    </section>
  );
}
