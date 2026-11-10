import { NextResponse } from "next/server";
import { getConferenceBundle, getFaqs, getOpportunities, getResources } from "@/lib/data/content";
import { formatEventDate } from "@/lib/time";
import type { SearchIndex, SearchItem } from "@/lib/search/types";

export const revalidate = 300;

const PAGES: SearchItem[] = [
  { id: "p-home", kind: "Page", title: "Home", href: "/" },
  { id: "p-about", kind: "Page", title: "About INSPIRE", href: "/about", keywords: "mission vision values committee leadership history story" },
  { id: "p-conf", kind: "Page", title: "Conference 2026", href: "/conference", keywords: "venue travel accessibility faq registration date theme" },
  { id: "p-prog", kind: "Page", title: "Programme", href: "/programme", keywords: "schedule timetable agenda sessions times" },
  { id: "p-today", kind: "Page", title: "Conference day", href: "/today", keywords: "event day live now next today" },
  { id: "p-speakers", kind: "Page", title: "Speakers", href: "/speakers", keywords: "keynote faculty" },
  { id: "p-workshops", kind: "Page", title: "Workshops", href: "/workshops" },
  { id: "p-research", kind: "Page", title: "Research & Abstracts", href: "/research", keywords: "abstract poster submission presenter guidance" },
  { id: "p-showcase", kind: "Page", title: "Research showcase", href: "/research/showcase" },
  { id: "p-opps", kind: "Page", title: "Opportunities", href: "/opportunities", keywords: "mentorship research projects" },
  { id: "p-gallery", kind: "Page", title: "Gallery & archive", href: "/gallery", keywords: "photos past conferences" },
  { id: "p-contact", kind: "Page", title: "Contact", href: "/contact", keywords: "email enquiry help" },
  { id: "p-portal", kind: "Page", title: "My Conference", href: "/portal", keywords: "account login sign in dashboard agenda" },
  { id: "p-privacy", kind: "Page", title: "Privacy policy", href: "/privacy", keywords: "gdpr data" },
  { id: "p-access", kind: "Page", title: "Accessibility statement", href: "/accessibility" },
];

export async function GET() {
  const [{ edition, sessions, speakers, workshops }, faqs, resources, opportunities] = await Promise.all([
    getConferenceBundle(),
    getFaqs(),
    getResources(),
    getOpportunities(),
  ]);

  const items: SearchItem[] = [
    ...PAGES,
    ...sessions.map((s) => ({
      id: `s-${s.id}`,
      kind: "Session" as const,
      title: s.title,
      href: `/programme?session=${s.slug}`,
      summary: s.description,
      keywords: s.category,
    })),
    ...speakers.map((s) => ({
      id: `sp-${s.id}`,
      kind: "Speaker" as const,
      title: s.fullName,
      href: `/speakers/${s.slug}`,
      summary: [s.position, s.institution].filter(Boolean).join(", "),
      keywords: `${s.specialty ?? ""} ${s.researchInterests.join(" ")}`,
    })),
    ...workshops.map((w) => ({
      id: `w-${w.id}`,
      kind: "Workshop" as const,
      title: `Workshop ${w.number}: ${w.title}`,
      href: `/workshops/${w.slug}`,
      summary: w.summary,
      keywords: w.topics.join(" "),
    })),
    ...resources.map((r) => ({
      id: `r-${r.id}`,
      kind: "Resource" as const,
      title: r.title,
      href: r.url ?? "/research#resources",
      summary: r.summary,
      keywords: r.category,
    })),
    ...opportunities.map((o) => ({
      id: `o-${o.id}`,
      kind: "Opportunity" as const,
      title: o.title,
      href: `/opportunities/${o.slug}`,
      summary: o.summary,
      keywords: o.category,
    })),
    ...faqs.map((f) => ({
      id: `f-${f.id}`,
      kind: "FAQ" as const,
      title: f.question,
      href: "/conference#faqs",
      summary: f.answer,
    })),
  ];

  const answers: SearchIndex["answers"] = [
    {
      id: "when",
      question: "When is the conference?",
      answer: `${formatEventDate(edition.date)}${edition.startTime ? `, from ${edition.startTime}${edition.endTime ? ` to ${edition.endTime}` : ""}` : ". Session times will be published once confirmed"}.`,
      href: "/programme",
      linkLabel: "See the programme",
    },
    {
      id: "where",
      question: "Where is it held?",
      answer: `${edition.venueName}, ${edition.venueInstitution}. ${edition.venueAddress}.`,
      href: "/conference#venue",
      linkLabel: "Venue and travel",
    },
    {
      id: "posters",
      question: "What do poster presenters need to do?",
      answer: edition.posterRequirements.join(" "),
      href: "/research#presenters",
      linkLabel: "Presenter guidance",
    },
    {
      id: "workshops",
      question: "Which workshops are running?",
      answer: workshops.map((w) => w.title).join(", ") + ".",
      href: "/workshops",
      linkLabel: "Explore workshops",
    },
    {
      id: "access",
      question: "I have an access requirement",
      answer: "Contact the team through the accessibility enquiry option so arrangements can be made before the day.",
      href: "/contact?category=accessibility",
      linkLabel: "Accessibility enquiry",
    },
  ];

  return NextResponse.json({ items, answers } satisfies SearchIndex);
}
