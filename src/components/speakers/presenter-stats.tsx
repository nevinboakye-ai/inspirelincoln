"use client";
import { animate, m, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { StudentPresenter } from "@/lib/types";

/** A number that counts up from zero the first time it's seen. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen || reduce) return;
    const c = animate(0, to, { duration: 1.2, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [seen, reduce, to]);
  return <span ref={ref} className="tabular-nums">{reduce ? to : n}</span>;
}

/** Talks, posters and universities, under the Presenters page title. */
export function PresenterStats({ presenters }: { presenters: StudentPresenter[] }) {
  const stats = [
    { n: presenters.filter((p) => p.kind === "oral").length, one: "talk", many: "talks" },
    { n: presenters.filter((p) => p.kind === "poster").length, one: "poster", many: "posters" },
    { n: new Set(presenters.map((p) => p.institution?.trim().toLowerCase()).filter(Boolean)).size, one: "university", many: "universities" },
  ].filter((s) => s.n > 0);
  return (
    <ul className="mt-4 flex flex-wrap gap-2 sm:mt-8 sm:gap-3">
      {stats.map((s, i) => (
        <m.li
          key={s.many}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-baseline gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2"
        >
          <span className="font-display text-xl text-gold-300 sm:text-2xl">
            <CountUp to={s.n} />
          </span>
          <span className="text-xs text-paper/75 sm:text-sm">{s.n === 1 ? s.one : s.many}</span>
        </m.li>
      ))}
    </ul>
  );
}
