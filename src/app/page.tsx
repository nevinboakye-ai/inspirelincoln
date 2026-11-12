import { Hero } from "@/components/home/hero";
import { IntroGate } from "@/components/home/intro-gate";
import { AtAGlance } from "@/components/home/sections";
import { OurStory } from "@/components/home/our-story";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import { getConferenceBundle } from "@/lib/data/content";
import { eventEnd, eventStart, formatEventDate } from "@/lib/time";

export const revalidate = 60;

export default async function HomePage() {
  const { edition, workshops } = await getConferenceBundle();
  const start = eventStart(edition);
  return (
    <>
      <IntroGate edition={edition} />
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
      <OurStory />
    </>
  );
}
