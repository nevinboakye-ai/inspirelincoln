"use client";
import { CalendarPlus } from "lucide-react";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { placeLine, type DayItem } from "@/lib/day/plan";
import { SITE_URL } from "@/lib/site";

/** Saves their own day to their phone's calendar, with the room for each part. */
export function DayCalendarButton({ items, className = "" }: { items: DayItem[]; className?: string }) {
  const timed = items.filter((i) => i.startsAt && i.endsAt);
  if (!timed.length) return null;
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] border border-navy/15 bg-white px-4 font-ui text-sm font-semibold text-ink hover:bg-paper-200 ${className}`}
      onClick={() =>
        downloadIcs(
          "my-inspire-day.ics",
          buildIcs(
            timed.map((i) => ({
              uid: `${i.id}@inspire-my-day`,
              title: i.workshop ? `Workshop: ${i.title}` : i.title,
              start: new Date(i.startsAt!),
              end: new Date(i.endsAt!),
              location: placeLine(i.room) ?? (i.options.length ? i.options.map((o) => placeLine(o.room) ?? o.title).join(" or ") : undefined),
              url: `${SITE_URL}/portal/my-day`,
              description: [i.slotTitle, i.room?.directions, i.note].filter(Boolean).join("\n") || undefined,
            })),
            "My INSPIRE day",
          ),
        )
      }
    >
      <CalendarPlus aria-hidden className="size-4" /> Add to my calendar
    </button>
  );
}
