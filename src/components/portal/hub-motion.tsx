"use client";
import { animate, m, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { zonedTimeToUtc } from "@/lib/time";

const ease = [0.16, 1, 0.3, 1] as const;

/** Days, hours and minutes until the conference starts, ticking once a minute. */
export function Countdown({ date, time }: { date: string; time: string | null }) {
  const target = zonedTimeToUtc(date, time ?? "00:00").getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (now === null) return <div className="h-14" aria-hidden />;
  const left = target - now;
  const endOfDay = zonedTimeToUtc(date, "23:59").getTime();
  if (left <= 0) {
    return <p className="font-display text-2xl text-gold">{now < endOfDay ? "INSPIRE is happening today" : "Thank you for coming to INSPIRE"}</p>;
  }
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const min = Math.floor((left % 3_600_000) / 60_000);
  const parts = time ? [[d, d === 1 ? "day" : "days"], [h, h === 1 ? "hour" : "hours"], [min, "min"]] : [[Math.ceil(left / 86_400_000), Math.ceil(left / 86_400_000) === 1 ? "day" : "days"]];
  return (
    <p className="flex items-end gap-4 sm:gap-5">
      <span className="sr-only">{`${parts.map(([v, l]) => `${v} ${l}`).join(", ")} to go`}</span>
      {parts.map(([v, l]) => (
        <span key={String(l)} aria-hidden className="flex flex-col">
          <span className="font-display text-3xl tabular-nums leading-none text-paper sm:text-4xl">
            <Ticker value={Number(v)} />
          </span>
          <span className="mt-1.5 font-ui text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-paper/60">{l}</span>
        </span>
      ))}
      <span aria-hidden className="mb-5 font-ui text-xs font-semibold uppercase tracking-[0.2em] text-gold">to go</span>
    </p>
  );
}

/** A number that counts up to its value the first time it appears. */
function Ticker({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const seen = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || seen.current) {
      el.textContent = String(value).padStart(2, "0");
      return;
    }
    seen.current = true;
    const c = animate(0, value, { duration: 1.4, ease, onUpdate: (v) => (el.textContent = String(Math.round(v)).padStart(2, "0")) });
    return () => c.stop();
  }, [value, reduce]);
  return <span ref={ref}>{String(value).padStart(2, "0")}</span>;
}

/** A ring that fills to show how ready someone is for the day. */
export function ReadinessRing({ done, total, small = false }: { done: number; total: number; small?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const pct = total ? done / total : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className={`relative grid shrink-0 place-items-center ${small ? "size-14" : "size-24"}`}>
      <svg ref={ref} viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="7" />
        <m.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="url(#ready-g)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - pct) : c }}
          animate={inView ? { strokeDashoffset: c * (1 - pct) } : undefined}
          transition={{ duration: 1.6, ease, delay: 0.2 }}
        />
        <defs>
          <linearGradient id="ready-g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#e6c97f" />
            <stop offset="1" stopColor="#a5802a" />
          </linearGradient>
        </defs>
      </svg>
      <p className="text-center leading-none">
        <span className={`font-display text-ink ${small ? "text-lg" : "text-2xl"}`}>{done}</span>
        <span className={small ? "text-xs text-slate" : "text-sm text-slate"}>/{total}</span>
      </p>
    </div>
  );
}

/** Cards that rise in one after another when the hub opens. */
export function HubStagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <m.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}>
      {children}
    </m.div>
  );
}

export function HubItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <m.div className={className} variants={{ hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } }}>
      {children}
    </m.div>
  );
}

/** The countdown printed on the lanyard: small, in the card's own colours. */
export function CardCountdown({ date, time }: { date: string; time: string | null }) {
  const target = zonedTimeToUtc(date, time ?? "00:00").getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (now === null) return <div className="h-12" aria-hidden />;
  const left = target - now;
  if (left <= 0) {
    const today = now < zonedTimeToUtc(date, "23:59").getTime();
    return <p className="font-display text-lg text-gold-700">{today ? "Happening today" : "Thank you for coming"}</p>;
  }
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const parts: [number, string][] = time ? [[d, d === 1 ? "day" : "days"], [h, h === 1 ? "hr" : "hrs"]] : [[Math.ceil(left / 86_400_000), Math.ceil(left / 86_400_000) === 1 ? "day" : "days"]];
  return (
    <p className="flex items-end gap-3">
      <span className="sr-only">{parts.map(([v, l]) => `${v} ${l}`).join(", ")} to go</span>
      {parts.map(([v, l]) => (
        <span key={l} aria-hidden className="flex items-baseline gap-1">
          <span className="font-display text-[1.7rem] tabular-nums leading-none text-ink"><Ticker value={v} /></span>
          <span className="font-ui text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate">{l}</span>
        </span>
      ))}
      <span aria-hidden className="pb-0.5 font-ui text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-gold-700">to go</span>
    </p>
  );
}
