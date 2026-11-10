"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type Bar = { key: string; label: string; short: string; value: number; detail?: string };

/**
 * A single-series column chart: thin rounded bars on a quiet baseline, a
 * tooltip on hover or keyboard focus, and the same numbers as a table for
 * screen readers and anyone who prefers one.
 */
export function BarChart({ bars, unit, caption, height = 160, tickEvery }: { bars: Bar[]; unit: string; caption: string; height?: number; tickEvery?: number }) {
  const [active, setActive] = useState<number | null>(null);
  // One tab stop for the whole chart; arrow keys move between bars.
  const [stop, setStop] = useState(Math.max(0, bars.length - 1));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? bars.length - 1 : null;
    if (to === null || to < 0 || to >= bars.length) return;
    e.preventDefault();
    setStop(to);
    refs.current[to]?.focus();
  };
  const max = Math.max(1, ...bars.map((b) => b.value));
  const step = tickEvery ?? Math.max(1, Math.ceil(bars.length / 7));
  const a = active !== null ? bars[active] : null;
  return (
    <figure className="min-w-0">
      <div className="relative" onMouseLeave={() => setActive(null)}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between text-[0.7rem] text-slate">
          <span>{max.toLocaleString("en-GB")}</span>
        </div>
        <div
          role="group"
          aria-label={`${caption}. Use the arrow keys to move between bars.`}
          className="relative flex items-end gap-[2px] border-b border-navy/15 pt-5"
          style={{ height: height + 20 }}
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-5 border-t border-dashed border-navy/10" />
          {bars.map((b, i) => (
            <button
              key={b.key}
              type="button"
              ref={(el) => {
                refs.current[i] = el;
              }}
              tabIndex={i === stop ? 0 : -1}
              onKeyDown={(e) => onKey(e, i)}
              aria-label={`${b.label}: ${b.value.toLocaleString("en-GB")} ${unit}${b.detail ? `, ${b.detail}` : ""}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-t-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600"
            >
              <span
                className={cn("block w-full max-w-7 rounded-t-[4px] transition-colors", b.value ? (active === i ? "bg-electric-600" : "bg-navy") : "bg-navy/10")}
                style={{ height: b.value ? `${Math.max(3, (b.value / max) * height)}px` : "2px" }}
              />
            </button>
          ))}
          {a && (
            <div
              aria-hidden
              className="pointer-events-none absolute -top-2 z-10 w-max max-w-[14rem] -translate-x-1/2 -translate-y-full rounded-md bg-midnight px-3 py-2 text-xs text-paper shadow-lg"
              style={{ left: `clamp(4.5rem, ${((active! + 0.5) / bars.length) * 100}%, calc(100% - 4.5rem))` }}
            >
              <span className="block font-semibold">{a.label}</span>
              <span className="block">{a.value.toLocaleString("en-GB")} {unit}</span>
              {a.detail && <span className="block text-paper/75">{a.detail}</span>}
            </div>
          )}
        </div>
        <div aria-hidden className="mt-1.5 flex gap-[2px] text-[0.7rem] text-slate">
          {bars.map((b, i) => (
            <span key={b.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
              {i % step === 0 ? b.short : ""}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-electric-600">Show as a table</summary>
        <div tabIndex={0} role="region" aria-label={`${caption}, as a table`} className="mt-2 max-h-72 overflow-auto rounded-md border border-navy/10 focus-visible:outline-2 focus-visible:outline-electric-600">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 bg-paper-200 text-xs uppercase tracking-[0.1em] text-slate-700">
              <tr><th scope="col" className="px-3 py-2">When</th><th scope="col" className="px-3 py-2 text-right capitalize">{unit}</th>{bars.some((b) => b.detail) && <th scope="col" className="px-3 py-2">Also</th>}</tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {bars.map((b) => (
                <tr key={b.key}><th scope="row" className="px-3 py-2 font-normal">{b.label}</th><td className="px-3 py-2 text-right tabular-nums">{b.value.toLocaleString("en-GB")}</td>{bars.some((x) => x.detail) && <td className="px-3 py-2 text-slate-700">{b.detail}</td>}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
