import type { Metadata } from "next";
import { PageHero } from "@/components/layout/page-hero";
import { ProgrammeExplorer } from "@/components/programme/programme-explorer";
import { Notice } from "@/components/ui/notice";
import { getConferenceBundle } from "@/lib/data/content";
import { formatEventDate } from "@/lib/time";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { edition } = await getConferenceBundle();
  return {
    title: "Programme",
    description: `The interactive programme for ${edition.name}: keynotes, research presentations, workshops and networking. Build and export your personal agenda.`,
    alternates: { canonical: "/programme" },
  };
}

export default async function ProgrammePage() {
  const { edition, sessions, speakers, workshops, rooms } = await getConferenceBundle();
  const provisional = sessions.some((s) => s.isProvisional);
  return (
    <>
      <PageHero
        eyebrow={`${edition.name} · Programme`}
        title={
          <>
            Plan your day at <span className="text-cyan">INSPIRE</span>
          </>
        }
        intro={`${formatEventDate(edition.date)} at ${edition.venueName}. Browse every session, filter by what interests you and save sessions to your personal agenda.`}
        visual={
          <svg aria-hidden viewBox="0 0 800 400" preserveAspectRatio="none" className="absolute bottom-0 right-0 h-[65%] w-2/3 opacity-40">
            {Array.from({ length: 9 }, (_, i) => (
              <rect key={i} x={120 + i * 72} y={60 + ((i * 37) % 140)} width={14 + ((i * 23) % 40)} height={6} rx={3} fill={["#39D5F2", "#3478F6", "#8578F9"][i % 3]} opacity={0.7}>
                <animate attributeName="width" values={`${20 + i * 3};${80 + i * 6};${20 + i * 3}`} dur={`${6 + i}s`} repeatCount="indefinite" />
              </rect>
            ))}
          </svg>
        }
      />
      <section className="bg-paper pb-24">
        <div className="container-page">
          {provisional && (
            <Notice title="Provisional programme" tone="warning" className="mt-8">
              Session times, rooms and speakers have not been confirmed yet. This programme shows the planned flow of the day and
              will be updated by the conference team. You can still save sessions to your agenda now.
            </Notice>
          )}
          <div className="mt-8">
            <ProgrammeExplorer
              sessions={sessions}
              speakers={speakers}
              workshops={workshops}
              rooms={rooms}
              editionName={edition.name}
              venue={`${edition.venueName}, ${edition.venueAddress}`}
            />
          </div>
        </div>
      </section>
    </>
  );
}
