"use client";
import { CalendarPlus } from "lucide-react";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { cn } from "@/lib/cn";

/**
 * Downloads the conference as an .ics event. Disabled until the organisers
 * configure both start and end times, so no invented times are exported.
 */
export function IcsButton({
  startIso,
  endIso,
  title,
  location,
  url,
  uid,
  className,
  dark = false,
}: {
  startIso: string | null;
  endIso: string | null;
  title: string;
  location: string;
  url: string;
  uid: string;
  className?: string;
  dark?: boolean;
}) {
  const ready = Boolean(startIso && endIso);
  return (
    <div className={className}>
      <button
        type="button"
        disabled={!ready}
        onClick={() =>
          ready &&
          downloadIcs(
            "inspire-conference.ics",
            buildIcs([{ uid, title, start: new Date(startIso!), end: new Date(endIso!), location, url, description: `${title}. Details: ${url}` }]),
          )
        }
        className={cn(
          "inline-flex min-h-12 items-center gap-2 rounded-[3px] border px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          dark ? "border-white/20 text-paper hover:border-white/40" : "border-navy/15 text-ink hover:border-navy/40",
        )}
      >
        <CalendarPlus aria-hidden className="size-4" /> Add to calendar
      </button>
      {!ready && <p className={cn("mt-2 text-xs", dark ? "text-paper/65" : "text-slate")}>Available once start and finish times are confirmed.</p>}
    </div>
  );
}
