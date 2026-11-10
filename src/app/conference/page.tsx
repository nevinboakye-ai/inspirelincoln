import type { Metadata } from "next";
import Link from "next/link";
import { Accessibility, ArrowRight, Bus, CalendarDays, Car, Clock, ExternalLink, MapPin, Train, Users } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { Accordion } from "@/components/ui/accordion";
import { Notice } from "@/components/ui/notice";
import { PlaceholderTag } from "@/components/ui/badge";
import { IcsButton } from "@/components/conference/ics-button";
import { MobileInfoPanel } from "@/components/conference/info-panel";
import { WorkshopGrid } from "@/components/home/sections";
import { SpeakerCarousel } from "@/components/home/speaker-carousel";
import { THEME_TOPICS } from "@/content/theme-topics";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import { NeuralField } from "@/components/visual/neural-field";
import { getConferenceBundle, getFaqs } from "@/lib/data/content";
import { eventEnd, eventStart, formatEventDate } from "@/lib/time";
import { CONFERENCE_STATUS_LABEL, type Edition } from "@/lib/types";
import { SITE_URL } from "@/lib/site";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { edition } = await getConferenceBundle();
  return {
    title: `Conference ${edition.year}`,
    description: `${edition.name}: ${edition.theme}. ${formatEventDate(edition.date)} at ${edition.venueName}, ${edition.venueInstitution}.`,
    alternates: { canonical: "/conference" },
  };
}

function Registration({ edition }: { edition: Edition }) {
  const s = edition.status;
  const heading =
    s === "registration_open"
      ? "Registration is open"
      : s === "registration_soon"
        ? "Registration opening soon"
        : s === "registration_closed"
          ? "Registration has closed"
          : s === "underway"
            ? "The conference is underway"
            : s === "concluded"
              ? "INSPIRE " + edition.year + " has concluded"
              : "Registration information";
  return (
    <div className="relative overflow-hidden rounded-xl bg-navy p-8 text-paper sm:p-12">
      <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
      <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-cyan/20 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="eyebrow text-cyan">Registration</p>
          <h2 id="registration-title" className="mt-4 text-display-md font-semibold">
            {heading}
          </h2>
          {edition.registrationNote && <p className="mt-4 max-w-2xl text-lg text-paper/70">{edition.registrationNote}</p>}
          {s === "registration_open" && !edition.registrationUrl && <p className="mt-4 text-paper/70">The registration link will be published here shortly.</p>}
          {s === "concluded" && (
            <Link href="/gallery" className="mt-6 inline-flex items-center gap-2 font-semibold text-cyan">
              Explore INSPIRE {edition.year} highlights <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {s === "registration_open" && edition.registrationUrl && (
            <a href={edition.registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center gap-2 rounded-full bg-cyan px-7 font-display font-semibold text-midnight hover:bg-cyan-300">
              Register now <ExternalLink aria-hidden className="size-4" />
            </a>
          )}
          <Link href="/portal" className="inline-flex min-h-14 items-center gap-2 rounded-full border border-white/20 px-7 font-display font-medium hover:border-white/40">
            My Conference
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function ConferencePage() {
  const [{ edition, speakers, workshops }, faqs] = await Promise.all([getConferenceBundle(), getFaqs()]);
  const start = eventStart(edition);
  const dateLabel = formatEventDate(edition.date);
  const timeLabel = edition.startTime ? `${edition.startTime}${edition.endTime ? `–${edition.endTime}` : ""} (UK time)` : "Times to be confirmed";
  const venueLine = `${edition.venueName}, ${edition.venueInstitution}`;
  const statusLabel = edition.status ? CONFERENCE_STATUS_LABEL[edition.status] : null;

  const expect = [
    { title: "Keynote presentations", body: "Talks from healthcare and research professionals on digital health and the evidence behind it." },
    { title: "Student research", body: "Poster presentations of student research, with time to discuss methods and findings with presenters." },
    { title: "Six interactive workshops", body: "Clinician-led, small-group sessions on publishing, appraisal, portfolios, simulation and more." },
    { title: "Professional development", body: "Practical guidance on building an academic profile and taking the next step in research." },
    { title: "Networking", body: "Meet medical students, clinicians and researchers from across the participating schools." },
    { title: "Digital health, examined", body: "A day exploring innovation in healthcare and the evidence needed to put it into practice." },
  ];

  return (
    <>
      <EventJsonLd edition={edition} />
      <PageHero
        size="lg"
        eyebrow={`${edition.name} · ${dateLabel}`}
        title={
          <>
            {edition.theme.split(":")[0]}:{" "}
            <span className="bg-gradient-to-r from-cyan to-violet-300 bg-clip-text text-transparent">{edition.theme.split(":").slice(1).join(":").trim()}</span>
          </>
        }
        intro={edition.themeStatement}
        visual={<NeuralField density={0.6} className="opacity-70 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />}
      >
        <dl className="mt-12 grid max-w-4xl gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-3">
          {[
            { icon: CalendarDays, label: "Date", value: dateLabel },
            { icon: Clock, label: "Time", value: timeLabel },
            { icon: MapPin, label: "Venue", value: venueLine },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-midnight/80 p-5">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-paper/50">
                <Icon aria-hidden className="size-3.5 text-cyan" /> {label}
              </dt>
              <dd className="mt-2 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap items-start gap-3">
          <Link href="#registration" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-cyan px-6 font-display font-semibold text-midnight hover:bg-cyan-300">
            {statusLabel ?? "Registration"} <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="/programme" className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-6 font-display font-medium hover:border-white/40">
            Programme
          </Link>
          <IcsButton
            dark
            startIso={edition.startTime ? start.at.toISOString() : null}
            endIso={edition.endTime ? eventEnd(edition).toISOString() : null}
            title={`${edition.name}: ${edition.theme}`}
            location={`${venueLine}, ${edition.venueAddress}`}
            url={`${SITE_URL}/conference`}
            uid={`edition-${edition.year}@inspirelincoln.uk`}
          />
        </div>
      </PageHero>

      {/* Theme overview */}
      <section aria-labelledby="overview-title" className="bg-paper py-24">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <SectionHeading eyebrow="Theme overview" title={<span id="overview-title">Why digital health, and why evidence?</span>} />
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-7">
            <p className="text-lg leading-relaxed text-slate-700">
              Technology is reshaping how care is delivered, from AI-assisted diagnosis to remote monitoring and surgical
              simulation. Innovation alone is not enough: every new tool has to show that it is safe, effective and fair before it
              earns a place in clinical practice. INSPIRE {edition.year} asks how emerging technologies are transforming
              healthcare, and what evidence is needed to turn them into meaningful clinical impact.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {THEME_TOPICS.map((t) => (
                <li key={t.title} className="flex items-start gap-3 rounded-md border border-navy/10 bg-white p-4">
                  <t.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-electric-600" />
                  <span className="text-[0.95rem] font-medium text-ink">{t.title}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* What to expect + audience */}
      <section aria-labelledby="expect-title" className="surface-dark relative overflow-hidden py-24">
        <div aria-hidden className="grid-lines absolute inset-0 opacity-50" />
        <div className="container-page relative">
          <SectionHeading dark eyebrow="What to expect" title={<span id="expect-title">One day. Many ways in.</span>} />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {expect.map((e, i) => (
              <li key={e.title} className="bg-navy p-7">
                <span className="font-display text-sm text-cyan">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-6 font-display text-xl font-medium">{e.title}</h3>
                <p className="mt-2 text-paper/65">{e.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-16 grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow flex items-center gap-3 text-cyan">
                <Users aria-hidden className="size-4" /> Who should attend
              </p>
            </div>
            <ul className="flex flex-wrap gap-3 lg:col-span-8">
              {["Medical students", "Aspiring clinician-researchers", "Early-career researchers", "Academic clinicians", "Healthcare innovators"].map((a) => (
                <li key={a} className="rounded-full border border-white/15 px-5 py-3 font-display text-lg">
                  {a}
                </li>
              ))}
              <li className="w-full pt-2 text-paper/60">No research experience is needed. If you are curious, you are welcome.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Research opportunities */}
      <section aria-labelledby="research-opps-title" className="bg-white py-24">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHeading
              eyebrow="Research opportunities"
              title={<span id="research-opps-title">Present your work</span>}
              intro="Student research poster presentations are at the heart of INSPIRE. Accepted presenters share their work with delegates and discuss it with clinicians and researchers."
            />
            <Link href="/research" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-6 font-display font-medium text-paper hover:bg-navy-700">
              Research &amp; Abstracts hub <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Reveal>
          <Reveal delay={0.1}>
            <ul className="space-y-3">
              {edition.posterRequirements.map((r, i) => (
                <li key={r} className="flex gap-4 rounded-lg border border-navy/10 bg-paper p-5">
                  <span className="font-display text-2xl font-semibold text-electric-600">{i + 1}</span>
                  <span className="pt-1 text-slate-700">{r}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Workshops */}
      <section aria-labelledby="ws-title" className="bg-paper py-24">
        <div className="container-page">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Workshop highlights" title={<span id="ws-title">Six clinician-led workshops</span>} />
            <Link href="/workshops" className="inline-flex items-center gap-2 font-display font-medium text-electric-600">
              All workshops <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <WorkshopGrid workshops={workshops} compact />
        </div>
      </section>

      {/* Speakers */}
      <section aria-labelledby="sp-title" className="surface-dark py-24">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading dark eyebrow="Speaker previews" title={<span id="sp-title">Who you will hear from</span>} />
            <Link href="/speakers" className="inline-flex items-center gap-2 font-display font-medium text-cyan">
              All speakers <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <SpeakerCarousel speakers={speakers} />
        </div>
      </section>

      {/* Venue, travel, accessibility */}
      <section id="venue" aria-labelledby="venue-title" className="scroll-mt-24 bg-white py-24">
        <div className="container-page">
          <SectionHeading eyebrow="Venue & travel" title={<span id="venue-title">Getting to {edition.venueName}</span>} />
          <div className="mt-12 grid gap-6 lg:grid-cols-12">
            <div className="relative overflow-hidden rounded-xl bg-navy p-8 text-paper lg:col-span-5">
              <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
              <div className="relative">
                <MapPin aria-hidden className="size-6 text-cyan" />
                <p className="mt-6 font-display text-2xl font-semibold">{edition.venueName}</p>
                <p className="mt-1 text-paper/70">{edition.venueInstitution}</p>
                <p className="mt-4 text-paper/80">{edition.venueAddress}</p>
                {edition.venueNotes && <p className="mt-4 text-paper/70">{edition.venueNotes}</p>}
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(edition.venueAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold hover:border-white/40"
                >
                  Open in maps <ExternalLink aria-hidden className="size-4" />
                </a>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
              <TravelCard icon={Train} title="By train">
                Lincoln Central station is in the city centre, a short walk from the University of Lincoln&apos;s Brayford Pool
                campus. Check routes with National Rail.
              </TravelCard>
              <TravelCard icon={Bus} title="By bus and coach">
                Lincoln&apos;s central bus station is next to the railway station, within walking distance of the campus.
              </TravelCard>
              <TravelCard icon={Car} title="By car">
                Parking near the campus is limited and may be chargeable. Detailed parking guidance will be shared by the conference
                team.
              </TravelCard>
              <TravelCard icon={MapPin} title="On the day">
                Signage and volunteers will guide you from the campus entrance to registration. Room details will appear on the
                programme once confirmed.
              </TravelCard>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate">Travel guidance is general. Please check live travel information before you set out.</p>
        </div>
      </section>

      <section id="accessibility" aria-labelledby="access-title" className="bg-paper py-24">
        <div className="container-page grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading eyebrow="Accessibility" title={<span id="access-title">Everyone should be able to take part</span>} />
          </div>
          <div className="lg:col-span-7">
            <div className="flex gap-4 rounded-lg border border-navy/10 bg-white p-6">
              <Accessibility aria-hidden className="size-6 shrink-0 text-electric-600" />
              <div className="space-y-4 text-slate-700">
                <p>
                  If you have an access requirement, such as step-free access, seating, dietary needs, hearing support or a quiet
                  space, please tell us as early as possible so we can make arrangements with the venue.
                </p>
                <p>Specific venue access details will be published here once confirmed with the university.</p>
                <Link href="/contact?category=accessibility" className="inline-flex items-center gap-2 font-semibold text-electric-600">
                  Make an accessibility enquiry <ArrowRight aria-hidden className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faqs" aria-labelledby="faq-title" className="bg-white py-24">
        <div className="container-page grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading eyebrow="FAQs" title={<span id="faq-title">Questions, answered</span>} />
            <p className="mt-6 text-slate-700">
              Can&apos;t find what you need?{" "}
              <Link href="/contact" className="font-medium text-electric-600 underline underline-offset-4">
                Contact the team
              </Link>
              .
            </p>
          </div>
          <div className="lg:col-span-8">
            {faqs.length ? <Accordion items={faqs.map((f) => ({ id: f.id, title: f.question, body: f.answer }))} /> : <p className="text-slate-700">FAQs will be published soon.</p>}
          </div>
        </div>
      </section>

      <section id="registration" aria-labelledby="registration-title" className="scroll-mt-24 bg-paper pb-32 pt-8">
        <div className="container-page">
          <Registration edition={edition} />
          {!edition.status && (
            <div className="mt-4">
              <PlaceholderTag>Status not yet set by the conference team</PlaceholderTag>
            </div>
          )}
          <Notice className="mt-6">Registration is confirmed only by the conference team or the official registration platform. This website never assumes a booking is complete.</Notice>
        </div>
      </section>

      <MobileInfoPanel dateLabel={dateLabel} timeLabel={timeLabel} venue={venueLine} statusLabel={statusLabel} />
    </>
  );
}

function TravelCard({ icon: Icon, title, children }: { icon: typeof Train; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-navy/10 bg-paper p-6">
      <Icon aria-hidden className="size-5 text-electric-600" />
      <h3 className="mt-4 font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-700">{children}</p>
    </div>
  );
}
