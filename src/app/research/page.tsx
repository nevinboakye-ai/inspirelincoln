import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarClock, CheckCircle2, FileText, Printer, RectangleHorizontal, RectangleVertical, Send } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { PlaceholderTag } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { getEdition, getResources } from "@/lib/data/content";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Research & Abstracts",
  description: "Abstract submissions, presenter guidance, poster requirements, the research showcase and resources for student researchers at INSPIRE.",
  alternates: { canonical: "/research" },
};

const fmt = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(`${d.slice(0, 10)}T12:00:00Z`));

export default async function ResearchPage() {
  const [edition, resources] = await Promise.all([getEdition(), getResources()]);
  const cfg = edition.abstractConfig;
  const resourceGroups = [...new Set(resources.map((r) => r.category))];

  return (
    <>
      <PageHero
        eyebrow="Research & Abstracts"
        title={
          <>
            Your research <span className="text-cyan">deserves to be seen.</span>
          </>
        }
        intro="Everything you need to submit, present and share student research at INSPIRE, before, during and after the conference."
        visual={
          <svg aria-hidden viewBox="0 0 500 400" className="absolute -right-10 bottom-0 hidden h-[90%] opacity-40 lg:block">
            <rect x="140" y="40" width="240" height="320" rx="10" fill="none" stroke="#C9D8EC" strokeOpacity="0.5" />
            <rect x="165" y="70" width="190" height="24" rx="4" fill="#C9D8EC" fillOpacity="0.3" />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={165 + (i % 2) * 100} y={115 + Math.floor(i / 2) * 110} width="90" height="95" rx="4" fill="none" stroke="#9FB4D4" strokeOpacity="0.6" />
            ))}
          </svg>
        }
      >
        <nav aria-label="On this page" className="mt-10 flex flex-wrap gap-2">
          {[
            ["Why present", "#why"],
            ["Abstract submissions", "#abstracts"],
            ["Presenter guidance", "#presenters"],
            ["Showcase", "/research/showcase"],
            ["Resources", "#resources"],
          ].map(([l, h]) => (
            <Link key={h} href={h} className="rounded-[3px] border border-white/15 px-4 py-2 text-sm text-paper/80 hover:border-white/40 hover:text-paper">
              {l}
            </Link>
          ))}
        </nav>
      </PageHero>

      <section id="why" aria-labelledby="why-title" className="scroll-mt-24 bg-paper py-24">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <SectionHeading eyebrow="Research at INSPIRE" title={<span id="why-title">Research is not finished until it is shared</span>} />
          </Reveal>
          <Reveal delay={0.1} className="prose-inspire lg:col-span-7">
            <p>
              Dissemination turns a project into knowledge others can use, question and build on. For students, presenting is also one of
              the best ways to learn: you have to explain your methods clearly, defend your conclusions and listen to challenge.
            </p>
            <p>
              INSPIRE gives student researchers a supportive, academic setting to do exactly that, with clinicians and researchers in the
              room who want to see you succeed.
            </p>
          </Reveal>
        </div>
      </section>

      <section id="abstracts" aria-labelledby="abs-title" className="scroll-mt-24 bg-white py-24">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Abstract submissions" title={<span id="abs-title">Submitting an abstract</span>} />
            <span className={cfg.submissionsOpen ? "rounded-[3px] bg-success/10 px-4 py-2 text-sm font-semibold text-success" : "rounded-[3px] bg-paper-200 px-4 py-2 text-sm font-semibold text-slate-700"}>
              Submissions {cfg.submissionsOpen ? "open" : "closed"}
            </span>
          </div>
          {!cfg.submissionsOpen && (
            <Notice className="mt-8">
              Abstract submissions for INSPIRE {edition.year} are closed. Requirements below will be updated for the next conference cycle.
            </Notice>
          )}
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-navy/10 bg-paper p-7">
              <CalendarClock aria-hidden className="size-6 text-electric-600" />
              <h3 className="mt-6 font-display text-xl font-semibold text-ink">Deadlines</h3>
              <dl className="mt-4 space-y-3 text-slate-700">
                <div>
                  <dt className="text-sm text-slate">Opens</dt>
                  <dd>{cfg.opensAt ? fmt(cfg.opensAt) : "To be announced"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate">Closes</dt>
                  <dd>{cfg.closesAt ? fmt(cfg.closesAt) : "To be announced"}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-xl border border-navy/10 bg-paper p-7">
              <CheckCircle2 aria-hidden className="size-6 text-electric-600" />
              <h3 className="mt-6 font-display text-xl font-semibold text-ink">Eligibility</h3>
              <ul className="mt-4 space-y-2 text-slate-700">
                {cfg.eligibility.map((e) => (
                  <li key={e} className="flex gap-2">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-electric-600" /> {e}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-navy/10 bg-paper p-7">
              <FileText aria-hidden className="size-6 text-electric-600" />
              <h3 className="mt-6 font-display text-xl font-semibold text-ink">Format</h3>
              <ul className="mt-4 space-y-2 text-slate-700">
                {cfg.formatting.map((e) => (
                  <li key={e} className="flex gap-2">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-electric-600" /> {e}
                  </li>
                ))}
                <li className="flex gap-2">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-electric-600" /> Up to {cfg.totalWordLimit} words in total, {cfg.sectionWordLimit} per section.
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-navy/10 p-7">
              <h3 className="font-display text-lg font-semibold text-ink">Research categories</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {cfg.categories.map((c) => (
                  <li key={c} className="rounded-full bg-paper-200 px-3 py-1.5 text-sm text-slate-700">{c}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-navy/10 p-7">
              <h3 className="font-display text-lg font-semibold text-ink">Presentation categories</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {cfg.presentationTypes.map((c) => (
                  <li key={c} className="rounded-full bg-paper-200 px-3 py-1.5 text-sm text-slate-700">{c}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            {cfg.submissionsOpen ? (
              <Link href="/portal/abstracts/new" className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700">
                <Send aria-hidden className="size-4" /> Submit an abstract
              </Link>
            ) : null}
            <Link href="/portal" className="inline-flex min-h-12 items-center gap-2 rounded-[3px] border border-navy/15 px-6 font-ui font-medium text-ink hover:border-navy/40">
              Check my submission status
            </Link>
          </div>
        </div>
      </section>

      <section id="presenters" aria-labelledby="pres-title" className="surface-dark relative scroll-mt-24 overflow-hidden py-24">
        <div aria-hidden className="grid-lines absolute inset-0 opacity-50" />
        <div className="container-page relative">
          <SectionHeading dark eyebrow={`${edition.year} presenter guidance`} title={<span id="pres-title">Accepted poster presenters</span>} intro="Please read these requirements carefully. They are set by the conference team and may be updated." />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-cyan/30 bg-cyan/[0.06] p-7">
              <CalendarClock aria-hidden className="size-6 text-cyan" />
              <p className="eyebrow mt-6 text-cyan">Deadline</p>
              <p className="mt-2 font-display text-2xl font-semibold">{edition.posterDeadline ? fmt(edition.posterDeadline) : "To be confirmed"}</p>
              <p className="mt-2 text-paper/65">Submit your poster by this date.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-7">
              <div className="flex gap-2 text-cyan">
                <RectangleHorizontal aria-hidden className="size-6" />
                <RectangleVertical aria-hidden className="size-6" />
              </div>
              <p className="eyebrow mt-6 text-cyan">Orientation</p>
              <p className="mt-2 font-display text-2xl font-semibold">Landscape or portrait</p>
              <p className="mt-2 text-paper/65">Either orientation is accepted.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-7">
              <Printer aria-hidden className="size-6 text-cyan" />
              <p className="eyebrow mt-6 text-cyan">On the day</p>
              <p className="mt-2 font-display text-2xl font-semibold">Bring a printed copy</p>
              <p className="mt-2 text-paper/65">Presenters are expected to bring their poster printed.</p>
            </div>
          </div>
          <ul className="mt-10 space-y-2 text-paper/75">
            {edition.posterRequirements.map((r) => (
              <li key={r} className="flex gap-3">
                <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-cyan" />
                {r}
              </li>
            ))}
          </ul>
          <Link href="/portal/presenter" className="mt-10 inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-cyan px-6 font-ui font-semibold text-midnight hover:bg-cyan-300">
            Presenter portal <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="showcase-title" className="bg-paper py-24">
        <div className="container-page flex flex-col items-start justify-between gap-8 rounded-xl border border-navy/10 bg-white p-8 sm:p-12 lg:flex-row lg:items-center">
          <div>
            <p className="eyebrow text-electric-600">Research showcase</p>
            <h2 id="showcase-title" className="mt-3 text-display-sm font-medium text-ink">Explore approved student research</h2>
            <p className="mt-3 max-w-2xl text-slate-700">Abstracts appear in the public showcase only when presenters have given consent and the conference team has approved them.</p>
          </div>
          <Link href="/research/showcase" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-medium text-paper hover:bg-navy-700">
            View showcase <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>

      <section id="resources" aria-labelledby="res-title" className="scroll-mt-24 bg-white py-24">
        <div className="container-page">
          <SectionHeading eyebrow="Research resources" title={<span id="res-title">Build your research skills</span>} intro="Trusted, freely available guidance on writing abstracts, appraising evidence and research methods. Links open the publisher's website." />
          {resources.length === 0 ? (
            <p className="mt-10 text-slate-700">Resources will be added soon.</p>
          ) : (
            <div className="mt-12 space-y-10">
              {resourceGroups.map((g) => (
                <div key={g}>
                  <h3 className="eyebrow text-slate">{g}</h3>
                  <ul className="mt-4 grid gap-3 md:grid-cols-2">
                    {resources
                      .filter((r) => r.category === g)
                      .map((r) => (
                        <li key={r.id}>
                          <a href={r.url ?? "#"} target="_blank" rel="noopener noreferrer" className="group flex h-full items-start justify-between gap-4 rounded-lg border border-navy/10 p-6 transition-colors hover:border-electric-600/40 hover:bg-paper">
                            <span>
                              <span className="block font-display text-lg font-medium text-ink">{r.title}</span>
                              <span className="mt-1 block text-[0.95rem] text-slate-700">{r.summary}</span>
                              {r.isExample && <span className="mt-3 inline-block"><PlaceholderTag>Example</PlaceholderTag></span>}
                            </span>
                            <ArrowUpRight aria-hidden className="size-5 shrink-0 text-electric-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
