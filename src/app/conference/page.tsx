import type { Metadata } from "next";
import Link from "next/link";
import { Accessibility, ArrowRight, Bus, CalendarDays, Car, ClipboardCheck, Clock, Coffee, ExternalLink, MapPin, Moon, Signpost, Train } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { Accordion } from "@/components/ui/accordion";
import { IcsButton } from "@/components/conference/ics-button";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import { getConferenceBundle, getFaqs } from "@/lib/data/content";
import { eventEnd, eventStart, formatEventDate } from "@/lib/time";
import type { Edition } from "@/lib/types";
import { SITE_URL } from "@/lib/site";
import { AuthLink } from "@/components/auth/auth-link";

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
          <AuthLink className="order-first inline-flex min-h-14 items-center gap-2 rounded-[3px] bg-gold px-7 font-ui font-semibold text-midnight hover:bg-gold-300" />
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
                Parking on campus is limited and many car parks are for permit holders only. The{" "}
                <Link href="/map" className="font-medium text-electric-600 underline underline-offset-4">
                  campus map
                </Link>{" "}
                highlights the campus car parks and shows public ones nearby, such as the Lucy Tower Street multi-storey.
              </TravelCard>
              <TravelCard icon={MapPin} title="On the day">
                Registration, food and the INB0114 Lecture Theatre are in the Isaac Newton Building (INB). Oral presentations and
                workshops also run in the Ross Lucas Medical Sciences Building (LMS) next door, and A1 signs outside point the way.
              </TravelCard>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate">Travel guidance is general. Please check live travel information before you set out.</p>
        </div>
      </section>

      <OnTheDay />

      <section id="accessibility" aria-labelledby="access-title" className="bg-white py-24">
        <div className="container-page grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading eyebrow="Accessibility" title={<span id="access-title">Everyone should be able to take part</span>} />
          </div>
          <div className="lg:col-span-7">
            <div className="flex gap-4 rounded-lg border border-navy/10 bg-paper p-6">
              <Accessibility aria-hidden className="size-6 shrink-0 text-electric-600" />
              <div className="space-y-4 text-slate-700">
                <p>
                  If you have an access requirement, such as step-free access, seating, dietary needs, hearing support or a quiet
                  space, please tell us as early as possible so we can make arrangements with the venue.
                </p>
                <p>Specific venue access details will be published here once confirmed with the university.</p>
                <Link href="/portal/enquiries?topic=access" className="inline-flex items-center gap-2 font-semibold text-electric-600">
                  Tell the committee about your access needs <ArrowRight aria-hidden className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faqs" aria-labelledby="faq-title" className="bg-paper py-24">
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

/** Catering, from the University's hospitality brief. Everything is served in INB, in front of the café. */
const CATERING = [
  { time: "8:00 to 9:00", title: "Breakfast", menu: "Tea, coffee, water and breakfast pastries" },
  { time: "9:45 to 10:00", title: "Mid-morning break", menu: "Tea, coffee and water" },
  { time: "11:30 to 12:45", title: "Lunch", menu: "A sandwich or wrap, crisps and fruit, with tea, coffee and juices" },
  { time: "14:15 to 14:40", title: "Afternoon refreshments", menu: "Tea, coffee, water, biscuits and a selection of bite-sized cakes" },
];

const BOOKED_ROOMS = {
  "Isaac Newton Building (INB)": ["INB0113 Atrium", "INB0114 Lecture Theatre"],
  "Ross Lucas Medical Sciences Building (LMS)": ["LMS0005", "LMS0008", "LMS0011", "LMS2002", "LMS2003", "LMS2004", "LMS2005", "LMS2006", "LMS2007", "LMS2008", "LMS2009", "LMS2011"],
};

function OnTheDay() {
  return (
    <section id="on-the-day" aria-labelledby="day-title" className="scroll-mt-24 bg-paper py-24">
      <div className="container-page">
        <SectionHeading eyebrow="On the day" title={<span id="day-title">Food, registration and finding your way</span>} />
        <div className="mt-12 grid gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-navy/10 bg-white p-6 sm:p-8 lg:col-span-7">
            <div className="flex items-center gap-3">
              <Coffee aria-hidden className="size-5 text-electric-600" />
              <h3 className="font-display text-xl font-semibold text-ink">Food and drink</h3>
            </div>
            <p className="mt-2 text-[0.95rem] text-slate-700">
              Everything is served in the Isaac Newton Building (INB), in front of the café. Let us know about any dietary needs when you register.
            </p>
            <ol className="mt-6 divide-y divide-navy/10 border-y border-navy/10">
              {CATERING.map((c) => (
                <li key={c.time} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <span className="font-ui text-sm font-semibold tabular-nums text-electric-600">{c.time}</span>
                  <span>
                    <span className="block font-semibold text-ink">{c.title}</span>
                    <span className="mt-0.5 block text-sm text-slate-700">{c.menu}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid gap-4 lg:col-span-5">
            <DayCard icon={ClipboardCheck} title="Registration">
              The registration desk is in the Isaac Newton Building. Collect your badge there when you arrive, from 8:00.
            </DayCard>
            <DayCard icon={Signpost} title="Finding your way">
              Sessions run in INB and the Ross Lucas Medical Sciences Building (LMS) next door. A1 signs outside point the way between the two,
              and every room is on the{" "}
              <Link href="/map" className="font-medium text-electric-600 underline underline-offset-4">
                campus map
              </Link>
              .
            </DayCard>
            <DayCard icon={Moon} title="Prayer room">
              A quiet room in LMS is set aside for prayer and reflection, with signs on the day. Ask at the registration desk if you can&apos;t
              find it.
            </DayCard>
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-navy/10 bg-white p-6 sm:p-8">
          <h3 className="font-display text-lg font-semibold text-ink">Rooms we&apos;re using</h3>
          <div className="mt-4 grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
            {Object.entries(BOOKED_ROOMS).map(([building, rooms]) => (
              <div key={building} className="min-w-0">
                <p className="text-sm font-semibold text-slate-700">{building}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {rooms.map((r) => (
                    <li key={r}>
                      <Link
                        href={`/map?place=${r.split(" ")[0] === "INB0114" ? "main-theatre" : r.split(" ")[0].toLowerCase()}`}
                        className="inline-flex min-h-9 items-center rounded-full border border-navy/15 px-3 font-ui text-xs font-medium text-navy hover:border-navy/40 hover:bg-paper"
                      >
                        {r}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DayCard({ icon: Icon, title, children }: { icon: typeof Train; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 rounded-lg border border-navy/10 bg-white p-6">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-electric-600" />
      <div>
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-700">{children}</p>
      </div>
    </div>
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
