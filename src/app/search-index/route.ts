import { NextResponse } from "next/server";
import { getConferenceBundle, getFaqs, getResources } from "@/lib/data/content";
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
  { id: "p-contact", kind: "Page", title: "Contact", href: "/contact", keywords: "email enquiry help" },
  { id: "p-map", kind: "Page", title: "Campus map", href: "/map", keywords: "map directions building room find where lms inb" },
  { id: "p-register", kind: "Page", title: "Register", href: "/signup", keywords: "register sign up ticket account join" },
  { id: "p-portal", kind: "Page", title: "My Hub", href: "/portal", keywords: "account login log in sign in network delegates delegate card ticket qr agenda slides poster upload" },
  { id: "p-privacy", kind: "Page", title: "Privacy notice", href: "/privacy", keywords: "gdpr data" },
  { id: "p-access", kind: "Page", title: "Accessibility statement", href: "/accessibility" },
];

export async function GET() {
  const [{ edition, sessions, speakers, workshops }, faqs, resources] = await Promise.all([
    getConferenceBundle(),
    getFaqs(),
    getResources(),
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
      href: r.url ?? "/programme",
      summary: r.summary,
      keywords: r.category,
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
      href: "/portal/submission",
      linkLabel: "Upload your poster",
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
