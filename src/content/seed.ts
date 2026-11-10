/**
 * Fallback content used when Supabase is not configured, and the source of
 * supabase/seed.sql. Everything here is either taken from the organisers' brief
 * or explicitly marked as provisional / example content. Nothing in this file
 * should present an unconfirmed detail as fact.
 */
import type {
  Announcement,
  CommitteeMember,
  Edition,
  Faq,
  GalleryAsset,
  Opportunity,
  Partner,
  Resource,
  Room,
  Session,
  ShowcaseItem,
  Speaker,
  TimelineEvent,
  Workshop,
} from "@/lib/types";

export const seedEdition: Edition = {
  id: "edition-2026",
  year: 2026,
  slug: "2026",
  name: "INSPIRE 2026",
  theme: "Digital Health: From Innovation to Evidence",
  themeStatement:
    "Exploring how emerging technologies are transforming healthcare, and the evidence needed to translate innovation into meaningful clinical impact.",
  date: "2026-11-21",
  startTime: null,
  endTime: null,
  timezone: "Europe/London",
  venueName: "Lincoln Medical School",
  venueInstitution: "University of Lincoln",
  venueAddress: "University of Lincoln, Brayford Pool, Lincoln LN6 7TS",
  venueNotes: null,
  expectedAttendance: 250,
  status: null,
  registrationUrl: null,
  registrationNote:
    "Registration details are published by the conference team. If you have already registered, bring your confirmation with you on the day.",
  eventDayMode: false,
  postEventMode: false,
  isCurrent: true,
  highlights: null,
  hostInstitution: "Lincoln Medical School, University of Lincoln",
  posterDeadline: "2026-11-13",
  posterRequirements: [
    "Accepted poster presenters should submit their poster by Friday 13 November 2026.",
    "Posters may be landscape or portrait.",
    "Bring a printed copy of your poster to the conference.",
  ],
  abstractConfig: {
    submissionsOpen: false,
    opensAt: null,
    closesAt: null,
    sectionWordLimit: 150,
    totalWordLimit: 300,
    categories: [
      "Digital health and technology",
      "Clinical research",
      "Medical education",
      "Public health and inequalities",
      "Surgery and simulation",
      "Laboratory and translational science",
      "Quality improvement and audit",
    ],
    presentationTypes: ["Poster presentation", "Oral presentation"],
    allowFiles: true,
    maxFileMb: 10,
    eligibility: [
      "The presenting author is a medical student or early-career researcher.",
      "The work has not been misrepresented and all co-authors have agreed to submission.",
    ],
    formatting: [
      "Structure your abstract as Background, Aim, Methods, Results and Conclusion.",
      "Do not include identifiable patient information.",
      "Use standard abbreviations, written out in full at first use.",
    ],
  },
};

/** Rooms are placeholders until the venue confirms allocations. */
export const seedRooms: Room[] = [
  {
    id: "room-main",
    name: "Main lecture theatre (to be confirmed)",
    building: "Lincoln Medical School",
    floor: null,
    directions: "Signage and volunteers will direct you on arrival.",
    capacity: null,
  },
];

/**
 * Provisional programme. No times are given because the timetable has not been
 * confirmed. Order reflects the planned flow of the day only.
 */
export const seedSessions: Session[] = [
  {
    id: "s-registration",
    slug: "arrival-and-registration",
    title: "Arrival and registration",
    category: "networking",
    startsAt: null,
    endsAt: null,
    roomId: null,
    description:
      "Collect your delegate badge, find your way around the venue and meet fellow delegates before the opening session.",
    objectives: [],
    capacity: null,
    workshopId: null,
    speakerIds: [],
    isProvisional: true,
    sort: 10,
  },
  {
    id: "s-welcome",
    slug: "welcome-and-opening",
    title: "Welcome and opening address",
    category: "keynote",
    startsAt: null,
    endsAt: null,
    roomId: "room-main",
    description:
      "An introduction to INSPIRE 2026 and this year's theme, Digital Health: From Innovation to Evidence.",
    objectives: ["Understand the shape of the day", "Hear the framing for this year's theme"],
    capacity: null,
    workshopId: null,
    speakerIds: [],
    isProvisional: true,
    sort: 20,
  },
  {
    id: "s-keynote-1",
    slug: "keynote-presentation-1",
    title: "Keynote presentation",
    category: "keynote",
    startsAt: null,
    endsAt: null,
    roomId: "room-main",
    description:
      "A keynote from a healthcare or research professional exploring digital health and its evidence base. Speaker announcement coming soon.",
    objectives: [],
    capacity: null,
    workshopId: null,
    speakerIds: [],
    isProvisional: true,
    sort: 30,
  },
  {
    id: "s-workshops-1",
    slug: "workshop-session-1",
    title: "Interactive workshops: first rotation",
    category: "workshop",
    startsAt: null,
    endsAt: null,
    roomId: null,
    description:
      "Clinician-led, small-group workshops. Choose from the six workshop areas; allocations and rooms will be confirmed by the conference team.",
    objectives: ["Practise a skill in a small-group setting", "Discuss real cases with clinicians"],
    capacity: null,
    workshopId: null,
    speakerIds: [],
    isProvisional: true,
    sort: 40,
  },
  {
    id: "s-lunch",
    slug: "lunch-and-networking",
    title: "Lunch and networking",
    category: "break",
    startsAt: null,
    endsAt: null,
    roomId: null,
    description: "Time to eat, recharge and talk with delegates, presenters and clinicians.",
    objectives: [],
    capacity: null,
    workshopId: null,
    speakerIds: [],
    isProvisional: true,
    sort: 50,
  },
  {
    id: "s-posters",
    slug: "poster-presentations",
    title: "Student research poster presentations",
    category: "research",
    startsAt: null,
    endsAt: null,
    roomId: null,
    description:
      "Accepted presenters share their work with delegates and judges. Browse posters, ask questions and discuss methods and findings.",
    objectives: [
      "Engage with student research across disciplines",
      "Practise discussing research with presenters",
    ],
    capacity: null,
    workshopId: null,
    speakerIds: [],
    isProvisional: true,
    sort: 60,
  },
  {
    id: "s-keynote-2",
    slug: "keynote-presentation-2",
    title: "Keynote presentation",
    category: "keynote",
    startsAt: null,
    endsAt: null,
    roomId: "room-main",
    description: "A second keynote presentation. Speaker announcement coming soon.",
    objectives: [],
    capacity: null,
    workshopId: null,
    speakerIds: [],
    isProvisional: true,
    sort: 70,
  },
  {
    id: "s-workshops-2",
    slug: "workshop-session-2",
    title: "Interactive workshops: second rotation",
    category: "workshop",
    startsAt: null,
    endsAt: null,
    roomId: null,
    description:
      "A second opportunity to attend a clinician-led workshop. Allocations and rooms will be confirmed by the conference team.",
    objectives: [],
    capacity: null,
    workshopId: null,
    speakerIds: [],
    isProvisional: true,
    sort: 80,
  },
  {
    id: "s-closing",
    slug: "prizes-and-closing",
    title: "Prizes and closing remarks",
    category: "closing",
    startsAt: null,
    endsAt: null,
    roomId: "room-main",
    description: "Recognition of outstanding research and a close to the day.",
    objectives: [],
    capacity: null,
    workshopId: null,
    speakerIds: [],
    isProvisional: true,
    sort: 90,
  },
];

/** No speakers have been supplied yet. The UI shows labelled placeholders. */
export const seedSpeakers: Speaker[] = [];

export const seedWorkshops: Workshop[] = [
  {
    id: "w1",
    slug: "from-writing-to-publishing",
    number: 1,
    title: "From Writing to Publishing",
    strapline: "Turn research into a publication.",
    summary:
      "Explore the process of transforming research into academic publications.",
    description:
      "This workshop follows a piece of research from first draft to published paper. It looks at how manuscripts are structured, how to choose a journal that fits your work, what happens during peer review and how to respond to reviewers, and how to plan a realistic publication strategy as a student.",
    topics: ["Manuscript structure", "Journal selection", "Peer review", "Publication strategy"],
    outcomes: [
      "Describe the standard structure of a research manuscript",
      "Weigh up factors when choosing a target journal",
      "Understand how peer review works and how to respond to reviewer comments",
      "Plan next steps for publishing your own work",
    ],
    audience: "Students with a project in progress or completed, and anyone considering their first publication.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "electric",
    motif: "manuscript",
    notes: null,
  },
  {
    id: "w2",
    slug: "digital-health-in-clinical-practice",
    number: 2,
    title: "Digital Health in Clinical Practice",
    strapline: "Cases, data and decisions.",
    summary:
      "Interactive clinical cases exploring the application of digital tools, data and evidence-based decision-making.",
    description:
      "Working through interactive clinical cases, participants will consider where digital tools and data can support clinical decisions, what evidence should be expected before a tool is adopted, and where the limits and risks lie.",
    topics: ["Clinical cases", "Digital tools", "Data in decision-making", "Evaluating evidence"],
    outcomes: [
      "Discuss how digital tools can inform clinical decisions",
      "Identify the evidence needed before adopting a digital intervention",
      "Recognise risks, limitations and unintended consequences",
    ],
    audience: "All delegates. No prior technical knowledge is needed.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "cyan",
    motif: "pulse",
    notes: null,
  },
  {
    id: "w3",
    slug: "evidence-based-medicine-in-practice",
    number: 3,
    title: "Evidence-Based Medicine in Practice",
    strapline: "Read critically. Decide well.",
    summary:
      "Develop critical appraisal skills and understand how evidence informs clinical decisions.",
    description:
      "A practical introduction to critical appraisal. Participants will work through published research, assess its validity and relevance, and discuss how evidence is weighed alongside clinical judgement and patient preferences.",
    topics: ["Critical appraisal", "Study design", "Bias and validity", "Applying evidence"],
    outcomes: [
      "Apply a structured approach to appraising a research paper",
      "Recognise common sources of bias",
      "Explain how evidence informs, but does not replace, clinical judgement",
    ],
    audience: "Students at any stage who want to read research with more confidence.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "violet",
    motif: "evidence",
    notes: null,
  },
  {
    id: "w4",
    slug: "building-a-competitive-clinical-portfolio",
    number: 4,
    title: "Building a Competitive Clinical Portfolio",
    strapline: "Document what you have done. Plan what comes next.",
    summary:
      "Explore practical approaches to documenting achievements, identifying opportunities and developing an academic or clinical portfolio.",
    description:
      "This workshop looks at how to build a portfolio that reflects your interests and achievements. It covers documenting activity as you go, finding meaningful opportunities in research, teaching and leadership, and presenting your experience clearly.",
    topics: ["Recording achievements", "Finding opportunities", "Academic portfolios", "Reflection"],
    outcomes: [
      "Set up a simple system for recording achievements",
      "Identify opportunities that match your interests",
      "Present your experience clearly and honestly",
    ],
    audience: "Students in any year, particularly those thinking about foundation and specialty applications.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "electric",
    motif: "portfolio",
    notes: null,
  },
  {
    id: "w5",
    slug: "digital-surgery-and-simulation",
    number: 5,
    title: "Digital Surgery and Simulation",
    strapline: "Where surgical training meets technology.",
    summary:
      "Explore how digital technologies, simulation and emerging surgical tools may influence surgical education and practice.",
    description:
      "An exploration of how simulation and digital technologies are being used in surgical education and practice, and what evidence exists for their benefits. Any hands-on demonstrations or equipment will be announced once confirmed by the facilitators.",
    topics: ["Simulation-based education", "Emerging surgical technology", "Skills assessment", "Evidence for new tools"],
    outcomes: [
      "Describe how simulation is used in surgical training",
      "Discuss the potential and limitations of emerging surgical technologies",
      "Consider how the impact of new surgical tools can be evaluated",
    ],
    audience: "Students with an interest in surgery, simulation or medical technology.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "cyan",
    motif: "simulation",
    notes: "Interactive demonstrations will be listed here if confirmed.",
  },
  {
    id: "w6",
    slug: "global-digital-health-inequalities",
    number: 6,
    title: "Global Digital Health Inequalities",
    strapline: "Who benefits from digital health, and who is left behind?",
    summary:
      "Explore how access, infrastructure, socioeconomic factors and healthcare systems influence the adoption and impact of digital healthcare technologies.",
    description:
      "Digital health can widen or narrow inequalities. This workshop examines how access, connectivity, digital literacy, socioeconomic factors and the design of healthcare systems shape who benefits from new technology, in the UK and globally.",
    topics: ["Digital exclusion", "Infrastructure and access", "Health systems", "Equitable design"],
    outcomes: [
      "Identify factors that influence access to digital healthcare",
      "Discuss how digital interventions can widen or reduce inequalities",
      "Consider principles for more equitable digital health",
    ],
    audience: "All delegates, especially those interested in public and global health.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "violet",
    motif: "globe",
    notes: null,
  },
];

export const seedAnnouncements: Announcement[] = [
  {
    id: "a-poster-deadline",
    title: "Poster submission deadline: Friday 13 November",
    body: "Accepted poster presenters should submit their posters by Friday 13 November 2026 and bring a printed copy on the day. Landscape and portrait are both accepted.",
    level: "important",
    audience: "public",
    pinned: true,
    publishedAt: "2026-11-09T09:00:00Z",
  },
];

export const seedFaqs: Faq[] = [
  {
    id: "f1",
    question: "When and where is INSPIRE 2026?",
    answer:
      "Saturday 21 November 2026 at Lincoln Medical School, University of Lincoln. Session times will be published on the programme page once confirmed.",
    category: "Conference",
  },
  {
    id: "f2",
    question: "Who is the conference for?",
    answer:
      "Medical students, aspiring clinician-researchers, early-career researchers, academic clinicians and healthcare innovators. You do not need research experience to attend.",
    category: "Conference",
  },
  {
    id: "f3",
    question: "How do I register?",
    answer:
      "Registration details are published on the Conference 2026 page. The current registration status is always shown there.",
    category: "Registration",
  },
  {
    id: "f4",
    question: "What do poster presenters need to do?",
    answer:
      "Accepted presenters should submit their poster by Friday 13 November 2026 and bring a printed copy to the conference. Landscape and portrait orientations are both accepted.",
    category: "Research",
  },
  {
    id: "f5",
    question: "Do I need to choose workshops in advance?",
    answer:
      "Workshop allocation details will be confirmed by the conference team. You can explore all six workshops now and save the ones you are interested in to your agenda.",
    category: "Workshops",
  },
  {
    id: "f6",
    question: "I have an access requirement. Who should I contact?",
    answer:
      "Please contact the team using the accessibility enquiry option on the contact page as early as possible, so arrangements can be made before the day.",
    category: "Accessibility",
  },
];

/** No opportunities have been supplied. The hub shows an empty state. */
export const seedOpportunities: Opportunity[] = [];

/** No approved media has been supplied. The gallery shows an empty state. */
export const seedGallery: GalleryAsset[] = [];

/**
 * Participating medical school community as described by the organisers.
 * Relationship labels describe student participation only, not endorsement.
 */
export const seedPartners: Partner[] = [
  { id: "p-lincoln", name: "Lincoln Medical School", logoUrl: null, url: null, relationship: "2026 host medical school" },
  { id: "p-leicester", name: "Leicester", logoUrl: null, url: null, relationship: "Participating student community" },
  { id: "p-nottingham", name: "Nottingham", logoUrl: null, url: null, relationship: "Participating student community" },
  { id: "p-east-anglia", name: "East Anglia", logoUrl: null, url: null, relationship: "Participating student community" },
];

/** Committee profiles are added through the admin dashboard. */
export const seedCommittee: CommitteeMember[] = [];

/** Only verified milestones are listed. Earlier history is added once verified. */
export const seedTimeline: TimelineEvent[] = [
  {
    id: "t-2026",
    year: "2026",
    title: "INSPIRE comes to Lincoln",
    description:
      "The 2026 conference, Digital Health: From Innovation to Evidence, is hosted at Lincoln Medical School in collaboration with the participating medical school community.",
  },
];

/** Reputable, freely available external resources. Links point to the publishers. */
export const seedResources: Resource[] = [
  {
    id: "r-equator",
    title: "EQUATOR Network reporting guidelines",
    category: "Writing & reporting",
    summary: "The central library of reporting guidelines such as CONSORT, STROBE and PRISMA, useful when structuring an abstract or manuscript.",
    url: "https://www.equator-network.org/",
    isExample: false,
  },
  {
    id: "r-casp",
    title: "CASP critical appraisal checklists",
    category: "Critical appraisal",
    summary: "Structured checklists for appraising randomised trials, cohort studies, systematic reviews and more.",
    url: "https://casp-uk.net/casp-tools-checklists/",
    isExample: false,
  },
  {
    id: "r-cochrane",
    title: "Cochrane Handbook for Systematic Reviews of Interventions",
    category: "Research methods",
    summary: "The standard reference for planning and conducting systematic reviews.",
    url: "https://training.cochrane.org/handbook",
    isExample: false,
  },
  {
    id: "r-nihr",
    title: "NIHR Academy",
    category: "Research careers",
    summary: "Information on research training and career pathways supported by the National Institute for Health and Care Research.",
    url: "https://www.nihr.ac.uk/career-development",
    isExample: false,
  },
];

/** Approved, consented research is published here by administrators. */
export const seedShowcase: ShowcaseItem[] = [];
