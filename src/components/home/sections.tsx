import Image from "next/image";
import Link from "next/link";
import { SpeakersSoon } from "@/components/speakers/speakers-soon";
import { ArrowRight, ArrowUpRight, CalendarDays, Coffee, FlaskConical, HelpCircle, MapPin, Mic2, PartyPopper, Presentation, LayoutDashboard, Users } from "lucide-react";
import type { Edition, Session, Speaker, Workshop } from "@/lib/types";
import { SESSION_CATEGORY_LABEL } from "@/lib/types";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { LineDraw, MaskRise, ScrollLine, SpotlightGroup } from "@/components/motion/effects";
import { WorkshopMotif, ACCENT_HEX } from "@/components/visual/workshop-motif";
import { PlaceholderTag } from "@/components/ui/badge";
import { formatTime } from "@/lib/time";
import { SpeakerCarousel } from "./speaker-carousel";

/* ---------------- D: At a glance ---------------- */
/** Four doors into the site, sized for thumbs. */
export function AtAGlance({ edition }: { edition: Edition; workshopCount?: number }) {
  const items = [
    { href: "/programme", icon: CalendarDays, title: "Programme", body: "Every session, with times and rooms" },
    { href: "/map", icon: MapPin, title: "Campus map", body: "Find your building and room" },
    { href: "/portal", icon: LayoutDashboard, title: "My Hub", body: "Your presentation, agenda and profile" },
    { href: "/conference", icon: HelpCircle, title: "Venue & FAQs", body: "Travel, access and questions" },
  ];
  return (
    <section aria-labelledby="glance-title" className="bg-paper py-8 sm:py-24">
      <div className="container-page">
        <h2 id="glance-title" className="eyebrow flex items-center gap-3 text-electric-600">
          <LineDraw className="w-8 bg-electric-600/50" /> INSPIRE {edition.year}, sorted
        </h2>
        <SpotlightGroup>
        <Stagger className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-3 lg:grid-cols-4">
          {items.map((it) => (
            <StaggerItem key={it.href} className="h-full">
              <Link href={it.href} className="spotlight group flex h-full flex-col items-start gap-3 rounded-[3px] border border-navy/10 bg-white p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5 transition-[transform,border-color,box-shadow] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-navy/30 hover:shadow-[0_24px_48px_-28px_rgba(26,49,84,0.45)] lg:flex-col lg:items-start lg:p-7">
                <span className="grid size-11 shrink-0 place-items-center rounded-[3px] bg-navy text-cyan transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:-rotate-6 group-hover:scale-110"><it.icon aria-hidden className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg text-ink sm:text-xl">{it.title}</span>
                  <span className="mt-0.5 hidden text-sm text-slate-700 sm:block">{it.body}</span>
                </span>
                <ArrowRight aria-hidden className="hidden size-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5 sm:block lg:hidden" />
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
        </SpotlightGroup>
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
    <section aria-labelledby="programme-title" className="relative overflow-hidden bg-paper-200 py-12 sm:py-24 lg:py-32">
      <div className="container-page grid gap-6 sm:gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <p className="eyebrow mb-4 flex items-center gap-3 text-electric-600">
            <LineDraw className="w-8 bg-electric-600/50" /> Programme
          </p>
          <h2 id="programme-title" className="text-display-md font-normal text-ink">
            <MaskRise>The shape of the day</MaskRise>
          </h2>
          <p className="mt-3 leading-relaxed text-slate-700 sm:mt-6 sm:text-lg">
            Keynotes, student research, clinician-led workshops and time to connect. Build your own agenda and export it to your
            calendar once times are confirmed.
          </p>
          {provisional && (
            <div className="mt-6">
              <PlaceholderTag>Provisional: times to be confirmed</PlaceholderTag>
            </div>
          )}
          <Link href="/programme" className="group mt-5 inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-navy px-6 sm:mt-8 font-ui font-medium text-paper hover:bg-navy-700">
            Open the full programme <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <ol className="relative lg:col-span-8">
          <ScrollLine className="bottom-6 left-[1.4rem] top-6 sm:left-[1.65rem]" />
          {preview.map((s, i) => {
            const Icon = CATEGORY_ICON[s.category];
            return (
              <li key={s.id} className={i >= 4 ? "hidden sm:block" : undefined}>
                <Reveal delay={i * 0.06}>
                  <Link
                    href={`/programme?session=${s.slug}`}
                    className="group relative flex items-start gap-5 rounded-lg p-3 transition-[background-color,transform] duration-500 ease-[var(--ease-out-expo)] hover:translate-x-1 hover:bg-white sm:p-4"
                  >
                    <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-navy/10 bg-white text-electric-600 shadow-sm transition-colors group-hover:scale-110 group-hover:bg-navy group-hover:text-cyan">
                      <Icon aria-hidden className="size-[1.1rem]" />
                    </span>
                    <span className="min-w-0 flex-1 border-b border-navy/10 pb-3 sm:pb-5">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate">
                        {SESSION_CATEGORY_LABEL[s.category]}
                        <span className="font-normal normal-case tracking-normal">
                          {s.startsAt ? formatTime(s.startsAt) : "Time TBC"}
                        </span>
                      </span>
                      <span className="mt-1 block font-display text-lg font-medium text-ink sm:mt-1.5 sm:text-xl">{s.title}</span>
                      <span className="mt-1 line-clamp-2 hidden text-sm text-slate-700 sm:block">{s.description}</span>
                    </span>
                    <ArrowUpRight aria-hidden className="mt-3 size-5 shrink-0 -translate-x-1 translate-y-1 text-slate opacity-0 transition-[opacity,translate] duration-300 group-hover:translate-0 group-hover:opacity-100" />
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
    <section aria-labelledby="speakers-title" className="surface-dark relative overflow-hidden py-12 sm:py-24 lg:py-32">
      <div aria-hidden className="animate-drift absolute right-0 top-0 size-[30rem] rounded-full bg-violet/15 blur-[140px]" />
      <div className="container-page relative">
        <div className="flex flex-col justify-between gap-3 sm:gap-6 md:flex-row md:items-end">
          <Reveal>
            <p className="eyebrow mb-4 flex items-center gap-3 text-cyan">
              <LineDraw className="w-8 bg-cyan/60" /> Speakers
            </p>
            <h2 id="speakers-title" className="text-display-md font-normal">
              <MaskRise>Voices from research and practice</MaskRise>
            </h2>
          </Reveal>
          {speakers.length > 0 && (
            <Link href="/speakers" className="group inline-flex items-center gap-2 font-ui font-medium text-cyan">
              All speakers <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          )}
        </div>
        {speakers.length ? <SpeakerCarousel speakers={speakers} /> : <SpeakersSoon dark className="mt-6 sm:mt-12" />}
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

export function FinalCta({ edition }: { edition: Edition }) {
  return (
    <section aria-labelledby="cta-title" className="surface-midnight noise relative isolate overflow-hidden py-14 sm:py-32 lg:py-40">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_100%,rgba(58,95,148,0.35),transparent_70%)]" />
        <Image src="/brand/crest-white.png" alt="" width={338} height={397} className="animate-breathe absolute left-1/2 top-1/2 h-[120%] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.04]" />
      </div>
      <div className="container-page relative text-center">
        <Reveal>
          <p className="eyebrow text-cyan">INSPIRE {edition.year} · {edition.venueName}</p>
          <h2 id="cta-title" className="mx-auto mt-6 max-w-5xl text-display-xl font-normal">
            <MaskRise>Be part of</MaskRise>
            <MaskRise delay={0.12}><span className="italic font-light text-gold-300">what comes next.</span></MaskRise>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-paper/70 sm:mt-8 sm:text-lg">
            Whether you are presenting your first poster or simply curious about research, there is a place for you at INSPIRE.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 sm:mt-10">
            <Link href="/login" className="shine group inline-flex min-h-14 items-center gap-2 rounded-[3px] bg-gold px-8 font-ui font-semibold text-midnight transition-[background-color,box-shadow] hover:bg-gold-300 hover:shadow-[0_12px_40px_-10px_rgba(212,175,90,0.6)]">
              Log in <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/conference" className="inline-flex min-h-14 items-center rounded-[3px] border border-white/20 bg-white/5 px-8 font-ui font-medium backdrop-blur-sm hover:border-white/40">
              Venue & FAQs
            </Link>
          </div>
          <p className="mt-4 text-sm text-paper/65">
            Not on the delegate list?{" "}
            <Link href="/signup" className="font-semibold text-paper underline decoration-white/40 underline-offset-4 hover:decoration-white">Register</Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
