import type { Metadata } from "next";
import { PageHero } from "@/components/layout/page-hero";
import { SpeakerDirectory } from "@/components/speakers/speaker-directory";
import { SpeakersSoon } from "@/components/speakers/speakers-soon";
import { getSpeakers } from "@/lib/data/content";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Speakers",
  description: "Invited speakers and workshop facilitators at the INSPIRE National Medical Research Conference.",
  alternates: { canonical: "/speakers" },
};

export default async function SpeakersPage() {
  const speakers = await getSpeakers();
  return (
    <>
      <PageHero
        eyebrow="Speakers"
        title={
          <>
            Clinicians. Researchers. <span className="text-cyan">Innovators.</span>
          </>
        }
        intro={speakers.length ? "Meet the healthcare and research professionals sharing their work and experience at INSPIRE." : "This year's speakers will be announced soon."}
        visual={
          <div aria-hidden className="absolute -right-10 bottom-0 hidden h-full w-1/2 lg:block">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="absolute rounded-full border border-cyan/20" style={{ width: 120 + i * 40, height: 120 + i * 40, right: 80 - i * 20, top: `${30 + i * 2}%` }} />
            ))}
          </div>
        }
      />
      <section className="bg-paper py-16 sm:py-24">
        <div className="container-page">
          {speakers.length === 0 ? (
            <SpeakersSoon />
          ) : (
            <>
              <div className="mb-10">
                <p className="eyebrow text-electric-600">Invited speakers</p>
                <h2 className="mt-3 text-display-sm font-normal text-ink">Invited by the committee</h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-slate-700">Healthcare and research professionals invited to give talks and lead workshops.</p>
              </div>
              <SpeakerDirectory speakers={speakers} />
            </>
          )}
        </div>
      </section>
    </>
  );
}
