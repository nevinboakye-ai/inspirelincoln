import type { Metadata } from "next";
import Link from "next/link";
import { Accessibility, ArrowRight, Bus, CalendarDays, Car, Clock, ExternalLink, MapPin, Train } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { Accordion } from "@/components/ui/accordion";
import { IcsButton } from "@/components/conference/ics-button";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import { getConferenceBundle, getFaqs } from "@/lib/data/content";
import { eventEnd, eventStart, formatEventDate } from "@/lib/time";
import type { Edition } from "@/lib/types";
import { SITE_URL } from "@/lib/site";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { edition } = await getConferenceBundle();
  return {
    title: "Venue, travel and FAQs",
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
          <h2 id="registration-title" className="mt-4 text-display-md font-normal">
            {heading}
          </h2>
          {edition.registrationNote && <p className="mt-4 max-w-2xl text-lg text-paper/70">{edition.registrationNote}</p>}
          {!edition.registrationNote && s !== "concluded" && (
            <p className="mt-4 max-w-2xl text-lg text-paper/70">Selected delegates can log in with the email they applied with. Not on the list? Register and the committee will review your account.</p>
          )}
          {s === "concluded" && (
            <p className="mt-6 text-paper/75">Thank you to everyone who took part.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {s !== "registration_closed" && s !== "concluded" && (
            <Link href="/signup" className="inline-flex min-h-14 items-center gap-2 rounded-[3px] border border-white/20 px-7 font-ui font-medium hover:border-white/40">
              Register
            </Link>
          )}
          <Link href="/login" className="order-first inline-flex min-h-14 items-center gap-2 rounded-[3px] bg-gold px-7 font-ui font-semibold text-midnight hover:bg-gold-300">
            Log in <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function ConferencePage() {
  const [{ edition }, faqs] = await Promise.all([getConferenceBundle(), getFaqs()]);
  const start = eventStart(edition);
  const dateLabel = formatEventDate(edition.date);
  const timeLabel = edition.startTime ? `${edition.startTime}${edition.endTime ? ` to ${edition.endTime}` : ""} (UK time)` : "Times to be confirmed";
  const venueLine = `${edition.venueName}, ${edition.venueInstitution}`;


  return (
    <>
      <EventJsonLd edition={edition} />
      <PageHero
        eyebrow={`${edition.name} · ${dateLabel}`}
        title={
          <>
            Venue, travel <span className="italic text-gold-300">and FAQs</span>
          </>
        }
        intro="Everything you need to get to the Brayford Pool campus and make the most of the day."
      >
        <dl className="mt-12 grid max-w-4xl gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-3">
          {[
            { icon: CalendarDays, label: "Date", value: dateLabel },
            { icon: Clock, label: "Time", value: timeLabel },
            { icon: MapPin, label: "Venue", value: venueLine },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-midnight/80 p-5">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-paper/65">
                <Icon aria-hidden className="size-3.5 text-cyan" /> {label}
              </dt>
              <dd className="mt-2 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap items-start gap-3">
          <Link href="/map" className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-cyan px-6 font-ui font-semibold text-midnight hover:bg-cyan-300">
            Campus map <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="#faqs" className="inline-flex min-h-12 items-center rounded-[3px] border border-white/20 px-6 font-ui font-medium hover:border-white/40">
            FAQs
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
                <div className="mt-8 flex flex-wrap gap-2">
                  <Link href="/map" className="inline-flex min-h-11 items-center gap-2 rounded-[3px] bg-paper px-5 text-sm font-semibold text-navy hover:bg-white">
                    Campus map <ArrowRight aria-hidden className="size-4" />
                  </Link>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${encodeURIComponent(`${edition.venueName}, ${edition.venueAddress}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-white/20 px-5 text-sm font-semibold hover:border-white/40"
                  >
                    Directions <ExternalLink aria-hidden className="size-4" />
                    <span className="sr-only">(opens Google Maps)</span>
                  </a>
                </div>
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
                Registration and the main lecture theatre are in the Isaac Newton Building. One group of oral presentations is in
                LMS005, in the Ross Lucas Medical Sciences Building. The campus map shows both, with rooms added as they are
                confirmed.
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
        </div>
      </section>

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
