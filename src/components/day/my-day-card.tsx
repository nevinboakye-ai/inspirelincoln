import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowRight, CalendarClock } from "lucide-react";
import { loadMyDay } from "@/lib/day/server";
import { DayTimeline } from "@/components/day/day-timeline";

/**
 * "My day" on the hub: what's left of their day, with their own workshop
 * rooms. Streams in after the rest of the hub, so the hub never waits on it.
 * Shown once workshop places are out, or from the day before the conference.
 */
export async function MyDayCard({ db, userId, always = false }: { db: SupabaseClient; userId: string; always?: boolean }) {
  const { items, placesPublished, edition } = await loadMyDay(db, userId);
  const dayBefore = Date.now() >= new Date(`${edition.date}T00:00:00Z`).getTime() - 36 * 3_600_000;
  if (!always && !placesPublished && !dayBefore) return null;
  return (
    <section aria-labelledby="myday-h" className="rounded-xl border border-navy/10 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="myday-h" className="flex items-center gap-2 font-display text-lg text-ink">
          <CalendarClock aria-hidden className="size-4 text-electric-600" /> My day
        </h2>
        <Link href="/portal/my-day" className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-electric-600 hover:bg-paper-200">
          Whole day <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      <DayTimeline items={items} compact limit={3} />
    </section>
  );
}
