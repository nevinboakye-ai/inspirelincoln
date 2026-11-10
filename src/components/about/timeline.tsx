"use client";
import { motion, useScroll, useSpring } from "motion/react";
import { useRef } from "react";
import type { TimelineEvent } from "@/lib/types";

/** Vertical history timeline whose spine draws as you scroll. Only verified events are passed in. */
export function HistoryTimeline({ events }: { events: TimelineEvent[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <ol ref={ref} className="relative ml-3 space-y-12 border-l border-white/10 pl-10 sm:ml-0">
      <motion.span aria-hidden style={{ scaleY }} className="absolute -left-px top-0 h-full w-px origin-top bg-gradient-to-b from-cyan to-violet" />
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span aria-hidden className="absolute -left-[2.85rem] top-1.5 size-3.5 rounded-full border-2 border-cyan bg-midnight" />
          <p className="font-display text-sm font-semibold tracking-[0.14em] text-cyan">{e.year}</p>
          <h3 className="mt-2 font-display text-2xl font-medium">{e.title}</h3>
          <p className="mt-2 max-w-2xl text-paper/65">{e.description}</p>
        </li>
      ))}
      <li className="relative">
        <span aria-hidden className="absolute -left-[2.85rem] top-1.5 size-3.5 rounded-full border-2 border-dashed border-paper/40 bg-midnight" />
        <p className="font-display text-sm font-semibold tracking-[0.14em] text-paper/45">Earlier years</p>
        <p className="mt-2 max-w-2xl text-paper/55">
          INSPIRE has a history spanning more than a decade. Earlier conferences will be added here as their details are verified.
        </p>
      </li>
    </ol>
  );
}
