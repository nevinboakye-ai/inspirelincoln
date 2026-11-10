import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenCheck, Coffee, FlaskConical, Mic2, PartyPopper, Presentation, Users } from "lucide-react";
import type { Edition, Resource, Session, Speaker, Workshop } from "@/lib/types";
import { SESSION_CATEGORY_LABEL } from "@/lib/types";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { CountUp } from "@/components/visual/count-up";
import { WorkshopMotif, ACCENT_HEX } from "@/components/visual/workshop-motif";
import { PlaceholderTag } from "@/components/ui/badge";
import { formatTime } from "@/lib/time";
import { SpeakerCarousel } from "./speaker-carousel";

/* ---------------- D: At a glance ---------------- */
export function AtAGlance({ edition, workshopCount }: { edition: Edition; workshopCount: number }) {
  const stats = [
    { value: edition.expectedAttendance, prefix: "~", label: "Expected delegates", note: "Projected attendance" },
    { value: workshopCount, label: "Interactive workshops", note: "Planned, clinician-led" },
    { text: "National", label: "Medical student community", note: "Students from across participating schools" },
    { value: 1, label: "Day of research, learning and networking", note: "Saturday, in Lincoln" },
  ];
  return (
    <section aria-labelledby="glance-title" className="relative bg-paper py-24 sm:py-28">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <Reveal>
            <p className="eyebrow mb-4 flex items-center gap-3 text-electric-600">
              <span aria-hidden className="h-px w-8 bg-electric-600/50" /> At a glance
            </p>
            <h2 id="glance-title" className="text-display-md font-normal text-ink">
              INSPIRE {edition.year} in numbers
            </h2>
          </Reveal>
          <p className="max-w-sm text-sm text-slate">Figures describe plans for this year&apos;s conference, not past results.</p>
        </div>
        <Stagger className="mt-14 grid border-t border-navy/10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <StaggerItem key={s.label} className="border-b border-navy/10 py-10 sm:pr-8 lg:border-b-0 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0">
              <p className="font-display text-[clamp(3.5rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.05em] text-ink">
                {"text" in s && s.text ? (
                  <span className="text-[0.6em] tracking-[-0.03em]">{s.text}</span>
                ) : s.value != null ? (
                  <CountUp value={s.value} prefix={s.prefix} />
                ) : (
                  "TBC"
                )}
              </p>
              <p className="mt-4 font-display text-lg font-medium text-ink">{s.label}</p>
              <p className="mt-1 text-sm text-slate">{s.note}</p>
              <span aria-hidden className="mt-6 block h-1 w-12 rounded-full" style={{ background: ["#C9D8EC", "#3A5F94", "#9FB4D4", "#1A3154"][i] }} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ---------------- E: Featured programme ---------------- */
const CATEGORY_ICON = {
  keynote: Mic2,
  research: FlaskConical,
  workshop: Presentation,
  networking: Users,
  break: Coffee,
  closing: PartyPopper,
} as const;

export function ProgrammePreview({ sessions }: { sessions: Session[] }) {
  const preview = sessions.filter((s) => s.category !== "break").slice(0, 6);
  const provisional = sessions.some((s) => s.isProvisional);
  return (
    <section aria-labelledby="programme-title" className="relative overflow-hidden bg-paper-200 py-24 sm:py-32">
      <div className="container-page grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <p className="eyebrow mb-4 flex items-center gap-3 text-electric-600">
            <span aria-hidden className="h-px w-8 bg-electric-600/50" /> Programme
          </p>
          <h2 id="programme-title" className="text-display-md font-normal text-ink">
            The shape of the day
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-700">
            Keynotes, student research, clinician-led workshops and time to connect. Build your own agenda and export it to your
            calendar once times are confirmed.
          </p>
          {provisional && (
            <div className="mt-6">
              <PlaceholderTag>Provisional: times to be confirmed</PlaceholderTag>
            </div>
          )}
          <Link href="/programme" className="group mt-8 inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-medium text-paper hover:bg-navy-700">
            Open the full programme <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <ol className="relative lg:col-span-8">
          <span aria-hidden className="absolute bottom-6 left-[1.4rem] top-6 w-px bg-gradient-to-b from-electric via-cyan to-violet opacity-40" />
          {preview.map((s, i) => {
            const Icon = CATEGORY_ICON[s.category];
            return (
              <li key={s.id}>
                <Reveal delay={i * 0.06}>
                  <Link
                    href={`/programme?session=${s.slug}`}
                    className="group relative flex items-start gap-5 rounded-lg p-3 transition-colors hover:bg-white sm:p-4"
                  >
                    <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-navy/10 bg-white text-electric-600 shadow-sm transition-colors group-hover:bg-navy group-hover:text-cyan">
                      <Icon aria-hidden className="size-[1.1rem]" />
                    </span>
                    <span className="min-w-0 flex-1 border-b border-navy/10 pb-5">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate">
                        {SESSION_CATEGORY_LABEL[s.category]}
                        <span className="font-normal normal-case tracking-normal">
                          {s.startsAt ? formatTime(s.startsAt) : "Time TBC"}
                        </span>
                      </span>
                      <span className="mt-1.5 block font-display text-xl font-medium text-ink">{s.title}</span>
                      <span className="mt-1 line-clamp-2 block text-sm text-slate-700">{s.description}</span>
                    </span>
                    <ArrowUpRight aria-hidden className="mt-3 size-5 shrink-0 text-slate opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- F: Speakers ---------------- */
export function SpeakersSection({ speakers }: { speakers: Speaker[] }) {
  return (
    <section aria-labelledby="speakers-title" className="surface-dark relative overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="absolute right-0 top-0 size-[30rem] rounded-full bg-violet/15 blur-[140px]" />
      <div className="container-page relative">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <Reveal>
            <p className="eyebrow mb-4 flex items-center gap-3 text-cyan">
              <span aria-hidden className="h-px w-8 bg-cyan/60" /> Speakers
            </p>
            <h2 id="speakers-title" className="text-display-md font-normal">
              Voices from research and practice
            </h2>
          </Reveal>
          <Link href="/speakers" className="group inline-flex items-center gap-2 font-ui font-medium text-cyan">
            All speakers <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <SpeakerCarousel speakers={speakers} />
      </div>
    </section>
  );
}

/* ---------------- G: Workshops ---------------- */
export function WorkshopGrid({ workshops, compact = false }: { workshops: Workshop[]; compact?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workshops.map((w, i) => (
        <li key={w.id}>
          <Reveal delay={(i % 3) * 0.08} className="h-full">
            <Link
              href={`/workshops/${w.slug}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-navy/10 bg-white transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:border-navy/20 hover:shadow-[0_32px_64px_-32px_rgba(26,49,84,0.45)]"
            >
              <div className="relative h-44 overflow-hidden bg-navy">
                <div aria-hidden className="grid-lines absolute inset-0 opacity-70" />
                <div
                  aria-hidden
                  className="absolute -bottom-16 left-1/2 size-48 -translate-x-1/2 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
                  style={{ background: ACCENT_HEX[w.accent] }}
                />
                <WorkshopMotif motif={w.motif} accent={w.accent} className="relative" />
                <span className="absolute left-5 top-4 font-ui text-sm font-medium text-paper/60">Workshop {String(w.number).padStart(2, "0")}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-xl font-semibold text-ink">{w.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-700">{w.summary}</p>
                {!compact && w.outcomes.length > 0 && (
                  <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-[var(--ease-out-expo)] group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]">
                    <ul className="overflow-hidden text-sm text-slate-700">
                      <li className="pt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate">You will</li>
                      {w.outcomes.slice(0, 3).map((o) => (
                        <li key={o} className="mt-2 flex gap-2">
                          <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full" style={{ background: ACCENT_HEX[w.accent] }} />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-6">
                  <span className="text-xs text-slate">{w.facilitator ? `Led by ${w.facilitator}` : "Facilitator to be announced"}</span>
                  <span className="inline-flex items-center gap-1.5 font-ui text-sm font-semibold text-electric-600">
                    Explore Workshop <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

export function WorkshopsSection({ workshops }: { workshops: Workshop[] }) {
  return (
    <section aria-labelledby="workshops-title" className="bg-paper py-24 sm:py-32">
      <div className="container-page">
        <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <Reveal className="max-w-2xl">
            <p className="eyebrow mb-4 flex items-center gap-3 text-electric-600">
              <span aria-hidden className="h-px w-8 bg-electric-600/50" /> Workshops
            </p>
            <h2 id="workshops-title" className="text-display-md font-normal text-ink">
              Six workshops. Learn by doing.
            </h2>
            <p className="mt-5 text-lg text-slate-700">Small-group, clinician-led sessions designed around practical skills you can use straight away.</p>
          </Reveal>
          <Link href="/workshops" className="group inline-flex items-center gap-2 font-ui font-medium text-electric-600">
            All workshops <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <WorkshopGrid workshops={workshops} />
      </div>
    </section>
  );
}

/* ---------------- H: Research showcase ---------------- */
export function ResearchSection({ edition }: { edition: Edition }) {
  const links = [
    { label: "Research at INSPIRE", href: "/research" },
    { label: "Abstract guidance", href: "/research#abstracts" },
    { label: "Presentation requirements", href: "/research#presenters" },
    { label: "Research resources", href: "/research#resources" },
  ];
  return (
    <section aria-labelledby="research-title" className="relative overflow-hidden bg-white py-24 sm:py-32">
      <div className="container-page grid gap-14 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <p className="eyebrow mb-4 flex items-center gap-3 text-electric-600">
            <span aria-hidden className="h-px w-8 bg-electric-600/50" /> Student research
          </p>
          <h2 id="research-title" className="text-display-lg font-normal text-ink">
            Your Research Deserves to Be Seen.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-700">
            Sharing your work is part of doing research. Presenting a poster lets you explain your methods, defend your findings,
            hear new perspectives and practise the skills every clinician-researcher needs. At INSPIRE, student research sits at
            the centre of the day.
          </p>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="group flex min-h-14 items-center justify-between rounded-md border border-navy/10 px-5 font-medium text-ink transition-colors hover:border-electric-600/40 hover:bg-paper">
                  {l.label}
                  <ArrowRight aria-hidden className="size-4 text-electric-600 transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.15} className="lg:col-span-5">
          <div className="relative overflow-hidden rounded-xl bg-navy p-8 text-paper sm:p-10">
            <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
            <div aria-hidden className="absolute -right-20 -top-20 size-64 rounded-full bg-cyan/20 blur-3xl" />
            <div className="relative">
              <BookOpenCheck aria-hidden className="size-7 text-cyan" />
              <p className="eyebrow mt-6 text-cyan">For accepted presenters</p>
              {edition.posterDeadline && (
                <p className="mt-3 font-display text-3xl font-semibold leading-tight">
                  Posters due{" "}
                  {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date(`${edition.posterDeadline}T12:00:00Z`))}
                </p>
              )}
              <ul className="mt-6 space-y-3 text-paper/80">
                {edition.posterRequirements.map((r) => (
                  <li key={r} className="flex gap-3">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-cyan" />
                    {r}
                  </li>
                ))}
              </ul>
              <Link href="/research#presenters" className="mt-8 inline-flex items-center gap-2 font-ui font-semibold text-cyan">
                Presenter guidance <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- I: Beyond the conference ---------------- */
export function BeyondSection({ resources }: { resources: Resource[] }) {
  const items = [
    { title: "Educational resources", body: "Curated guides on abstract writing, critical appraisal and research methods.", status: resources.length ? "Available now" : "Planned", href: "/research#resources" },
    { title: "Research skills development", body: "Workshops and masterclasses that build practical research skills through the year.", status: "Planned", href: "/opportunities" },
    { title: "Academic mentorship and networking", body: "Connecting students with researchers and clinicians who can guide their next steps.", status: "Planned", href: "/opportunities" },
    { title: "Research opportunities", body: "A shared noticeboard for projects, collaborations and presentation opportunities.", status: "Planned", href: "/opportunities" },
    { title: "Future conferences", body: "INSPIRE continues each year, hosted with the participating medical school community.", status: "Ongoing", href: "/about" },
  ];
  return (
    <section aria-labelledby="beyond-title" className="relative bg-paper py-24 sm:py-32">
      <div className="container-page grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <p className="eyebrow mb-4 flex items-center gap-3 text-electric-600">
            <span aria-hidden className="h-px w-8 bg-electric-600/50" /> Beyond the conference
          </p>
          <h2 id="beyond-title" className="text-display-md font-normal text-ink">
            A community, all year round
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-700">
            INSPIRE is growing beyond a single day. Here is what is available now and what we are building next.
          </p>
        </Reveal>
        <ul className="divide-y divide-navy/10 border-y border-navy/10 lg:col-span-8">
          {items.map((it, i) => (
            <li key={it.title}>
              <Reveal delay={i * 0.05}>
                <Link href={it.href} className="group grid gap-2 py-7 transition-colors sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8">
                  <span>
                    <span className="flex items-center gap-3 font-display text-xl font-medium text-ink sm:text-2xl">
                      {it.title}
                      <ArrowRight aria-hidden className="size-5 -translate-x-2 text-electric-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </span>
                    <span className="mt-1 block text-slate-700">{it.body}</span>
                  </span>
                  <span
                    className={
                      it.status === "Planned"
                        ? "w-fit rounded-full border border-dashed border-slate/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate"
                        : "w-fit rounded-full bg-success/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-success"
                    }
                  >
                    {it.status}
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- J: Final CTA ---------------- */
export function FinalCta({ edition }: { edition: Edition }) {
  return (
    <section aria-labelledby="cta-title" className="surface-midnight noise relative isolate overflow-hidden py-32 sm:py-40">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_100%,rgba(58,95,148,0.35),transparent_70%)]" />
        <Image src="/brand/crest-white.png" alt="" width={338} height={397} className="absolute left-1/2 top-1/2 h-[120%] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.04]" />
      </div>
      <div className="container-page relative text-center">
        <Reveal>
          <p className="eyebrow text-cyan">INSPIRE {edition.year} · {edition.venueName}</p>
          <h2 id="cta-title" className="mx-auto mt-6 max-w-5xl text-display-xl font-normal">
            Be part of <span className="italic font-light text-cyan">what comes next.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-lg text-paper/70">
            Whether you are presenting your first poster or simply curious about research, there is a place for you at INSPIRE.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/conference#registration" className="inline-flex min-h-14 items-center gap-2 rounded-[3px] bg-cyan px-8 font-ui font-semibold text-midnight transition-[background-color,box-shadow] hover:bg-cyan-300 hover:shadow-[0_12px_40px_-10px_rgba(201,216,236,0.7)]">
              Registration information <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href="/conference" className="inline-flex min-h-14 items-center rounded-[3px] border border-white/20 bg-white/5 px-8 font-ui font-medium backdrop-blur-sm hover:border-white/40">
              Conference details
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
