import { Hero } from "@/components/home/hero";
import { Intro } from "@/components/home/intro";
import { ThemeSpotlight } from "@/components/home/theme-spotlight";
import { AtAGlance, BeyondSection, FinalCta, ProgrammePreview, ResearchSection, SpeakersSection, WorkshopsSection } from "@/components/home/sections";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import { getConferenceBundle, getResources } from "@/lib/data/content";
import { eventEnd, eventStart, formatEventDate } from "@/lib/time";

export const revalidate = 60;

export default async function HomePage() {
  const [{ edition, sessions, speakers, workshops }, resources] = await Promise.all([getConferenceBundle(), getResources()]);
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
      <Intro />
      <ThemeSpotlight theme={edition.theme} statement={edition.themeStatement} year={edition.year} />
      <AtAGlance edition={edition} workshopCount={workshops.length} />
      <ProgrammePreview sessions={sessions} />
      <SpeakersSection speakers={speakers} />
      <WorkshopsSection workshops={workshops} />
      <ResearchSection edition={edition} />
      <BeyondSection resources={resources} />
      <FinalCta edition={edition} />
    </>
  );
}
