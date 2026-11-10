import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookmarkCheck, CalendarDays, MapPin, Megaphone } from "lucide-react";
import { NowNext } from "@/components/programme/now-next";
import { ProgrammeExplorer } from "@/components/programme/programme-explorer";
import { Notice } from "@/components/ui/notice";
import { getConferenceBundle } from "@/lib/data/content";
import { formatEventDate } from "@/lib/time";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Conference day",
  description: "Today's programme, what's on now and next, announcements and venue information.",
  alternates: { canonical: "/today" },
};

export default async function TodayPage() {
  const { edition, sessions, speakers, workshops, rooms, announcements } = await getConferenceBundle();
  return (
    <>
      <section className="surface-midnight relative overflow-hidden pb-14 pt-32 sm:pt-40">
        <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
        <div className="container-page relative">
          <p className="eyebrow flex items-center gap-3 text-cyan">
            <span className="size-2 animate-pulse-soft rounded-full bg-cyan" /> Conference day · {edition.name}
          </p>
          <h1 className="mt-6 text-display-lg font-normal">Your day at INSPIRE</h1>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-paper/75">
            <li className="flex items-center gap-2">
              <CalendarDays aria-hidden className="size-4 text-cyan" /> {formatEventDate(edition.date)}
            </li>
            <li className="flex items-center gap-2">
              <MapPin aria-hidden className="size-4 text-cyan" /> {edition.venueName}, {edition.venueAddress}
            </li>
          </ul>
          {!edition.eventDayMode && (
            <Notice dark className="mt-8 max-w-2xl">
              This guide is fully live on conference day. Until then it shows the latest programme and announcements.
            </Notice>
          )}
          <div className="mt-12">
            <NowNext sessions={sessions} />
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/programme?view=agenda" className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-cyan px-6 font-ui font-semibold text-midnight">
              <BookmarkCheck aria-hidden className="size-4" /> My agenda
            </Link>
            <Link href="/map" className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-paper px-6 font-ui font-semibold text-navy">
              <MapPin aria-hidden className="size-4" /> Campus map
            </Link>
            <Link href="/conference#venue" className="inline-flex min-h-12 items-center gap-2 rounded-[3px] border border-white/20 px-6 font-ui font-medium">
              Venue &amp; travel <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {announcements.length > 0 && (
        <section aria-labelledby="ann-title" className="bg-white py-14">
          <div className="container-page">
            <h2 id="ann-title" className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
              <Megaphone aria-hidden className="size-5 text-electric-600" /> Announcements
            </h2>
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {announcements.map((a) => (
                <li key={a.id} className={`rounded-lg border p-5 ${a.level === "urgent" ? "border-danger/30 bg-danger/[0.05]" : a.level === "important" ? "border-warning/30 bg-warning/[0.05]" : "border-navy/10 bg-paper"}`}>
                  <p className="font-semibold text-ink">{a.title}</p>
                  <p className="mt-1 text-slate-700">{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-label="Today's programme" className="bg-paper pb-24 pt-10">
        <div className="container-page">
          <ProgrammeExplorer sessions={sessions} speakers={speakers} workshops={workshops} rooms={rooms} editionName={edition.name} venue={`${edition.venueName}, ${edition.venueAddress}`} />
        </div>
      </section>
    </>
  );
}
