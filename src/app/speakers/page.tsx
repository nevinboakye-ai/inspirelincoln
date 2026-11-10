import type { Metadata } from "next";
import { PageHero } from "@/components/layout/page-hero";
import { SpeakerDirectory } from "@/components/speakers/speaker-directory";
import { PlaceholderTag } from "@/components/ui/badge";
import { getSpeakers } from "@/lib/data/content";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Speakers",
  description: "Keynote speakers, presenters and workshop facilitators at the INSPIRE National Medical Research Conference.",
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
        intro="Meet the healthcare and research professionals sharing their work and experience at INSPIRE."
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
            <div className="relative overflow-hidden rounded-xl border border-dashed border-navy/20 bg-white px-6 py-20 text-center">
              <PlaceholderTag>Placeholder</PlaceholderTag>
              <h2 className="mt-6 font-display text-3xl font-semibold text-ink">Speaker announcement coming soon</h2>
              <p className="mx-auto mt-4 max-w-lg text-slate-700">
                Confirmed speakers will be listed here with their biography, institution and sessions. Check back soon, or explore the
                programme in the meantime.
              </p>
            </div>
          ) : (
            <SpeakerDirectory speakers={speakers} />
          )}
        </div>
      </section>
    </>
  );
}
