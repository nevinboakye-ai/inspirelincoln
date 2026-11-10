import { Hero } from "@/components/home/hero";
import { AtAGlance, FinalCta, ProgrammePreview, SpeakersSection } from "@/components/home/sections";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import { getConferenceBundle } from "@/lib/data/content";
import { eventEnd, eventStart, formatEventDate } from "@/lib/time";

export const revalidate = 60;

export default async function HomePage() {
  const { edition, sessions, speakers, workshops } = await getConferenceBundle();
  const start = eventStart(edition);
  return (
    <>
      <EventJsonLd edition={edition} />
      <Hero
        year={edition.year}
        theme={edition.theme}
        dateLabel={formatEventDate(edition.date)}
        venue={`${edition.venueName}, ${edition.venueInstitution}`}
        startIso={start.at.toISOString()}
        endIso={eventEnd(edition).toISOString()}
        hasConfirmedTime={start.hasConfirmedTime}
        status={edition.status}
      />
      <AtAGlance edition={edition} workshopCount={workshops.length} />
      <ProgrammePreview sessions={sessions} />
      <SpeakersSection speakers={speakers} />
      <FinalCta edition={edition} />
    </>
  );
}
