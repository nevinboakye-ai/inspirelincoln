import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadMyDay } from "@/lib/day/server";
import { formatEventDate } from "@/lib/time";
import { DayTimeline } from "@/components/day/day-timeline";
import { DayCalendarButton } from "@/components/day/day-calendar-button";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "My day", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Their own programme for the day: every part of it, with their workshops and rooms. */
export default async function MyDayPage() {
  const { db, user, profile } = await requireUser("/portal/my-day");
  const { items, placesPublished, edition } = await loadMyDay(db, user.id);
  const approved = profile.accountStatus === "approved";
  const workshops = items.filter((i) => i.workshop);
  return (
    <div className="space-y-4">
      <Link href="/portal" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-electric-600 lg:hidden">
        <ArrowLeft aria-hidden className="size-4" /> My Hub
      </Link>
      <header className="relative isolate overflow-hidden rounded-2xl bg-midnight px-5 py-5 text-paper sm:px-7 sm:py-6">
        <span aria-hidden className="hub-orb -right-16 -top-20 size-60 bg-navy-600/70" />
        <span aria-hidden className="hub-orb -bottom-24 left-[-4rem] size-64 bg-gold/20 [animation-delay:-6s]" />
        <div className="relative">
          <p className="eyebrow text-gold">Your programme · INSPIRE {edition.year}</p>
          <h1 className="mt-1.5 font-display text-3xl leading-[1.05] sm:text-4xl">My day</h1>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-paper/75">
            <span className="flex items-center gap-1.5">
              <CalendarDays aria-hidden className="size-4 text-cyan" /> {formatEventDate(edition.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin aria-hidden className="size-4 text-cyan" /> {edition.venueName}
            </span>
          </p>
          {workshops.length > 0 && (
            <p className="mt-3 text-sm text-paper/85">
              Your workshops: {workshops.map((w) => `${w.workshop!.title}${w.room ? ` (${w.room.name})` : ""}`).join(", ")}.
            </p>
          )}
        </div>
      </header>

      {!approved && <Notice>Your day fills in with your own workshops and rooms once your place is confirmed.</Notice>}
      {approved && !placesPublished && (
        <Notice title="Workshop places aren't out yet">Your three workshops and their rooms appear here as soon as the committee publishes places. We&apos;ll show you where to go on the day too.</Notice>
      )}

      <section aria-label="Your programme" className="rounded-2xl border border-navy/10 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-sm text-slate-700">
            On the day, what&apos;s on now and next is highlighted, and a reminder pops up on any page a few minutes before each part starts, telling you where to go.
          </p>
          <DayCalendarButton items={items} className="w-full sm:w-auto" />
        </div>
        <DayTimeline items={items} />
      </section>
    </div>
  );
}
