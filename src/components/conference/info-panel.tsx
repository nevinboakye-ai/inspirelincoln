"use client";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronUp, MapPin, Ticket } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/** Mobile-only conference information bar that expands into a panel. */
export function MobileInfoPanel({ dateLabel, timeLabel, venue, statusLabel }: { dateLabel: string; timeLabel: string; venue: string; statusLabel: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 lg:hidden">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-midnight/95 text-paper shadow-2xl backdrop-blur-xl">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div id="conf-info" initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <dl className="space-y-3 border-b border-white/10 p-4 text-sm">
                <div className="flex gap-3">
                  <CalendarDays aria-hidden className="size-4 shrink-0 text-cyan" />
                  <div>
                    <dt className="sr-only">Date</dt>
                    <dd>{dateLabel}</dd>
                    <dd className="text-paper/60">{timeLabel}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin aria-hidden className="size-4 shrink-0 text-cyan" />
                  <div>
                    <dt className="sr-only">Venue</dt>
                    <dd>{venue}</dd>
                  </div>
                </div>
                {statusLabel && (
                  <div className="flex gap-3">
                    <Ticket aria-hidden className="size-4 shrink-0 text-cyan" />
                    <div>
                      <dt className="sr-only">Registration</dt>
                      <dd>{statusLabel}</dd>
                    </div>
                  </div>
                )}
              </dl>
              <div className="grid grid-cols-3 gap-2 p-3 text-center text-sm font-medium">
                <Link href="/programme" className="rounded-md bg-white/5 py-3">Programme</Link>
                <Link href="#venue" onClick={() => setOpen(false)} className="rounded-md bg-white/5 py-3">Travel</Link>
                <Link href="#registration" onClick={() => setOpen(false)} className="rounded-md bg-cyan py-3 font-semibold text-midnight">Register</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button type="button" aria-expanded={open} aria-controls="conf-info" onClick={() => setOpen(!open)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{dateLabel}</span>
            <span className="block truncate text-xs text-paper/60">{venue}</span>
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-cyan">
            Info <ChevronUp aria-hidden className={`size-4 transition-transform ${open ? "" : "rotate-180"}`} />
          </span>
        </button>
      </div>
    </div>
  );
}
