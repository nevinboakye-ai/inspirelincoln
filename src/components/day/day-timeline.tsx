"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Coffee, MapPin, Mic, Navigation, Presentation, Sparkles, Trophy, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/time";
import { ASSIGNMENT_LABEL, ASSIGNMENT_LABEL_THEM, placeLine, whereNow, type DayItem } from "@/lib/day/plan";
import { workshopColour } from "@/lib/workshops/colours";
import type { SessionCategory } from "@/lib/types";

const ICON: Record<SessionCategory, typeof Clock> = {
  keynote: Mic,
  research: Presentation,
  workshop: Wrench,
  networking: Users,
  break: Coffee,
  closing: Trophy,
};

/** The time now, ticking every 30 seconds. Null until the page has loaded, so server and browser agree. */
export function useNow(every = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

export function timeRange(i: Pick<DayItem, "startsAt" | "endsAt">) {
  if (!i.startsAt) return "Time to be confirmed";
  return i.endsAt ? `${formatTime(i.startsAt)} to ${formatTime(i.endsAt)}` : formatTime(i.startsAt);
}

/**
 * A day, top to bottom. What's on now and next stand out on the day; what
 * has finished fades back. Personal items (their workshop, a session they've
 * been placed in) carry the workshop's colour and say why.
 *
 * `compact` shows only what's left (or the first few before the day), for
 * the hub. `them` words it for the committee looking at someone else.
 */
export function DayTimeline({ items, compact = false, limit = 4, them = false, className }: { items: DayItem[]; compact?: boolean; limit?: number; them?: boolean; className?: string }) {
  const now = useNow();
  const { current, next } = now != null ? whereNow(items, now) : { current: null, next: null };
  const t = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  const ended = (i: DayItem) => now != null && i.startsAt != null && (i.endsAt ? t(i.endsAt) <= now : false);

  let shown = items;
  if (compact) {
    const from = items.findIndex((i) => !ended(i));
    shown = from < 0 ? [] : items.slice(from, from + limit);
  }
  if (!shown.length) {
    return <p className={cn("rounded-lg bg-paper p-3 text-sm text-slate-700", className)}>{items.length ? "That's everything for today. Thank you for coming." : "The programme will show here once times are confirmed."}</p>;
  }

  return (
    <ol className={cn("relative space-y-2.5", className)}>
      <span aria-hidden className="absolute bottom-3 left-[0.9rem] top-3 w-px bg-navy/12" />
      {shown.map((i) => {
        const live = current?.id === i.id;
        const up = !live && next?.id === i.id;
        const done = ended(i) && !live;
        const colour = i.workshop ? workshopColour(i.workshop.number) : null;
        const Icon = ICON[i.category] ?? Clock;
        const where = placeLine(i.room);
        return (
          <li key={i.id} className={cn("relative pl-9 transition-opacity", done && "opacity-55")}>
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-3 grid size-[1.85rem] place-items-center rounded-full border-2 bg-white",
                live ? "border-success text-success" : up ? "border-gold text-gold-700" : i.personal ? "border-transparent text-white" : "border-navy/15 text-slate",
              )}
              style={i.personal && !live && !up ? { background: colour?.solid ?? "var(--color-navy)" } : undefined}
            >
              {done && i.mark ? <CheckCircle2 className="size-4" /> : <Icon className="size-3.5" />}
              {live && <span className="absolute inset-0 animate-ping rounded-full border-2 border-success/50 [animation-duration:2.2s]" />}
            </span>
            <div
              className={cn(
                "rounded-xl border p-3 sm:p-3.5",
                live ? "border-success/40 bg-success/[0.06] shadow-[0_10px_30px_-20px_rgba(14,111,79,0.7)]" : up ? "border-gold/50 bg-gold/[0.07]" : "border-navy/10 bg-white",
              )}
              style={colour && !live && !up ? { borderLeft: `4px solid ${colour.solid}` } : undefined}
            >
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-ui text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-slate">
                <span className="tabular-nums text-ink">{timeRange(i)}</span>
                {live && <span className="rounded-full bg-success px-2 py-0.5 text-[0.62rem] tracking-[0.14em] text-white">Now</span>}
                {up && <span className="rounded-full bg-gold px-2 py-0.5 text-[0.62rem] tracking-[0.14em] text-midnight">Next</span>}
                {i.slotTitle && <span className="normal-case tracking-normal text-slate">{i.slotTitle}</span>}
              </p>
              <p className="mt-1 font-display text-[1.05rem] leading-snug text-ink">
                {i.workshop && (
                  <span className="mr-1.5 inline-grid size-5 translate-y-[-1px] place-items-center rounded-full align-middle font-ui text-[0.65rem] font-bold text-white" style={{ background: colour!.solid }}>
                    {i.workshop.number}
                  </span>
                )}
                {i.title}
              </p>
              {(i.personal || i.mark) && (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                  {i.personal === "workshop" && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: colour?.tint, color: "var(--color-ink)" }}>
                      <Sparkles aria-hidden className="size-3" /> {them ? "Their workshop" : "Your workshop"}
                      {i.choice ? ` · ${ordinal(i.choice)} choice` : ""}
                    </span>
                  )}
                  {i.role && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-paper">{them ? ASSIGNMENT_LABEL_THEM[i.role] : ASSIGNMENT_LABEL[i.role]}</span>
                  )}
                  {i.mark && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-success">
                      <CheckCircle2 aria-hidden className="size-3" /> Marked in at {formatTime(i.mark.markedAt)}
                    </span>
                  )}
                </p>
              )}
              {i.note && <p className="mt-1 text-sm text-slate-700">{i.note}</p>}
              {i.pending && <p className="mt-1 text-sm text-slate-700">{i.pending}</p>}
              {where && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink">
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-600" />
                  <span className="min-w-0">
                    <span className="font-semibold">{where}</span>
                    {i.room?.directions && !compact && (live || up || i.personal) && <span className="block text-slate-700">{i.room.directions}</span>}
                  </span>
                  {i.mapHref && (
                    <Link href={i.mapHref} className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-electric-600 hover:bg-paper-200">
                      <Navigation aria-hidden className="size-3.5" /> Map
                    </Link>
                  )}
                </p>
              )}
              {i.options.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  <li className="text-xs text-slate-700">Running at the same time. Go to either:</li>
                  {i.options.map((o) => (
                    <li key={o.sessionId} className="flex items-center gap-2 text-sm">
                      <MapPin aria-hidden className="size-3.5 shrink-0 text-electric-600" />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-ink">{placeLine(o.room) ?? o.title}</span>
                        {o.room && <span className="text-slate-700"> · {o.title}</span>}
                      </span>
                      {o.mapHref && (
                        <Link href={o.mapHref} className="inline-flex min-h-9 shrink-0 items-center rounded-full px-2 text-xs font-semibold text-electric-600 hover:bg-paper-200">
                          Map
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
