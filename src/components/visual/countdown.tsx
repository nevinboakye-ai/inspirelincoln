"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Phase = "before" | "live" | "after";

function phaseFor(now: number, start: number, end: number): Phase {
  if (now < start) return "before";
  if (now <= end) return "live";
  return "after";
}

/**
 * Live countdown to the configured start (UK time). Before a start time is
 * confirmed it counts to the start of the conference day and says so. After the
 * event it switches to a post-event call to action automatically.
 */
export function Countdown({
  startIso,
  endIso,
  hasConfirmedTime,
  year,
  className,
}: {
  startIso: string;
  endIso: string;
  hasConfirmedTime: boolean;
  year: number;
  className?: string;
}) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const phase = now == null ? "before" : phaseFor(now, start, end);

  if (phase === "after") {
    return (
      <div className={cn("flex flex-wrap items-center gap-4", className)}>
        <p className="font-display text-lg text-paper/80">INSPIRE {year} has concluded. Thank you to everyone who took part.</p>
        <Link href="/about" className="inline-flex items-center gap-2 rounded-[3px] border border-cyan/40 px-5 py-2.5 text-sm font-semibold text-cyan hover:bg-cyan/10">
          About INSPIRE <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    );
  }

  if (phase === "live") {
    return (
      <div className={cn("flex flex-wrap items-center gap-4", className)}>
        <span className="inline-flex items-center gap-2 rounded-[3px] bg-cyan/15 px-4 py-2 text-sm font-semibold text-cyan">
          <span className="size-2 animate-pulse-soft rounded-full bg-cyan" /> Happening today
        </span>
        <Link href="/today" className="inline-flex items-center gap-2 text-sm font-semibold text-paper hover:text-cyan">
          Open the conference-day guide <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    );
  }

  const diff = now == null ? null : Math.max(0, start - now);
  const units = [
    { label: "Days", value: diff == null ? null : Math.floor(diff / 86400000) },
    { label: "Hours", value: diff == null ? null : Math.floor((diff / 3600000) % 24) },
    { label: "Minutes", value: diff == null ? null : Math.floor((diff / 60000) % 60) },
    { label: "Seconds", value: diff == null ? null : Math.floor((diff / 1000) % 60) },
  ];
  const summary =
    diff == null
      ? ""
      : `${units[0].value} days, ${units[1].value} hours and ${units[2].value} minutes until ${hasConfirmedTime ? "the conference begins" : "conference day"}`;

  return (
    <div className={className}>
      <p className="sr-only" aria-live="off">
        {summary}
      </p>
      <div aria-hidden className="grid grid-cols-4 divide-x divide-white/15 border-y border-white/15">
        {units.map((u) => (
          <div key={u.label} className="px-3 py-4 first:pl-0 sm:px-5">
            <span className="block font-display text-[2.25rem] font-light tabular-nums leading-none text-paper sm:text-[3.25rem]">
              {u.value == null ? "--" : String(u.value).padStart(2, "0")}
            </span>
            <span className="mt-2 block font-ui text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-paper/65 sm:text-[0.65rem]">{u.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-paper/65">
        {hasConfirmedTime ? "Counting down to the opening session, UK time." : "Counting down to conference day (UK time). Session times will be confirmed."}
      </p>
    </div>
  );
}
