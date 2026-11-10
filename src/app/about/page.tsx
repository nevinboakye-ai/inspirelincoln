import type { Metadata } from "next";
import { Compass, Eye, Sparkles, Target, Users2, Lightbulb, Award, Zap } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { CommitteeDirectory } from "@/components/about/committee";
import { HistoryTimeline } from "@/components/about/timeline";
import { getCommittee, getPartners, getTimeline } from "@/lib/data/content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "About INSPIRE",
  description: "INSPIRE helps medical students explore research, develop academically and connect with researchers and clinicians. Our story, mission, values and committee.",
  alternates: { canonical: "/about" },
};

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
            <p>
              For more than a decade, INSPIRE has brought together medical students who are interested in research. It began as a way
              for students to share their work, learn from clinicians and researchers, and discover that research is something they
              can take part in long before they qualify.
            </p>
            <p>
              INSPIRE has historically connected medical students across Leicester, Nottingham and East Anglia. In 2026 the conference
              is hosted in Lincoln, in collaboration with the participating medical school community.
            </p>
            <p>
              Today INSPIRE is both an annual conference and a wider academic community. The conference changes host and theme each
              year; the mission stays the same.
            </p>
          </Reveal>
        </div>
      </section>

      <section aria-label="Mission and vision" className="surface-dark relative overflow-hidden py-24 sm:py-32">
        <div aria-hidden className="grid-lines absolute inset-0 opacity-50" />
        <div className="container-page relative grid gap-6 lg:grid-cols-2">
          {[
            { icon: Target, label: "Our mission", text: "To encourage student research engagement, academic development and collaboration, giving medical students the confidence to contribute to scientific and medical progress." },
            { icon: Eye, label: "Our vision", text: "A medical community in which students can meaningfully engage with research and contribute to future healthcare." },
          ].map((b, i) => (
            <Reveal key={b.label} delay={i * 0.1}>
              <div className="h-full rounded-xl border border-white/10 bg-white/[0.03] p-8 sm:p-12">
                <b.icon aria-hidden className="size-7 text-cyan" />
                <h2 className="eyebrow mt-8 text-cyan">{b.label}</h2>
                <p className="mt-4 font-display text-2xl font-medium leading-snug sm:text-3xl">{b.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-labelledby="values-title" className="bg-white py-24 sm:py-32">
        <div className="container-page">
          <SectionHeading eyebrow="Our values" title={<span id="values-title">What guides us</span>} />
          <Stagger className="mt-14 grid gap-px overflow-hidden rounded-xl border border-navy/10 bg-navy/10 sm:grid-cols-2 lg:grid-cols-5">
            {VALUES.map((v) => (
              <StaggerItem key={v.name} className="group bg-white p-7 transition-colors hover:bg-paper">
                <v.icon aria-hidden className="size-6 text-electric-600 transition-transform duration-500 group-hover:-translate-y-1" />
                <h3 className="mt-10 font-display text-2xl font-semibold text-ink">{v.name}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-700">{v.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section aria-labelledby="community-title" className="bg-paper py-24 sm:py-32">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading eyebrow="Our community" title={<span id="community-title">The participating medical school community</span>} />
            <p className="mt-6 text-slate-700">
              Labels describe how each community takes part. They do not imply sponsorship or formal institutional endorsement.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-8">
            {partners.map((p) => (
              <li key={p.id} className="flex min-h-28 flex-col justify-between rounded-lg border border-navy/10 bg-white p-6">
                <span className="font-display text-2xl font-semibold text-ink">{p.name}</span>
                <span className="mt-4 flex items-center gap-2 text-sm text-slate">
                  <Sparkles aria-hidden className="size-3.5 text-electric-600" /> {p.relationship}
                </span>
              </li>
            ))}
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
