import type { Metadata } from "next";
import { PageHero } from "@/components/layout/page-hero";
import { OralPresenters } from "@/components/speakers/oral-presenters";
import { SpeakerDirectory } from "@/components/speakers/speaker-directory";
import { SpeakersSoon } from "@/components/speakers/speakers-soon";
import { getOralPresenters, getSpeakers } from "@/lib/data/content";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Speakers",
  description: "Invited speakers and workshop facilitators at the INSPIRE National Medical Research Conference, and the medical students who presented their research as oral presenters.",
  alternates: { canonical: "/speakers" },
};

export default async function SpeakersPage() {
  const [speakers, presenters] = await Promise.all([getSpeakers(), getOralPresenters()]);
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
      >
        {presenters.length > 0 && (
          <a href="#oral-presenters" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-gold/60 px-4 text-sm font-semibold text-gold-300 hover:bg-gold/10">
            Jump to the student oral presenters
          </a>
        )}
      </PageHero>
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
      {presenters.length > 0 && <OralPresenters presenters={presenters} />}
    </>
  );
}
