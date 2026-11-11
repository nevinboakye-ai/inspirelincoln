import type { Metadata } from "next";
import { ArrowUpRight, Award, Compass, Eye, Lightbulb, MapPin, Target, Users2, Zap } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { CommitteeDirectory } from "@/components/about/committee";
import { PurposeDeck } from "@/components/about/purpose-deck";
import { HistoryTimeline } from "@/components/about/timeline";
import { STORY } from "@/content/story";
import { schoolDetails } from "@/content/schools";
import { getCommittee, getPartners, getTimeline } from "@/lib/data/content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "About INSPIRE",
  description: "INSPIRE helps medical students explore research, develop academically and connect with researchers and clinicians. Our story, mission, values and committee.",
  alternates: { canonical: "/about" },
};

const MISSION = "To encourage student research engagement, academic development and collaboration, giving medical students the confidence to contribute to scientific and medical progress.";
const VISION = "A medical community in which students can meaningfully engage with research and contribute to future healthcare.";

const VALUES = [
  { icon: Lightbulb, name: "Curiosity", body: "Good research starts with a question. We celebrate asking them." },
  { icon: Users2, name: "Collaboration", body: "Progress in medicine is a team effort, across schools, specialties and career stages." },
  { icon: Compass, name: "Opportunity", body: "Every student should have a fair route into research, whatever their background." },
  { icon: Award, name: "Excellence", body: "We hold ourselves, and the work we showcase, to high academic standards." },
  { icon: Zap, name: "Impact", body: "Research matters when it improves care. We keep patients in view." },
];

export default async function AboutPage() {
  const [committee, partners, timeline] = await Promise.all([getCommittee(), getPartners(), getTimeline()]);
  return (
    <>
      <PageHero
        eyebrow="About INSPIRE"
        title={
          <>
            Where curiosity becomes <span className="text-cyan">contribution.</span>
          </>
        }
        intro="INSPIRE is a national medical research conference and community run by and for medical students who want to explore research, grow academically and connect with the people shaping the future of healthcare."
        visual={
          <svg aria-hidden viewBox="0 0 600 600" className="absolute -right-24 top-1/2 h-[140%] -translate-y-1/2 opacity-30">
            {Array.from({ length: 7 }, (_, i) => (
              <circle key={i} cx="300" cy="300" r={60 + i * 34} fill="none" stroke={i % 2 ? "#9FB4D4" : "#C9D8EC"} strokeOpacity={0.6 - i * 0.06} strokeDasharray={i % 3 === 0 ? "2 8" : undefined} />
            ))}
          </svg>
        }
      />

      <section aria-labelledby="story-title" className="bg-paper py-24 sm:py-32">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <SectionHeading eyebrow="Our story" title={<span id="story-title">More than a decade of student research</span>} />
          </Reveal>
          <Reveal delay={0.1} className="prose-inspire lg:col-span-7 lg:col-start-6">
            {STORY.map((ch) => (
              <p key={ch.label}>{ch.text}</p>
            ))}
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="purpose-title" className="surface-dark relative overflow-hidden py-24 sm:py-32">
        <div aria-hidden className="grid-lines absolute inset-0 opacity-50" />
        <div className="container-page relative grid items-center gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <SectionHeading dark eyebrow="Mission, vision and values" title={<span id="purpose-title">What guides us</span>} />
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-6 lg:col-start-7">
            <PurposeDeck mission={MISSION} vision={VISION} values={VALUES} icons={{ mission: Target, vision: Eye }} />
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="community-title" className="bg-paper py-24 sm:py-32">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading eyebrow="Our community" title={<span id="community-title">Participating medical schools</span>} />
            <p className="mt-6 text-slate-700">Students from these medical schools take part in INSPIRE.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
            {partners.map((p) => {
              const d = schoolDetails(p.name);
              return (
                <li key={p.id} className="flex flex-col rounded-xl border border-navy/10 bg-white p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-display text-2xl font-semibold leading-tight text-ink">{d?.fullName ?? p.name}</h3>
                      {d && <p className="mt-1 text-sm text-slate-700">{d.university}</p>}
                      {/host/i.test(p.relationship) && <p className="mt-2 font-ui text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">{p.relationship}</p>}
                    </div>
                    {d && (
                      <span className="shrink-0 rounded-full bg-paper px-3 py-1 font-ui text-xs font-semibold text-navy">
                        <span aria-hidden>Since {d.since}</span>
                        <span className="sr-only">First students in {d.since}</span>
                      </span>
                    )}
                  </div>
                  {d && <p className="mt-4 text-[0.95rem] leading-relaxed text-slate-700">{d.summary}</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-5 text-sm">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <MapPin aria-hidden className="size-3.5 text-electric-600" /> {d?.place ?? p.relationship}
                    </span>
                    {(d?.url ?? p.url) && (
                      <a href={d?.url ?? p.url ?? undefined} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-electric-600 underline-offset-4 hover:underline">
                        Visit website <ArrowUpRight aria-hidden className="size-3.5" />
                        <span className="sr-only"> for {d?.fullName ?? p.name} (opens in a new tab)</span>
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="leadership-title" className="bg-white py-24 sm:py-32">
        <div className="container-page">
          <SectionHeading eyebrow="Leadership" title={<span id="leadership-title">The INSPIRE committee</span>} intro="The team who organise INSPIRE, from programme to prizes." />
          <div className="mt-12">
            <CommitteeDirectory members={committee} />
          </div>
        </div>
      </section>

      <section aria-labelledby="timeline-title" className="surface-midnight relative overflow-hidden py-24 sm:py-32">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading dark eyebrow="Timeline" title={<span id="timeline-title">Our history</span>} intro="Only verified milestones are shown." />
          </div>
          <div className="lg:col-span-8">
            <HistoryTimeline events={timeline} />
          </div>
        </div>
      </section>
    </>
  );
}
